package com.unihop.ride;

import com.unihop.common.enums.RideStatus;
import com.unihop.common.enums.Zone;
import com.unihop.realtime.Navigation;
import com.unihop.payments.PaymentSummary;
import com.unihop.ride.dto.DriverCard;
import com.unihop.ride.dto.Hub;
import com.unihop.ride.dto.Ride;
import com.unihop.ride.dto.RideParticipant;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Assembles contract {@code Ride} DTOs (and the parts reused by events) from {@code rides} plus read-only lookups. */
@Component
@RequiredArgsConstructor
public class RideViews {

    private final JdbcTemplate jdbc;
    private final RidePaymentReader payments;

    /** {@code viewerId} decides whether {@code pin} is shown: rider only. */
    public Ride ride(RideRow ride, UUID viewerId) {
        return ride(ride, viewerId, payments.summary(ride));
    }

    Ride ride(RideRow ride, UUID viewerId, PaymentSummary payment) {
        return new Ride(
                ride.id(),
                ride.status(),
                payment,
                participant(ride.riderId()),
                ride.driverId() == null ? null : driverCard(ride.driverId()),
                hub(ride.pickupHubId()),
                hub(ride.dropoffHubId()),
                ride.fare(),
                ride.riderId().equals(viewerId) ? ride.pin() : null,
                ride.shareToken(),
                ride.requestedAt(),
                ride.acceptedAt(),
                ride.arrivedAt(),
                ride.startedAt(),
                ride.completedAt(),
                ride.cancelledAt(),
                ride.cancelReason(),
                ride.cancelledBy());
    }

    /** Where the driver is heading: pickup while ACCEPTED, dropoff while IN_PROGRESS, else null. */
    public Hub currentTarget(RideRow ride) {
        if (ride.status() == RideStatus.ACCEPTED) {
            return hub(ride.pickupHubId());
        }
        if (ride.status() == RideStatus.IN_PROGRESS) {
            return hub(ride.dropoffHubId());
        }
        return null;
    }

    /** Contract section 11 {@code etaSeconds}: to pickup while ACCEPTED, to dropoff while IN_PROGRESS, else null. */
    public Integer etaSeconds(RideRow ride, double lat, double lng) {
        Hub target = currentTarget(ride);
        return target == null ? null : Navigation.etaSeconds(lat, lng, target.lat(), target.lng());
    }

    public Hub hub(UUID hubId) {
        return jdbc.queryForObject("SELECT * FROM hubs WHERE id = ?", (rs, i) -> new Hub(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                Zone.valueOf(rs.getString("zone")), rs.getDouble("lat"), rs.getDouble("lng")), hubId);
    }

    public RideParticipant participant(UUID userId) {
        return jdbc.queryForObject("SELECT id, name, rating_avg FROM users WHERE id = ?", (rs, i) -> new RideParticipant(
                rs.getObject("id", UUID.class), rs.getString("name"), rs.getBigDecimal("rating_avg")), userId);
    }

    public DriverCard driverCard(UUID driverId) {
        return jdbc.queryForObject("""
                SELECT u.id, u.name, u.rating_avg, d.car_make, d.car_model, d.car_color, d.plate, d.current_lat, d.current_lng
                FROM users u JOIN driver_profiles d ON d.user_id = u.id WHERE u.id = ?""", (rs, i) -> new DriverCard(
                rs.getObject("id", UUID.class), rs.getString("name"), rs.getBigDecimal("rating_avg"),
                rs.getString("car_make"), rs.getString("car_model"), rs.getString("car_color"), rs.getString("plate"),
                rs.getObject("current_lat", Double.class), rs.getObject("current_lng", Double.class)), driverId);
    }
}
