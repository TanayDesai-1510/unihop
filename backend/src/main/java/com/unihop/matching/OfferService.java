package com.unihop.matching;

import com.unihop.common.ApiException;
import com.unihop.common.enums.RideStatus;
import com.unihop.ride.RideRepository;
import com.unihop.ride.RideRow;
import com.unihop.ride.RideTransitions;
import com.unihop.ride.RideViews;
import com.unihop.ride.dto.Hub;
import com.unihop.ride.dto.Ride;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Optional;
import java.util.UUID;

/** Driver responses to offers (contract sections 8 and 10). */
@Service
@RequiredArgsConstructor
public class OfferService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RideRepository rides;
    private final OfferRepository offers;
    private final RideViews views;
    private final MatchingService matching;

    /** Driver holding the live offer takes the ride: ACCEPTED, driver assigned, 4-digit PIN generated. */
    @Transactional
    public Ride accept(UUID rideId, UUID driverId) {
        RideRow ride = lockRide(rideId);
        OfferRepository.OfferRow offer = liveOfferHeldBy(ride, driverId);
        RideTransitions.check(ride.status(), RideStatus.ACCEPTED);
        offers.respond(offer.id(), "ACCEPTED");
        rides.markAccepted(rideId, driverId, newPin());
        return views.ride(rides.find(rideId).orElseThrow(), driverId);
    }

    /** Driver passes; the ride moves on to the next candidate (or NO_DRIVERS). */
    @Transactional
    public void decline(UUID rideId, UUID driverId) {
        RideRow ride = lockRide(rideId);
        OfferRepository.OfferRow offer = liveOfferHeldBy(ride, driverId);
        offers.respond(offer.id(), "DECLINED");
        matching.dispatch(rideId);
    }

    /** The caller's live offer, for recovery after a WebSocket reconnect. */
    @Transactional(readOnly = true)
    public Optional<RideOffer> currentOffer(UUID driverId) {
        return offers.liveFor(driverId).flatMap(offer -> rides.find(offer.rideId()).map(ride -> {
            Hub pickup = views.hub(ride.pickupHubId());
            double distance = offers.driverLocation(driverId)
                    .map(loc -> Haversine.meters(loc[0], loc[1], pickup.lat(), pickup.lng()))
                    .orElse(0.0);
            return matching.rideOffer(offer.id(), ride, pickup, distance, offer.expiresAt());
        }));
    }

    private RideRow lockRide(UUID rideId) {
        return rides.findForUpdate(rideId)
                .orElseThrow(() -> ApiException.notFound("NOT_FOUND", "Ride not found"));
    }

    /** 403 if this driver was never offered the ride; 409 OFFER_NOT_ACTIVE if their offer expired, was revoked or answered. */
    private OfferRepository.OfferRow liveOfferHeldBy(RideRow ride, UUID driverId) {
        OfferRepository.OfferRow offer = offers.latestForUpdate(ride.id(), driverId)
                .orElseThrow(() -> ApiException.forbidden("You do not hold an offer for this ride"));
        if (!offer.live() || ride.status() != RideStatus.REQUESTED) {
            throw ApiException.conflict("OFFER_NOT_ACTIVE", "This offer is no longer active");
        }
        return offer;
    }

    static String newPin() {
        return String.format("%04d", RANDOM.nextInt(10_000));
    }
}
