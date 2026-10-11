package com.unihop.ride;

import com.unihop.common.ApiException;
import com.unihop.common.enums.RideStatus;
import com.unihop.payments.PaymentService;
import com.unihop.payments.PaymentSummary;
import com.unihop.pricing.FareBreakdown;
import com.unihop.pricing.FareService;
import com.unihop.ride.dto.Ride;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/** Ride creation and reads (contract section 8). */
@Service
@RequiredArgsConstructor
public class RideService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RideRepository rides;
    private final RideViews views;
    private final FareService fareService;
    private final PaymentService paymentService;
    private final ApplicationEventPublisher events;

    /**
     * Quote, insert REQUESTED, authorize, all in one transaction: a 402 from {@code authorizeRide} rolls the ride back.
     * Matching starts after commit ({@link RideRequestedEvent}).
     */
    @Transactional
    public Ride create(UUID riderId, CreateRideRequest request) {
        if (!rides.lockUser(riderId)) {
            throw ApiException.unauthorized("Unknown user");
        }
        if (rides.findActiveFor(riderId).isPresent()) {
            throw ApiException.conflict("ACTIVE_RIDE_EXISTS", "You already have an active ride");
        }
        FareBreakdown fare = fareService.quote(request.pickupHubId(), request.dropoffHubId());
        UUID rideId = UUID.randomUUID();
        rides.insert(rideId, riderId, request.pickupHubId(), request.dropoffHubId(), fare, newShareToken(),
                request.promoCode(), request.scheduledFor());
        PaymentSummary payment = paymentService.authorizeRide(rideId, riderId, request.paymentMethodId(),
                Boolean.TRUE.equals(request.useCredits()), fare.total());
        RideRow ride = rides.find(rideId).orElseThrow();
        events.publishEvent(new RideRequestedEvent(rideId));
        return views.ride(ride, riderId, payment);
    }

    @Transactional(readOnly = true)
    public Ride get(UUID rideId, UUID viewerId) {
        RideRow ride = rides.find(rideId)
                .orElseThrow(() -> ApiException.notFound("NOT_FOUND", "Ride not found"));
        if (!ride.isParticipant(viewerId)) {
            throw ApiException.forbidden("Not a participant in this ride");
        }
        return views.ride(ride, viewerId);
    }

    /** ACCEPTED -> ARRIVED, assigned driver only. */
    @Transactional
    public Ride arrived(UUID rideId, UUID driverId) {
        RideRow ride = lockForAssignedDriver(rideId, driverId);
        RideTransitions.check(ride.status(), RideStatus.ARRIVED);
        rides.markProgress(rideId, RideStatus.ARRIVED);
        return views.ride(rides.find(rideId).orElseThrow(), driverId);
    }

    /** ARRIVED -> IN_PROGRESS when the driver enters the rider's PIN. */
    @Transactional
    public Ride start(UUID rideId, UUID driverId, String pin) {
        RideRow ride = lockForAssignedDriver(rideId, driverId);
        RideTransitions.check(ride.status(), RideStatus.IN_PROGRESS);
        if (pin == null || !pin.trim().equals(ride.pin())) {
            throw ApiException.badRequest("INVALID_PIN", "That PIN doesn't match the rider's");
        }
        rides.markProgress(rideId, RideStatus.IN_PROGRESS);
        return views.ride(rides.find(rideId).orElseThrow(), driverId);
    }

    /** IN_PROGRESS -> COMPLETED and capture the payment, in one transaction: a capture failure leaves the ride IN_PROGRESS. */
    @Transactional
    public Ride complete(UUID rideId, UUID driverId) {
        RideRow ride = lockForAssignedDriver(rideId, driverId);
        RideTransitions.check(ride.status(), RideStatus.COMPLETED);
        rides.markProgress(rideId, RideStatus.COMPLETED);
        paymentService.captureRide(rideId);
        return views.ride(rides.find(rideId).orElseThrow(), driverId);
    }

    private RideRow lockForAssignedDriver(UUID rideId, UUID driverId) {
        RideRow ride = rides.findForUpdate(rideId)
                .orElseThrow(() -> ApiException.notFound("NOT_FOUND", "Ride not found"));
        if (!driverId.equals(ride.driverId())) {
            throw ApiException.forbidden("Only the assigned driver can do this");
        }
        return ride;
    }

    @Transactional(readOnly = true)
    public Optional<Ride> active(UUID userId) {
        return rides.findActiveFor(userId).map(ride -> views.ride(ride, userId));
    }

    private static String newShareToken() {
        byte[] bytes = new byte[18];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
