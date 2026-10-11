package com.unihop.mockpay;

import com.unihop.common.ApiException;
import com.unihop.common.enums.DeclineCode;
import com.unihop.payments.PaymentDeclinedException;
import com.unihop.payments.PaymentGateway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
public class MockPaymentGateway implements PaymentGateway {
    private record Charge(String id, String token, BigDecimal amount, String status) {}
    private final JdbcTemplate jdbc;
    private final ProcessorLatency latency;
    public MockPaymentGateway(JdbcTemplate jdbc, ProcessorLatency latency) { this.jdbc = jdbc; this.latency = latency; }

    @Override @Transactional
    public String authorize(String token, BigDecimal amount, String idempotencyKey) {
        latency.pause();
        return create(token, amount, idempotencyKey, "AUTHORIZED");
    }
    @Override @Transactional
    public String payout(String token, BigDecimal amount, String idempotencyKey) {
        latency.pause();
        return create(token, amount, idempotencyKey, "PAID_OUT");
    }
    private String create(String token, BigDecimal amount, String key, String status) {
        if (token == null || key == null || key.isBlank() || key.length() > 128 || amount == null) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Token, amount and idempotency key are required");
        }
        BigDecimal rounded = amount.setScale(2, RoundingMode.HALF_UP);
        if (rounded.signum() <= 0 || rounded.compareTo(new BigDecimal("999999.99")) > 0) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Amount must be positive and within processor limits");
        }
        // Serialize competing requests for the same key, including requests from other app instances.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", key);
        var existing = jdbc.query("SELECT * FROM mockpay_charges WHERE idempotency_key = ?", (rs, row) ->
                new Charge(rs.getString("id"), rs.getString("token"), rs.getBigDecimal("amount"), rs.getString("status")), key);
        if (!existing.isEmpty()) {
            Charge charge = existing.getFirst();
            if (!charge.token().equals(token) || charge.amount().compareTo(rounded) != 0
                    || status.equals("PAID_OUT") != charge.status().equals("PAID_OUT")) {
                throw ApiException.badRequest("VALIDATION_ERROR", "Idempotency key already used for a different request");
            }
            return charge.id();
        }
        var behaviors = jdbc.queryForList("SELECT behavior FROM mockpay_vault WHERE token = ?", String.class, token);
        if (behaviors.isEmpty()) throw ApiException.notFound("NOT_FOUND", "Token not found");
        if (status.equals("AUTHORIZED") && !behaviors.getFirst().equals("SUCCESS")) {
            throw new PaymentDeclinedException(DeclineCode.valueOf(behaviors.getFirst()));
        }
        String id = (status.equals("PAID_OUT") ? "po_" : "pi_") + UUID.randomUUID();
        jdbc.update("INSERT INTO mockpay_charges (id, token, amount, status, idempotency_key) VALUES (?, ?, ?, ?, ?)",
                id, token, rounded, status, key);
        return id;
    }
    @Override @Transactional
    public void capture(String chargeId) { latency.pause(); transition(chargeId, "CAPTURED"); }
    @Override @Transactional
    public void voidAuthorization(String chargeId) { latency.pause(); transition(chargeId, "VOIDED"); }
    private void transition(String id, String target) {
        var statuses = jdbc.queryForList("SELECT status FROM mockpay_charges WHERE id = ? FOR UPDATE", String.class, id);
        if (statuses.isEmpty()) throw ApiException.notFound("NOT_FOUND", "Charge not found");
        String current = statuses.getFirst();
        if (current.equals(target)) return;
        if (!current.equals("AUTHORIZED")) throw ApiException.conflict("INVALID_TRANSITION", "Charge cannot transition to " + target);
        jdbc.update("UPDATE mockpay_charges SET status = ?, updated_at = now() WHERE id = ?", target, id);
    }
}
