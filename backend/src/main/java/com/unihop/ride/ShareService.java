package com.unihop.ride;

import com.unihop.common.ApiException;
import com.unihop.ride.dto.DriverCard;
import com.unihop.ride.dto.PublicRideView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Objects;
import java.util.stream.Stream;

/** Public trip-sharing view (contract section 8, {@code GET /api/share/{shareToken}}). */
@Service
@RequiredArgsConstructor
public class ShareService {

    private final RideRepository rides;
    private final RideViews views;

    @Transactional(readOnly = true)
    public PublicRideView view(String shareToken) {
        RideRow ride = rides.findByShareToken(shareToken)
                .orElseThrow(() -> ApiException.notFound("NOT_FOUND", "Shared trip not found"));
        DriverCard driver = ride.driverId() == null ? null : views.driverCard(ride.driverId());
        if (driver != null && RideTransitions.isTerminal(ride.status())) {
            // the trip is over: stop exposing where the driver is now
            driver = new DriverCard(driver.id(), driver.name(), driver.ratingAvg(), driver.carMake(), driver.carModel(),
                    driver.carColor(), driver.plate(), null, null);
        }
        Integer eta = driver == null || driver.lat() == null || driver.lng() == null ? null
                : views.etaSeconds(ride, driver.lat(), driver.lng());
        return new PublicRideView(ride.status(), views.hub(ride.pickupHubId()), views.hub(ride.dropoffHubId()), driver,
                firstName(views.participant(ride.riderId()).name()), eta, lastChange(ride));
    }

    static String firstName(String name) {
        if (name == null || name.isBlank()) {
            return "Rider";
        }
        return name.trim().split("\\s+")[0];
    }

    private static Instant lastChange(RideRow ride) {
        return Stream.of(ride.requestedAt(), ride.acceptedAt(), ride.arrivedAt(), ride.startedAt(), ride.completedAt(),
                        ride.cancelledAt())
                .filter(Objects::nonNull)
                .max(Instant::compareTo)
                .orElse(ride.requestedAt());
    }
}
