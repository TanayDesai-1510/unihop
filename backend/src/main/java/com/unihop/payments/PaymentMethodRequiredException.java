package com.unihop.payments;

import com.unihop.common.ApiException;
import org.springframework.http.HttpStatus;

/** 402 PAYMENT_METHOD_REQUIRED: no usable payment method and credits do not cover the fare. */
public class PaymentMethodRequiredException extends ApiException {

    public PaymentMethodRequiredException() {
        super(HttpStatus.PAYMENT_REQUIRED, "PAYMENT_METHOD_REQUIRED", "Add a payment method to request this ride");
    }
}
