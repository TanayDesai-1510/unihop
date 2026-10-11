package com.unihop.mockpay;

import com.unihop.common.enums.PaymentMethodType;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/mockpay/v1")
public class MockPayController {
    public record CardRequest(String number, Integer expMonth, Integer expYear, String cvc) {
        @Override public String toString() { return "CardRequest[REDACTED]"; }
    }
    public record WalletRequest(PaymentMethodType walletType) {}
    private final TokenService tokens;
    public MockPayController(TokenService tokens) { this.tokens = tokens; }
    @PostMapping("/tokens") public CardToken tokenize(@RequestBody CardRequest body) {
        return tokens.tokenize(body.number(), body.expMonth(), body.expYear(), body.cvc());
    }
    @PostMapping("/wallet-tokens") public CardToken wallet(@RequestBody WalletRequest body) {
        return tokens.wallet(body.walletType());
    }
}
