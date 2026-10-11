package com.unihop.mockpay;

import com.unihop.common.enums.CardBrand;
import com.unihop.common.enums.PaymentMethodType;

public record CardToken(String token, CardBrand brand, String last4, int expMonth, int expYear,
                        PaymentMethodType walletType) {}
