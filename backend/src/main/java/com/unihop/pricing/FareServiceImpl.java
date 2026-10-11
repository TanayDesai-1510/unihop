package com.unihop.pricing;

import com.unihop.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Working implementation of the contract pricing rules against the {@code hubs} and {@code fares} tables.
 */
@Service
@RequiredArgsConstructor
public class FareServiceImpl implements FareService {

    private static final BigDecimal MAX_FARE = new BigDecimal("10.00");

    private final JdbcTemplate jdbc;

    @Override
    public FareBreakdown quote(UUID fromHubId, UUID toHubId) {
        if (fromHubId == null || toHubId == null) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Both hub ids are required");
        }
        if (fromHubId.equals(toHubId)) {
            throw ApiException.badRequest("SAME_HUB", "Pickup and dropoff must be different hubs");
        }
        String fromZone = zoneOf(fromHubId);
        String toZone = zoneOf(toHubId);
        List<BigDecimal> prices = jdbc.queryForList(
                "SELECT price FROM fares WHERE from_zone = ? AND to_zone = ?", BigDecimal.class, fromZone, toZone);
        if (prices.isEmpty()) {
            throw new IllegalStateException("No fare configured for " + fromZone + " -> " + toZone);
        }
        BigDecimal price = prices.get(0);
        if (price.compareTo(MAX_FARE) >= 0) {
            throw new IllegalStateException("Fare " + price + " violates the under-$10 rule");
        }
        return FareBreakdown.fromTotal(price);
    }

    private String zoneOf(UUID hubId) {
        List<String> zones = jdbc.queryForList("SELECT zone FROM hubs WHERE id = ?", String.class, hubId);
        if (zones.isEmpty()) {
            throw ApiException.notFound("HUB_NOT_FOUND", "Unknown hub " + hubId);
        }
        return zones.get(0);
    }
}
