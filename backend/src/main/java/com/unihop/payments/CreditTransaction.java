package com.unihop.payments;

import com.unihop.common.enums.CreditTxnType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Contract DTO for one UniHop Cash ledger entry. */
public record CreditTransaction(
        UUID id,
        CreditTxnType type,
        BigDecimal amount,
        UUID rideId,
        Instant createdAt
) {
}
