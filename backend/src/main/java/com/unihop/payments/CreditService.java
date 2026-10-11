package com.unihop.payments;

import com.unihop.common.ApiException;
import com.unihop.common.enums.CreditTxnType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class CreditService {
    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final Set<BigDecimal> TOP_UP_AMOUNTS = Set.of(
            new BigDecimal("10.00"), new BigDecimal("20.00"), new BigDecimal("50.00"));

    private final JdbcTemplate jdbc;
    private final PaymentGateway gateway;

    public CreditService(JdbcTemplate jdbc, PaymentGateway gateway) {
        this.jdbc = jdbc;
        this.gateway = gateway;
    }

    @Transactional(readOnly = true)
    public Credits get(UUID userId) {
        requireUser(userId, false);
        return load(userId);
    }

    @Transactional
    public Credits topUp(UUID userId, BigDecimal requestedAmount, UUID paymentMethodId) {
        BigDecimal amount = allowedAmount(requestedAmount);
        requireUser(userId, true);
        List<String> tokens = jdbc.queryForList("""
                SELECT gateway_token FROM payment_methods
                WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                FOR UPDATE
                """, String.class, paymentMethodId, userId);
        if (tokens.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Payment method not found");
        }

        UUID transactionId = UUID.randomUUID();
        String chargeId = gateway.authorize(tokens.getFirst(), amount, "topup-" + transactionId);
        gateway.capture(chargeId);
        jdbc.update("""
                INSERT INTO credit_transactions (id, user_id, type, amount)
                VALUES (?, ?, 'TOPUP', ?)
                """, transactionId, userId, amount);
        return load(userId);
    }

    private Credits load(UUID userId) {
        BigDecimal balance = jdbc.queryForObject("""
                SELECT COALESCE(sum(amount), 0) FROM credit_transactions WHERE user_id = ?
                """, BigDecimal.class, userId);
        List<CreditTransaction> transactions = jdbc.query("""
                SELECT id, type, amount, ride_id, created_at
                FROM credit_transactions
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """, (rs, row) -> new CreditTransaction(
                rs.getObject("id", UUID.class),
                CreditTxnType.valueOf(rs.getString("type")),
                money(rs.getBigDecimal("amount")),
                rs.getObject("ride_id", UUID.class),
                rs.getTimestamp("created_at").toInstant()), userId);
        return new Credits(balance == null ? ZERO : money(balance), transactions);
    }

    private void requireUser(UUID userId, boolean lock) {
        String suffix = lock ? " FOR UPDATE" : "";
        if (jdbc.queryForList("SELECT id FROM users WHERE id = ?" + suffix, UUID.class, userId).isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "User not found");
        }
    }

    private static BigDecimal allowedAmount(BigDecimal requestedAmount) {
        if (requestedAmount == null || TOP_UP_AMOUNTS.stream().noneMatch(a -> a.compareTo(requestedAmount) == 0)) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Top-up amount must be 10, 20, or 50");
        }
        return money(requestedAmount);
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }
}
