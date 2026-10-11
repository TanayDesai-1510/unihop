package com.unihop.payments;

import com.unihop.common.ApiException;
import com.unihop.common.enums.CardBrand;
import com.unihop.common.enums.PaymentMethodType;
import com.unihop.common.enums.RideStatus;
import com.unihop.records.RideSummary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EarningsService {
    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final Map<CardBrand, String> BRAND_NAMES = Map.of(
            CardBrand.VISA, "Visa",
            CardBrand.MASTERCARD, "Mastercard",
            CardBrand.AMEX, "Amex",
            CardBrand.DISCOVER, "Discover");

    private final JdbcTemplate jdbc;
    private final PaymentGateway gateway;

    public EarningsService(JdbcTemplate jdbc, PaymentGateway gateway) {
        this.jdbc = jdbc;
        this.gateway = gateway;
    }

    @Transactional(readOnly = true)
    public Earnings get(UUID driverId) {
        requireUser(driverId, false);
        Totals totals = totals(driverId);
        List<RideSummary> rides = jdbc.query("""
                SELECT r.id, r.status, pickup.name AS pickup_name, dropoff.name AS dropoff_name,
                       r.fare_total, r.driver_payout, r.completed_at, r.requested_at
                FROM rides r
                JOIN hubs pickup ON pickup.id = r.pickup_hub_id
                JOIN hubs dropoff ON dropoff.id = r.dropoff_hub_id
                WHERE r.driver_id = ? AND r.status = 'COMPLETED'
                ORDER BY r.requested_at DESC, r.id DESC
                """, (rs, row) -> new RideSummary(
                rs.getObject("id", UUID.class),
                RideStatus.valueOf(rs.getString("status")),
                rs.getString("pickup_name"),
                rs.getString("dropoff_name"),
                money(rs.getBigDecimal("fare_total")),
                money(rs.getBigDecimal("driver_payout")),
                rs.getTimestamp("completed_at") == null ? null : rs.getTimestamp("completed_at").toInstant(),
                rs.getTimestamp("requested_at").toInstant()), driverId);
        return new Earnings(totals.balance(), totals.today(), totals.week(), totals.total(), rides);
    }

    @Transactional
    public CashoutResult cashOut(UUID driverId, UUID paymentMethodId) {
        requireUser(driverId, true);
        BigDecimal balance = totals(driverId).balance();
        if (balance.signum() <= 0) {
            throw ApiException.conflict("NOTHING_TO_CASH_OUT", "Your balance is $0.00");
        }
        SavedMethod method = resolveMethod(driverId, paymentMethodId);

        UUID payoutId = UUID.randomUUID();
        gateway.payout(method.gatewayToken(), balance, "cashout-" + payoutId);
        jdbc.update("""
                INSERT INTO driver_earnings
                    (id, driver_id, type, amount, payment_method_id)
                VALUES (?, ?, 'PAYOUT', ?, ?)
                """, payoutId, driverId, balance.negate(), method.id());
        return new CashoutResult(ZERO, balance, method.label());
    }

    private Totals totals(UUID driverId) {
        return jdbc.queryForObject("""
                SELECT
                    COALESCE(sum(amount), 0) AS balance,
                    COALESCE(sum(amount) FILTER (
                        WHERE type = 'RIDE_EARNING'
                          AND (created_at AT TIME ZONE 'America/New_York')::date =
                              (now() AT TIME ZONE 'America/New_York')::date), 0) AS today,
                    COALESCE(sum(amount) FILTER (
                        WHERE type = 'RIDE_EARNING'
                          AND date_trunc('week', created_at AT TIME ZONE 'America/New_York') =
                              date_trunc('week', now() AT TIME ZONE 'America/New_York')), 0) AS week,
                    COALESCE(sum(amount) FILTER (WHERE type = 'RIDE_EARNING'), 0) AS total
                FROM driver_earnings
                WHERE driver_id = ?
                """, (rs, row) -> new Totals(
                money(rs.getBigDecimal("balance")),
                money(rs.getBigDecimal("today")),
                money(rs.getBigDecimal("week")),
                money(rs.getBigDecimal("total"))), driverId);
    }

    private SavedMethod resolveMethod(UUID driverId, UUID paymentMethodId) {
        List<SavedMethod> methods = jdbc.query("""
                SELECT id, type, brand, last4, gateway_token
                FROM payment_methods
                WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                FOR UPDATE
                """, (rs, row) -> {
            PaymentMethodType type = PaymentMethodType.valueOf(rs.getString("type"));
            CardBrand brand = CardBrand.valueOf(rs.getString("brand"));
            String last4 = rs.getString("last4").trim();
            String label = switch (type) {
                case APPLE_PAY -> "Apple Pay";
                case GOOGLE_PAY -> "Google Pay";
                case CARD -> BRAND_NAMES.get(brand) + " •••• " + last4;
            };
            return new SavedMethod(rs.getObject("id", UUID.class), rs.getString("gateway_token"), label);
        }, paymentMethodId, driverId);
        if (methods.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Payment method not found");
        }
        return methods.getFirst();
    }

    private void requireUser(UUID userId, boolean lock) {
        String suffix = lock ? " FOR UPDATE" : "";
        if (jdbc.queryForList("SELECT id FROM users WHERE id = ?" + suffix, UUID.class, userId).isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "User not found");
        }
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private record Totals(BigDecimal balance, BigDecimal today, BigDecimal week, BigDecimal total) {
    }

    private record SavedMethod(UUID id, String gatewayToken, String label) {
    }
}
