package com.unihop.payments;

import java.math.BigDecimal;

/** Contract DTO returned after an instant driver payout. */
public record CashoutResult(
        BigDecimal balance,
        BigDecimal payoutAmount,
        String methodLabel
) {
}
