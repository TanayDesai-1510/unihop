package com.unihop.payments;

import com.unihop.common.ApiException;
import com.unihop.common.enums.CardBrand;
import com.unihop.common.enums.PaymentMethodType;
import com.unihop.common.enums.PaymentStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RealPaymentService implements PaymentService {
    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final Map<CardBrand, String> BRAND_NAMES = Map.of(
            CardBrand.VISA, "Visa",
            CardBrand.MASTERCARD, "Mastercard",
            CardBrand.AMEX, "Amex",
            CardBrand.DISCOVER, "Discover");

    private final JdbcTemplate jdbc;
    private final PaymentGateway gateway;

    public RealPaymentService(JdbcTemplate jdbc, PaymentGateway gateway) {
        this.jdbc = jdbc;
        this.gateway = gateway;
    }

    @Override
    @Transactional
    public PaymentSummary authorizeRide(UUID rideId, UUID riderId, UUID paymentMethodId,
                                        boolean useCredits, BigDecimal amount) {
        // The ride row may not be visible yet when a caller uses deferred FK insertion, so use a
        // transaction-scoped advisory lock to serialize retries before looking for the payment row.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rideId.toString());
        List<PaymentRow> existing = paymentForUpdate(rideId);
        if (!existing.isEmpty()) {
            return summary(existing.getFirst());
        }
        lockUser(riderId);
        BigDecimal total = money(amount);
        if (total.signum() <= 0) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Payment amount must be positive");
        }

        BigDecimal balance = jdbc.queryForObject("""
                SELECT COALESCE(sum(amount), 0) FROM credit_transactions WHERE user_id = ?
                """, BigDecimal.class, riderId);
        BigDecimal usableBalance = balance == null || balance.signum() < 0 ? ZERO : money(balance);
        BigDecimal creditsApplied = useCredits ? usableBalance.min(total) : ZERO;
        BigDecimal cardAmount = money(total.subtract(creditsApplied));

        SavedMethod method = null;
        String gatewayRef = null;
        if (cardAmount.signum() > 0) {
            method = resolveMethod(riderId, paymentMethodId);
            gatewayRef = gateway.authorize(method.gatewayToken(), cardAmount, rideId.toString());
        }

        if (creditsApplied.signum() > 0) {
            jdbc.update("""
                    INSERT INTO credit_transactions (id, user_id, ride_id, type, amount)
                    VALUES (?, ?, ?, 'RIDE_SPEND', ?)
                    """, UUID.randomUUID(), riderId, rideId, creditsApplied.negate());
        }
        UUID storedMethodId = method == null ? null : method.id();
        jdbc.update("""
                INSERT INTO ride_payments
                    (id, ride_id, user_id, payment_method_id, amount_total, credits_applied,
                     card_amount, status, gateway_ref, authorized_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'AUTHORIZED', ?, now())
                """, UUID.randomUUID(), rideId, riderId, storedMethodId, total, creditsApplied,
                cardAmount, gatewayRef);
        return new PaymentSummary(PaymentStatus.AUTHORIZED,
                combinedLabel(creditsApplied, cardAmount, method == null ? null : method.label()),
                creditsApplied, cardAmount, total, null);
    }

    @Override
    @Transactional
    public void captureRide(UUID rideId) {
        PaymentRow payment = requirePaymentForUpdate(rideId);
        if (payment.status() == PaymentStatus.CAPTURED) {
            return;
        }
        if (payment.status() != PaymentStatus.AUTHORIZED) {
            throw ApiException.conflict("INVALID_TRANSITION", "Payment cannot be captured");
        }
        List<RidePayout> rides = jdbc.query("""
                SELECT driver_id, driver_payout FROM rides WHERE id = ? FOR UPDATE
                """, (rs, row) -> new RidePayout(
                rs.getObject("driver_id", UUID.class), rs.getBigDecimal("driver_payout")), rideId);
        if (rides.isEmpty() || rides.getFirst().driverId() == null) {
            throw ApiException.conflict("INVALID_TRANSITION", "Ride has no assigned driver");
        }
        RidePayout ride = rides.getFirst();
        // Serialize new earnings with whole-balance cash-outs for this driver.
        lockUser(ride.driverId());
        if (payment.gatewayRef() != null) {
            gateway.capture(payment.gatewayRef());
        }
        jdbc.update("""
                INSERT INTO driver_earnings (id, driver_id, ride_id, type, amount)
                VALUES (?, ?, ?, 'RIDE_EARNING', ?)
                """, UUID.randomUUID(), ride.driverId(), rideId, money(ride.driverPayout()));
        jdbc.update("""
                UPDATE ride_payments SET status = 'CAPTURED', captured_at = now()
                WHERE ride_id = ?
                """, rideId);
    }

    @Override
    @Transactional
    public void voidRide(UUID rideId) {
        PaymentRow payment = requirePaymentForUpdate(rideId);
        if (payment.status() == PaymentStatus.VOIDED) {
            return;
        }
        if (payment.status() != PaymentStatus.AUTHORIZED) {
            throw ApiException.conflict("INVALID_TRANSITION", "Payment cannot be voided");
        }
        if (payment.gatewayRef() != null) {
            gateway.voidAuthorization(payment.gatewayRef());
        }
        if (payment.creditsApplied().signum() > 0) {
            jdbc.update("""
                    INSERT INTO credit_transactions (id, user_id, ride_id, type, amount)
                    VALUES (?, ?, ?, 'RIDE_REFUND', ?)
                    """, UUID.randomUUID(), payment.userId(), rideId, payment.creditsApplied());
        }
        jdbc.update("""
                UPDATE ride_payments SET status = 'VOIDED', voided_at = now()
                WHERE ride_id = ?
                """, rideId);
    }

    private SavedMethod resolveMethod(UUID riderId, UUID requestedId) {
        List<SavedMethod> methods;
        if (requestedId == null) {
            methods = jdbc.query("""
                    SELECT id, type, brand, last4, gateway_token
                    FROM payment_methods
                    WHERE user_id = ? AND deleted_at IS NULL AND is_default
                    LIMIT 1
                    """, RealPaymentService::mapMethod, riderId);
        } else {
            methods = jdbc.query("""
                    SELECT id, type, brand, last4, gateway_token
                    FROM payment_methods
                    WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                    """, RealPaymentService::mapMethod, requestedId, riderId);
        }
        if (methods.isEmpty()) {
            throw new PaymentMethodRequiredException();
        }
        return methods.getFirst();
    }

    private static SavedMethod mapMethod(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        PaymentMethodType type = PaymentMethodType.valueOf(rs.getString("type"));
        CardBrand brand = CardBrand.valueOf(rs.getString("brand"));
        String last4 = rs.getString("last4").trim();
        String label = switch (type) {
            case APPLE_PAY -> "Apple Pay";
            case GOOGLE_PAY -> "Google Pay";
            case CARD -> BRAND_NAMES.get(brand) + " •••• " + last4;
        };
        return new SavedMethod(rs.getObject("id", UUID.class), rs.getString("gateway_token"), label);
    }

    private List<PaymentRow> paymentForUpdate(UUID rideId) {
        return jdbc.query("""
                SELECT rp.*, pm.type, pm.brand, pm.last4
                FROM ride_payments rp
                LEFT JOIN payment_methods pm ON pm.id = rp.payment_method_id
                WHERE rp.ride_id = ? FOR UPDATE OF rp
                """, (rs, row) -> {
            String type = rs.getString("type");
            String methodLabel = null;
            if (type != null) {
                PaymentMethodType methodType = PaymentMethodType.valueOf(type);
                CardBrand brand = CardBrand.valueOf(rs.getString("brand"));
                String last4 = rs.getString("last4").trim();
                methodLabel = switch (methodType) {
                    case APPLE_PAY -> "Apple Pay";
                    case GOOGLE_PAY -> "Google Pay";
                    case CARD -> BRAND_NAMES.get(brand) + " •••• " + last4;
                };
            }
            return new PaymentRow(
                    rs.getObject("user_id", UUID.class),
                    PaymentStatus.valueOf(rs.getString("status")),
                    money(rs.getBigDecimal("amount_total")),
                    money(rs.getBigDecimal("credits_applied")),
                    money(rs.getBigDecimal("card_amount")),
                    rs.getString("gateway_ref"),
                    methodLabel);
        }, rideId);
    }

    private PaymentRow requirePaymentForUpdate(UUID rideId) {
        List<PaymentRow> payments = paymentForUpdate(rideId);
        if (payments.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Ride payment not found");
        }
        return payments.getFirst();
    }

    private void lockUser(UUID userId) {
        if (jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, userId).isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "User not found");
        }
    }

    private static PaymentSummary summary(PaymentRow payment) {
        return new PaymentSummary(payment.status(),
                combinedLabel(payment.creditsApplied(), payment.cardAmount(), payment.methodLabel()),
                payment.creditsApplied(), payment.cardAmount(), payment.amountTotal(), null);
    }

    private static String combinedLabel(BigDecimal credits, BigDecimal card, String methodLabel) {
        if (credits.signum() > 0 && card.signum() > 0) {
            return "UniHop Cash + " + methodLabel;
        }
        if (credits.signum() > 0) {
            return "UniHop Cash";
        }
        return methodLabel;
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private record SavedMethod(UUID id, String gatewayToken, String label) {
    }

    private record RidePayout(UUID driverId, BigDecimal driverPayout) {
    }

    private record PaymentRow(UUID userId, PaymentStatus status, BigDecimal amountTotal,
                              BigDecimal creditsApplied, BigDecimal cardAmount, String gatewayRef,
                              String methodLabel) {
    }
}
