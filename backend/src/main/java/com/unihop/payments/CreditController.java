package com.unihop.payments;

import com.unihop.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/credits")
public class CreditController {
    public record TopUpRequest(
            @NotNull BigDecimal amount,
            @NotNull UUID paymentMethodId
    ) {
    }

    private final CurrentUser currentUser;
    private final CreditService credits;

    public CreditController(CurrentUser currentUser, CreditService credits) {
        this.currentUser = currentUser;
        this.credits = credits;
    }

    @GetMapping
    public Credits get() {
        return credits.get(currentUser.id());
    }

    @PostMapping("/topup")
    public Credits topUp(@Valid @RequestBody TopUpRequest body) {
        return credits.topUp(currentUser.id(), body.amount(), body.paymentMethodId());
    }
}
