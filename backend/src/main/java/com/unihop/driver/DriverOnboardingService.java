package com.unihop.driver;

import com.unihop.common.ApiException;
import com.unihop.common.enums.DriverStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class DriverOnboardingService {
    private final JdbcTemplate jdbc;
    public DriverOnboardingService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public DriverProfile get(UUID userId) {
        var profiles = jdbc.query("SELECT * FROM driver_profiles WHERE user_id = ?", (rs, row) ->
                new DriverProfile(rs.getObject("user_id", UUID.class), rs.getString("license_number"),
                        rs.getString("car_make"), rs.getString("car_model"), rs.getString("car_color"),
                        rs.getString("plate"), DriverStatus.valueOf(rs.getString("status")),
                        rs.getBoolean("is_online"), rs.getObject("current_lat", Double.class),
                        rs.getObject("current_lng", Double.class)), userId);
        if (profiles.isEmpty()) throw ApiException.notFound("NOT_FOUND", "Driver profile not found");
        return profiles.getFirst();
    }

    @Transactional
    public DriverProfile onboard(UUID userId, String licenseNumber, String carMake, String carModel,
                                 String carColor, String plate) {
        if (jdbc.query("SELECT id FROM users WHERE id = ? FOR UPDATE", (rs, row) -> rs.getObject(1), userId).isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "User not found");
        }
        jdbc.update("""
                INSERT INTO driver_profiles (user_id, license_number, car_make, car_model, car_color, plate, status)
                VALUES (?, ?, ?, ?, ?, ?, 'APPROVED')
                ON CONFLICT (user_id) DO UPDATE SET license_number = EXCLUDED.license_number,
                    car_make = EXCLUDED.car_make, car_model = EXCLUDED.car_model,
                    car_color = EXCLUDED.car_color, plate = EXCLUDED.plate, status = 'APPROVED'
                """, userId, licenseNumber.trim(), carMake.trim(), carModel.trim(), carColor.trim(), plate.trim());
        return get(userId);
    }
}
