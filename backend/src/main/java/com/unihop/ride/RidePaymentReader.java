package com.unihop.ride;

import com.unihop.common.enums.DeclineCode;
import com.unihop.common.enums.PaymentStatus;
import com.unihop.payments.PaymentSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds {@code Ride.payment} for reads. {@link com.unihop.payments.PaymentService} has no read method, so this reads
 * Hriday's {@code ride_payments} / {@code payment_methods} tables (read-only) and formats {@code methodLabel} per
 * contract section 5.
 */
@Component
@RequiredArgsConstructor
class RidePaymentReader {

    static final String UNIHOP_CASH = "UniHop Cash";

    private static final Map<String, String> BRAND_NAMES = Map.of(
            "VISA", "Visa", "MASTERCARD", "Mastercard", "AMEX", "Amex", "DISCOVER", "Discover");

    private final JdbcTemplate jdbc;

    PaymentSummary summary(RideRow ride) {
        List<PaymentSummary> rows = jdbc.query("""
                SELECT rp.*, pm.type, pm.brand, pm.last4
                FROM ride_payments rp LEFT JOIN payment_methods pm ON pm.id = rp.payment_method_id
                WHERE rp.ride_id = ?""", (rs, i) -> {
            BigDecimal credits = rs.getBigDecimal("credits_applied");
            BigDecimal card = rs.getBigDecimal("card_amount");
            String method = rs.getString("type") == null ? null
                    : methodLabel(rs.getString("type"), rs.getString("brand"), rs.getString("last4"));
            String decline = rs.getString("decline_code");
            return new PaymentSummary(PaymentStatus.valueOf(rs.getString("status")), label(credits, card, method),
                    credits, card, rs.getBigDecimal("amount_total"), decline == null ? null : DeclineCode.valueOf(decline));
        }, ride.id());
        return rows.isEmpty() ? withoutPaymentRow(ride) : rows.get(0);
    }

    /**
     * Only reachable while {@code StubPaymentService} is active: it authorizes without writing {@code ride_payments}.
     * Mirrors what the stub returned: the whole fare on the rider's default method.
     */
    private PaymentSummary withoutPaymentRow(RideRow ride) {
        List<String> method = jdbc.query("""
                SELECT type, brand, last4 FROM payment_methods
                WHERE user_id = ? AND is_default AND deleted_at IS NULL""",
                (rs, i) -> methodLabel(rs.getString("type"), rs.getString("brand"), rs.getString("last4")), ride.riderId());
        PaymentStatus status = switch (ride.status()) {
            case COMPLETED -> PaymentStatus.CAPTURED;
            case CANCELLED, NO_DRIVERS -> PaymentStatus.VOIDED;
            default -> PaymentStatus.AUTHORIZED;
        };
        BigDecimal total = ride.fare().total();
        return new PaymentSummary(status, method.isEmpty() ? "Card" : method.get(0),
                BigDecimal.ZERO.setScale(2), total, total, null);
    }

    static String label(BigDecimal creditsApplied, BigDecimal cardAmount, String methodLabel) {
        boolean credits = creditsApplied != null && creditsApplied.signum() > 0;
        boolean card = cardAmount != null && cardAmount.signum() > 0 && methodLabel != null;
        if (credits && card) {
            return UNIHOP_CASH + " + " + methodLabel;
        }
        if (credits || methodLabel == null) {
            return UNIHOP_CASH;
        }
        return methodLabel;
    }

    static String methodLabel(String type, String brand, String last4) {
        return switch (type) {
            case "APPLE_PAY" -> "Apple Pay";
            case "GOOGLE_PAY" -> "Google Pay";
            default -> BRAND_NAMES.getOrDefault(brand, brand) + " •••• " + last4;
        };
    }
}
