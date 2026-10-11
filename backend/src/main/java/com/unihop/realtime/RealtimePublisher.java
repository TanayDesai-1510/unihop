package com.unihop.realtime;

import com.unihop.matching.RideOffer;
import com.unihop.ride.dto.ChatMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Typed publishers for every topic in contract section 11. The only way server code should push to clients. */
@Component
@RequiredArgsConstructor
public class RealtimePublisher {

    private final SimpMessagingTemplate messaging;

    public void offer(UUID driverId, RideOffer offer) {
        messaging.convertAndSend(Topics.driverOffers(driverId), offer);
    }

    public void offerRevoked(UUID driverId, UUID offerId) {
        messaging.convertAndSend(Topics.driverOffers(driverId), OfferRevokedEvent.of(offerId));
    }

    public void rideStatus(RideStatusEvent event) {
        messaging.convertAndSend(Topics.rideStatus(event.rideId()), event);
    }

    public void rideLocation(UUID rideId, RideLocationEvent event) {
        messaging.convertAndSend(Topics.rideLocation(rideId), event);
    }

    public void chat(UUID rideId, ChatMessage message) {
        messaging.convertAndSend(Topics.rideChat(rideId), message);
    }
}
