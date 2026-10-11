package com.unihop.mockpay;

import com.unihop.common.ApiException;
import com.unihop.common.enums.CardBrand;
import com.unihop.common.enums.PaymentMethodType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.UUID;

@Service
public class TokenService {
    private final JdbcTemplate jdbc;
    private final ProcessorLatency latency;
    private final SecureRandom random = new SecureRandom();
    public TokenService(JdbcTemplate jdbc, ProcessorLatency latency) { this.jdbc = jdbc; this.latency = latency; }

    public CardToken tokenize(String number, Integer month, Integer year, String cvc) {
        latency.pause();
        var card = CardValidator.validate(number, month, year, cvc, YearMonth.now(ZoneOffset.UTC));
        return save(card.brand(), card.last4(), month, year, null, card.behavior());
    }
    public CardToken wallet(PaymentMethodType type) {
        latency.pause();
        if (type != PaymentMethodType.APPLE_PAY && type != PaymentMethodType.GOOGLE_PAY) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Wallet must be APPLE_PAY or GOOGLE_PAY");
        }
        YearMonth expiry = YearMonth.now(ZoneOffset.UTC).plusYears(3);
        return save(CardBrand.VISA, String.format(Locale.ROOT, "%04d", random.nextInt(10000)),
                expiry.getMonthValue(), expiry.getYear(), type, "SUCCESS");
    }
    private CardToken save(CardBrand brand, String last4, int month, int year, PaymentMethodType wallet, String behavior) {
        String token = "tok_" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO mockpay_vault (token, brand, last4, exp_month, exp_year, wallet_type, behavior)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, token, brand.name(), last4, month, year, wallet == null ? null : wallet.name(), behavior);
        return new CardToken(token, brand, last4, month, year, wallet);
    }
}
