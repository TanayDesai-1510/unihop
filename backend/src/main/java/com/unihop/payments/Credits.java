package com.unihop.payments;

import java.math.BigDecimal;
import java.util.List;

/** Contract DTO for a rider's UniHop Cash balance and ledger. */
public record Credits(
        BigDecimal balance,
        List<CreditTransaction> transactions
) {
}
