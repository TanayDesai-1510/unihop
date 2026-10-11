package com.unihop.realtime;

import com.unihop.common.ApiException;
import com.unihop.common.enums.DriverStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Contract section 8, driver availability. Writes only the columns Dev owns on {@code driver_profiles}:
 * {@code is_online}, {@code current_lat}, {@code current_lng}, {@code last_seen_at}.
 */
@Service
@RequiredArgsConstructor
public class DriverAvailabilityService {

    private final JdbcTemplate jdbc;
    private final RideBroadcaster broadcaster;

    @Transactional
    public DriverProfile goOnline(UUID driverId, double lat, double lng) {
        requireApproved(driverId);
        jdbc.update("""
                UPDATE driver_profiles SET is_online = true, current_lat = ?, current_lng = ?, last_seen_at = now()
                WHERE user_id = ?""", lat, lng, driverId);
        return load(driverId);
    }

    @Transactional
    public DriverProfile goOffline(UUID driverId) {
        requireApproved(driverId);
        jdbc.update("UPDATE driver_profiles SET is_online = false, last_seen_at = now() WHERE user_id = ?", driverId);
        return load(driverId);
    }

    @Transactional
    public void updateLocation(UUID driverId, double lat, double lng) {
        requireApproved(driverId);
        Double[] previous = jdbc.queryForObject("SELECT current_lat, current_lng FROM driver_profiles WHERE user_id = ?",
                (rs, i) -> new Double[]{rs.getObject(1, Double.class), rs.getObject(2, Double.class)}, driverId);
        jdbc.update("""
                UPDATE driver_profiles SET current_lat = ?, current_lng = ?, last_seen_at = now()
                WHERE user_id = ?""", lat, lng, driverId);
        broadcaster.driverMoved(driverId, previous[0], previous[1], lat, lng);
    }

    private void requireApproved(UUID driverId) {
        List<String> status = jdbc.queryForList(
                "SELECT status FROM driver_profiles WHERE user_id = ? FOR UPDATE", String.class, driverId);
        if (status.isEmpty() || !DriverStatus.APPROVED.name().equals(status.get(0))) {
            throw ApiException.conflict("DRIVER_NOT_ONBOARDED", "Complete driver onboarding first");
        }
    }

    private DriverProfile load(UUID driverId) {
        return jdbc.queryForObject("SELECT * FROM driver_profiles WHERE user_id = ?", (rs, row) -> new DriverProfile(
                rs.getObject("user_id", UUID.class),
                rs.getString("license_number"),
                rs.getString("car_make"),
                rs.getString("car_model"),
                rs.getString("car_color"),
                rs.getString("plate"),
                DriverStatus.valueOf(rs.getString("status")),
                rs.getBoolean("is_online"),
                rs.getObject("current_lat", Double.class),
                rs.getObject("current_lng", Double.class)), driverId);
    }
}
