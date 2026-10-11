package com.unihop.payments;

import com.unihop.common.enums.CardBrand;
import com.unihop.common.enums.PaymentMethodType;

import java.util.UUID;

/** Contract DTO for a rider or driver's saved payment method. */
public record PaymentMethod(
        UUID id,
        PaymentMethodType type,
        CardBrand brand,
        String last4,
        int expMonth,
        int expYear,
        String nickname,
        boolean isDefault,
        String label
) {
}

