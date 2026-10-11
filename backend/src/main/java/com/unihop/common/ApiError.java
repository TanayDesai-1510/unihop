package com.unihop.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.unihop.common.enums.DeclineCode;

/** Error body from contract section 2. {@code declineCode} only appears on 402 PAYMENT_DECLINED. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String error, String message, DeclineCode declineCode) {

    public ApiError(String error, String message) {
        this(error, message, null);
    }
}
