package com.unihop.payments;

import java.math.BigDecimal;

/** Approved gateway contract; all card references are vault tokens. */
public interface PaymentGateway {
    String authorize(String token, BigDecimal amount, String idempotencyKey);
    void capture(String chargeId);
    void voidAuthorization(String chargeId);
    String payout(String token, BigDecimal amount, String idempotencyKey);
}
