package com.unihop.driver;

import com.unihop.common.enums.DriverStatus;
import java.util.UUID;

public record DriverProfile(UUID userId, String licenseNumber, String carMake, String carModel,
                            String carColor, String plate, DriverStatus status, boolean isOnline,
                            Double lat, Double lng) {}
