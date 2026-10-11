package com.unihop.records;

import com.unihop.common.ApiException;
import com.unihop.common.enums.CardBrand;
import com.unihop.common.enums.DeclineCode;
import com.unihop.common.enums.PaymentMethodType;
import com.unihop.common.enums.PaymentStatus;
import com.unihop.common.enums.RideStatus;
import com.unihop.common.enums.UserMode;
import com.unihop.payments.PaymentSummary;
import com.unihop.pricing.FareBreakdown;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RecordsService {
    private static final Map<CardBrand, String> BRAND_NAMES = Map.of(
            CardBrand.VISA, "Visa",
            CardBrand.MASTERCARD, "Mastercard",
            CardBrand.AMEX, "Amex",
            CardBrand.DISCOVER, "Discover");

    private final JdbcTemplate jdbc;

    public RecordsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<RideSummary> rides(UUID userId, UserMode mode) {
        String participantColumn = mode == UserMode.DRIVER ? "r.driver_id" : "r.rider_id";
        return jdbc.query("""
                SELECT r.id, r.status, pickup.name AS pickup_name, dropoff.name AS dropoff_name,
                       r.fare_total, r.driver_payout, r.completed_at, r.requested_at
                FROM rides r
                JOIN hubs pickup ON pickup.id = r.pickup_hub_id
                JOIN hubs dropoff ON dropoff.id = r.dropoff_hub_id
                WHERE """ + " " + participantColumn + " = ? ORDER BY r.requested_at DESC, r.id DESC",
                (rs, row) -> new RideSummary(
                        rs.getObject("id", UUID.class),
                        RideStatus.valueOf(rs.getString("status")),
                        rs.getString("pickup_name"),
                        rs.getString("dropoff_name"),
                        money(rs.getBigDecimal("fare_total")),
                        money(rs.getBigDecimal("driver_payout")),
                        instant(rs, "completed_at"),
                        instant(rs, "requested_at")), userId);
    }

    @Transactional(readOnly = true)
    public Receipt receipt(UUID rideId, UUID viewerId) {
        List<ReceiptRow> rows = jdbc.query("""
                SELECT r.*, pickup.name AS pickup_name, dropoff.name AS dropoff_name,
                       rider.name AS rider_name, driver.name AS driver_name,
                       rp.status AS payment_status, rp.amount_total, rp.credits_applied, rp.card_amount,
                       rp.decline_code, pm.type AS method_type, pm.brand AS method_brand, pm.last4 AS method_last4
                FROM rides r
                JOIN hubs pickup ON pickup.id = r.pickup_hub_id
                JOIN hubs dropoff ON dropoff.id = r.dropoff_hub_id
                JOIN users rider ON rider.id = r.rider_id
                LEFT JOIN users driver ON driver.id = r.driver_id
                LEFT JOIN ride_payments rp ON rp.ride_id = r.id
                LEFT JOIN payment_methods pm ON pm.id = rp.payment_method_id
                WHERE r.id = ?
                """, RecordsService::mapReceiptRow, rideId);
        if (rows.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Ride not found");
        }

        ReceiptRow row = rows.getFirst();
        if (!viewerId.equals(row.riderId()) && !viewerId.equals(row.driverId())) {
            throw ApiException.forbidden("Not a participant in this ride");
        }
        if (row.status() != RideStatus.COMPLETED || row.paymentStatus() == null) {
            throw ApiException.notFound("NOT_FOUND", "Receipts are available after the ride completes");
        }

        PaymentSummary payment = payment(row);
        Long durationSeconds = row.startedAt() == null || row.completedAt() == null
                ? null : Duration.between(row.startedAt(), row.completedAt()).getSeconds();
        return new Receipt(
                row.id(), row.pickupHubName(), row.dropoffHubName(), row.fare(), payment,
                row.driverName(), row.riderName(), row.startedAt(), row.completedAt(), durationSeconds);
    }

    private static ReceiptRow mapReceiptRow(ResultSet rs, int row) throws SQLException {
        String paymentStatus = rs.getString("payment_status");
        String methodType = rs.getString("method_type");
        String declineCode = rs.getString("decline_code");
        return new ReceiptRow(
                rs.getObject("id", UUID.class),
                rs.getObject("rider_id", UUID.class),
                rs.getObject("driver_id", UUID.class),
                RideStatus.valueOf(rs.getString("status")),
                rs.getString("pickup_name"),
                rs.getString("dropoff_name"),
                new FareBreakdown(
                        money(rs.getBigDecimal("fare_total")),
                        money(rs.getBigDecimal("platform_fee")),
                        money(rs.getBigDecimal("base_fare")),
                        money(rs.getBigDecimal("driver_payout")),
                        money(rs.getBigDecimal("platform_margin"))),
                rs.getString("driver_name"),
                rs.getString("rider_name"),
                instant(rs, "started_at"),
                instant(rs, "completed_at"),
                paymentStatus == null ? null : PaymentStatus.valueOf(paymentStatus),
                moneyOrNull(rs.getBigDecimal("amount_total")),
                moneyOrNull(rs.getBigDecimal("credits_applied")),
                moneyOrNull(rs.getBigDecimal("card_amount")),
                declineCode == null ? null : DeclineCode.valueOf(declineCode),
                methodType == null ? null : PaymentMethodType.valueOf(methodType),
                methodType == null ? null : CardBrand.valueOf(rs.getString("method_brand")),
                methodType == null ? null : rs.getString("method_last4").trim());
    }

    private static PaymentSummary payment(ReceiptRow row) {
        String savedMethodLabel = switch (row.methodType()) {
            case null -> null;
            case APPLE_PAY -> "Apple Pay";
            case GOOGLE_PAY -> "Google Pay";
            case CARD -> BRAND_NAMES.get(row.methodBrand()) + " •••• " + row.methodLast4();
        };
        String methodLabel;
        if (row.creditsApplied().signum() > 0 && row.cardAmount().signum() > 0) {
            methodLabel = "UniHop Cash + " + savedMethodLabel;
        } else if (row.creditsApplied().signum() > 0) {
            methodLabel = "UniHop Cash";
        } else {
            methodLabel = savedMethodLabel;
        }
        return new PaymentSummary(row.paymentStatus(), methodLabel, row.creditsApplied(), row.cardAmount(),
                row.amountTotal(), row.declineCode());
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal moneyOrNull(BigDecimal amount) {
        return amount == null ? null : money(amount);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private record ReceiptRow(
            UUID id,
            UUID riderId,
            UUID driverId,
            RideStatus status,
            String pickupHubName,
            String dropoffHubName,
            FareBreakdown fare,
            String driverName,
            String riderName,
            Instant startedAt,
            Instant completedAt,
            PaymentStatus paymentStatus,
            BigDecimal amountTotal,
            BigDecimal creditsApplied,
            BigDecimal cardAmount,
            DeclineCode declineCode,
            PaymentMethodType methodType,
            CardBrand methodBrand,
            String methodLast4
    ) {
    }
}
