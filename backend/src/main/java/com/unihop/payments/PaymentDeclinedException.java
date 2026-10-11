package com.unihop.payments;

import com.unihop.common.ApiException;
import com.unihop.common.enums.DeclineCode;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** 402 PAYMENT_DECLINED. The error body includes {@code declineCode}. */
@Getter
public class PaymentDeclinedException extends ApiException {

    private final DeclineCode declineCode;

    public PaymentDeclinedException(DeclineCode declineCode) {
        super(HttpStatus.PAYMENT_REQUIRED, "PAYMENT_DECLINED", "Payment declined: " + declineCode);
        this.declineCode = declineCode;
    }
}
