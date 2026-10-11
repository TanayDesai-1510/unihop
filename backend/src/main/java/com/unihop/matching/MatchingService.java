package com.unihop.matching;

import com.unihop.common.enums.RideStatus;
import com.unihop.payments.PaymentService;
import com.unihop.realtime.AfterCommit;
import com.unihop.realtime.RealtimePublisher;
import com.unihop.realtime.RideBroadcaster;
import com.unihop.ride.RideRepository;
import com.unihop.ride.RideRequestedEvent;
import com.unihop.ride.RideRow;
import com.unihop.ride.RideTransitions;
import com.unihop.ride.RideViews;
import com.unihop.ride.dto.Hub;
import com.unihop.ride.dto.RideParticipant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Contract section 10: offer a REQUESTED ride to the nearest available driver for 15 seconds, then the next, until
 * someone accepts or nobody is left (NO_DRIVERS). Offers are pushed to drivers only after the transaction commits.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchingService {

    private final RideRepository rides;
    private final OfferRepository offers;
    private final RideViews views;
    private final PaymentService paymentService;
    private final RealtimePublisher publisher;
    private final RideBroadcaster broadcaster;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onRideRequested(RideRequestedEvent event) {
        dispatch(event.rideId());
    }

    /**
     * Offers the ride to the next candidate, or ends it as NO_DRIVERS. No-op unless the ride is REQUESTED with no live
     * offer, so it is safe to call after any decline or expiry.
     */
    @Transactional
    public void dispatch(UUID rideId) {
        RideRow ride = rides.findForUpdate(rideId).orElse(null);
        if (ride == null || ride.status() != RideStatus.REQUESTED || offers.hasLiveOffer(rideId)) {
            return;
        }
        Hub pickup = views.hub(ride.pickupHubId());
        List<OfferRepository.Candidate> candidates = offers.candidates(rideId, ride.riderId()).stream()
                .sorted(Comparator.comparingDouble(c -> distance(c, pickup)))
                .toList();
        for (OfferRepository.Candidate candidate : candidates) {
            if (offers.lockIfStillAvailable(candidate.driverId())) {
                offer(ride, pickup, candidate);
                return;
            }
        }
        RideTransitions.check(ride.status(), RideStatus.NO_DRIVERS);
        rides.markNoDrivers(rideId);
        paymentService.voidRide(rideId);
        broadcaster.statusChanged(rideId);
        log.info("Ride {} has no drivers left", rideId);
    }

    /** Expires overdue offers and moves each affected ride on to its next candidate. */
    @Scheduled(fixedDelayString = "${app.matching.sweep-ms:1000}")
    @Transactional
    public void expireDueOffers() {
        Set<UUID> rideIds = new LinkedHashSet<>();
        for (OfferRepository.Expired expired : offers.expireDue()) {
            rideIds.add(expired.rideId());
        }
        rideIds.forEach(this::dispatch);
    }

    /**
     * Rider cancelled: the ride's live offer becomes EXPIRED and its driver gets {@code OFFER_REVOKED}.
     * Joins the caller's transaction (the cancel), so nothing is sent if the cancel rolls back.
     */
    @Transactional
    public void revokeLiveOffer(UUID rideId) {
        for (OfferRepository.Revoked revoked : offers.revoke(rideId)) {
            AfterCommit.run(() -> publisher.offerRevoked(revoked.driverId(), revoked.offerId()));
        }
    }

    private void offer(RideRow ride, Hub pickup, OfferRepository.Candidate candidate) {
        OfferRepository.Inserted inserted = offers.insert(ride.id(), candidate.driverId());
        RideOffer offer = rideOffer(inserted.offerId(), ride, pickup, distance(candidate, pickup), inserted.expiresAt());
        AfterCommit.run(() -> publisher.offer(candidate.driverId(), offer));
        log.info("Ride {} offered to driver {} until {}", ride.id(), candidate.driverId(), inserted.expiresAt());
    }

    /** Builds the contract {@code RideOffer} payload. */
    RideOffer rideOffer(UUID offerId, RideRow ride, Hub pickup, double distanceMeters, java.time.Instant expiresAt) {
        RideParticipant rider = views.participant(ride.riderId());
        return new RideOffer(offerId, ride.id(), pickup, views.hub(ride.dropoffHubId()), ride.fare(), rider.name(),
                rider.ratingAvg(), Math.round(distanceMeters), expiresAt);
    }

    private static double distance(OfferRepository.Candidate candidate, Hub pickup) {
        return Haversine.meters(candidate.lat(), candidate.lng(), pickup.lat(), pickup.lng());
    }
}
