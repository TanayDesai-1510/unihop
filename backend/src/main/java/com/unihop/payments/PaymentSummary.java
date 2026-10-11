package com.unihop.payments;

import com.unihop.common.enums.DeclineCode;
import com.unihop.common.enums.PaymentStatus;

import java.math.BigDecimal;

/**
 * Contract DTO {@code PaymentSummary}. Frozen (cross-team).
 */
public record PaymentSummary(
        PaymentStatus status,
        String methodLabel,
        BigDecimal creditsApplied,
        BigDecimal cardAmount,
        BigDecimal amountTotal,
        DeclineCode declineCode
) {
}
