package com.unihop.payments;

import com.unihop.common.ApiException;
import com.unihop.common.enums.CardBrand;
import com.unihop.common.enums.PaymentMethodType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentMethodService {
    private static final Map<CardBrand, String> BRAND_NAMES = Map.of(
            CardBrand.VISA, "Visa",
            CardBrand.MASTERCARD, "Mastercard",
            CardBrand.AMEX, "Amex",
            CardBrand.DISCOVER, "Discover");

    private final JdbcTemplate jdbc;

    public PaymentMethodService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PaymentMethod> list(UUID userId) {
        return jdbc.query("""
                SELECT id, type, brand, last4, exp_month, exp_year, nickname, is_default
                FROM payment_methods
                WHERE user_id = ? AND deleted_at IS NULL
                ORDER BY is_default DESC, created_at DESC, id DESC
                """, (rs, row) -> map(
                rs.getObject("id", UUID.class),
                PaymentMethodType.valueOf(rs.getString("type")),
                CardBrand.valueOf(rs.getString("brand")),
                rs.getString("last4").trim(),
                rs.getInt("exp_month"),
                rs.getInt("exp_year"),
                rs.getString("nickname"),
                rs.getBoolean("is_default")), userId);
    }

    @Transactional
    public PaymentMethod add(UUID userId, String token, String nickname) {
        lockUser(userId);
        List<VaultMethod> vaultRows = jdbc.query("""
                SELECT brand, last4, exp_month, exp_year, wallet_type
                FROM mockpay_vault WHERE token = ?
                """, (rs, row) -> new VaultMethod(
                CardBrand.valueOf(rs.getString("brand")),
                rs.getString("last4").trim(),
                rs.getInt("exp_month"),
                rs.getInt("exp_year"),
                rs.getString("wallet_type")), token);
        if (vaultRows.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Payment token not found");
        }
        VaultMethod vault = vaultRows.getFirst();
        Integer duplicates = jdbc.queryForObject("""
                SELECT count(*) FROM payment_methods
                WHERE user_id = ? AND brand = ? AND last4 = ? AND exp_month = ? AND exp_year = ?
                    AND deleted_at IS NULL
                """, Integer.class, userId, vault.brand().name(), vault.last4(), vault.expMonth(), vault.expYear());
        if (duplicates != null && duplicates > 0) {
            throw ApiException.conflict("DUPLICATE_PAYMENT_METHOD", "That payment method is already saved");
        }

        Boolean hasMethod = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM payment_methods WHERE user_id = ? AND deleted_at IS NULL)
                """, Boolean.class, userId);
        boolean makeDefault = !Boolean.TRUE.equals(hasMethod);
        UUID id = UUID.randomUUID();
        PaymentMethodType type = vault.walletType() == null
                ? PaymentMethodType.CARD : PaymentMethodType.valueOf(vault.walletType());
        jdbc.update("""
                INSERT INTO payment_methods
                    (id, user_id, type, brand, last4, exp_month, exp_year, nickname, is_default, gateway_token)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, userId, type.name(), vault.brand().name(), vault.last4(), vault.expMonth(),
                vault.expYear(), normalizeNickname(nickname), makeDefault, token);
        return get(userId, id);
    }

    @Transactional
    public PaymentMethod update(UUID userId, UUID id, Boolean makeDefault,
                                boolean nicknamePresent, String nickname) {
        lockUser(userId);
        PaymentMethod current = getForUpdate(userId, id);
        if (nicknamePresent) {
            jdbc.update("UPDATE payment_methods SET nickname = ? WHERE id = ?",
                    normalizeNickname(nickname), id);
        }
        if (Boolean.TRUE.equals(makeDefault) && !current.isDefault()) {
            jdbc.update("""
                    UPDATE payment_methods SET is_default = false
                    WHERE user_id = ? AND deleted_at IS NULL AND is_default
                    """, userId);
            jdbc.update("UPDATE payment_methods SET is_default = true WHERE id = ?", id);
        }
        // A false value cannot unset the sole default without a replacement, so it is a no-op.
        return get(userId, id);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        lockUser(userId);
        PaymentMethod method = getForUpdate(userId, id);
        Boolean inUse = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM ride_payments
                    WHERE payment_method_id = ? AND status = 'AUTHORIZED'
                )
                """, Boolean.class, id);
        if (Boolean.TRUE.equals(inUse)) {
            throw ApiException.conflict("PAYMENT_METHOD_IN_USE",
                    "Payment method has an active authorization");
        }

        jdbc.update("UPDATE payment_methods SET deleted_at = now(), is_default = false WHERE id = ?", id);
        if (method.isDefault()) {
            List<UUID> replacement = jdbc.queryForList("""
                    SELECT id FROM payment_methods
                    WHERE user_id = ? AND deleted_at IS NULL
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                    """, UUID.class, userId);
            if (!replacement.isEmpty()) {
                jdbc.update("UPDATE payment_methods SET is_default = true WHERE id = ?", replacement.getFirst());
            }
        }
    }

    private PaymentMethod get(UUID userId, UUID id) {
        List<PaymentMethod> methods = jdbc.query("""
                SELECT id, type, brand, last4, exp_month, exp_year, nickname, is_default
                FROM payment_methods WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                """, (rs, row) -> map(
                rs.getObject("id", UUID.class),
                PaymentMethodType.valueOf(rs.getString("type")),
                CardBrand.valueOf(rs.getString("brand")),
                rs.getString("last4").trim(),
                rs.getInt("exp_month"),
                rs.getInt("exp_year"),
                rs.getString("nickname"),
                rs.getBoolean("is_default")), id, userId);
        if (methods.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Payment method not found");
        }
        return methods.getFirst();
    }

    private PaymentMethod getForUpdate(UUID userId, UUID id) {
        List<PaymentMethod> methods = jdbc.query("""
                SELECT id, type, brand, last4, exp_month, exp_year, nickname, is_default
                FROM payment_methods
                WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                FOR UPDATE
                """, (rs, row) -> map(
                rs.getObject("id", UUID.class),
                PaymentMethodType.valueOf(rs.getString("type")),
                CardBrand.valueOf(rs.getString("brand")),
                rs.getString("last4").trim(),
                rs.getInt("exp_month"),
                rs.getInt("exp_year"),
                rs.getString("nickname"),
                rs.getBoolean("is_default")), id, userId);
        if (methods.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Payment method not found");
        }
        return methods.getFirst();
    }

    private void lockUser(UUID userId) {
        if (jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, userId).isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "User not found");
        }
    }

    private static PaymentMethod map(UUID id, PaymentMethodType type, CardBrand brand, String last4,
                                     int expMonth, int expYear, String nickname, boolean isDefault) {
        String label = switch (type) {
            case APPLE_PAY -> "Apple Pay";
            case GOOGLE_PAY -> "Google Pay";
            case CARD -> BRAND_NAMES.get(brand) + " •••• " + last4;
        };
        return new PaymentMethod(id, type, brand, last4, expMonth, expYear, nickname, isDefault, label);
    }

    private static String normalizeNickname(String nickname) {
        if (nickname == null || nickname.isBlank()) {
            return null;
        }
        return nickname.trim();
    }

    private record VaultMethod(CardBrand brand, String last4, int expMonth, int expYear,
                               String walletType) {
    }
}

