package com.unihop.payments;

import com.unihop.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/me/earnings")
public class EarningsController {
    public record CashoutRequest(@NotNull UUID paymentMethodId) {
    }

    private final CurrentUser currentUser;
    private final EarningsService earnings;

    public EarningsController(CurrentUser currentUser, EarningsService earnings) {
        this.currentUser = currentUser;
        this.earnings = earnings;
    }

    @GetMapping
    public Earnings get() {
        return earnings.get(currentUser.id());
    }

    @PostMapping("/cashout")
    public CashoutResult cashOut(@Valid @RequestBody CashoutRequest body) {
        return earnings.cashOut(currentUser.id(), body.paymentMethodId());
    }
}
