package com.unihop.realtime;

import com.unihop.ride.RideRepository;
import com.unihop.ride.RideRow;
import com.unihop.ride.RideViews;
import com.unihop.ride.dto.DriverCard;
import com.unihop.ride.dto.Hub;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Contract section 11 ride pushes. Events are built inside the caller's transaction (so they see its writes) and sent
 * only after it commits, so a rolled-back change is never announced.
 */
@Component
@RequiredArgsConstructor
public class RideBroadcaster {

    private final RideRepository rides;
    private final RideViews views;
    private final RealtimePublisher publisher;

    /** Call after any ride status change, inside the transaction that made it. */
    public void statusChanged(UUID rideId) {
        RideRow ride = rides.find(rideId).orElseThrow();
        DriverCard driver = ride.driverId() == null ? null : views.driverCard(ride.driverId());
        Integer eta = driver == null || driver.lat() == null || driver.lng() == null ? null
                : views.etaSeconds(ride, driver.lat(), driver.lng());
        RideStatusEvent event = new RideStatusEvent(ride.id(), ride.status(), driver, eta, Instant.now());
        AfterCommit.run(() -> publisher.rideStatus(event));
    }

    /**
     * Call after a driver's location is stored. Pushes a location event if the driver's ride is ACCEPTED (heading to
     * pickup) or IN_PROGRESS (heading to dropoff). {@code fromLat}/{@code fromLng} is the previous location, or null.
     */
    public void driverMoved(UUID driverId, Double fromLat, Double fromLng, double lat, double lng) {
        RideRow ride = rides.findActiveFor(driverId).filter(r -> driverId.equals(r.driverId())).orElse(null);
        if (ride == null) {
            return;
        }
        Integer eta = views.etaSeconds(ride, lat, lng);
        if (eta == null) {
            return;
        }
        Hub target = views.currentTarget(ride);
        boolean moved = fromLat != null && fromLng != null && (fromLat != lat || fromLng != lng);
        double heading = moved ? Navigation.heading(fromLat, fromLng, lat, lng)
                : Navigation.heading(lat, lng, target.lat(), target.lng());
        RideLocationEvent event = new RideLocationEvent(lat, lng, heading, eta);
        AfterCommit.run(() -> publisher.rideLocation(ride.id(), event));
    }

}
