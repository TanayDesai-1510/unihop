package com.unihop.driver;

import com.unihop.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/drivers")
public class DriverOnboardingController {
    public record OnboardRequest(@NotBlank @Size(max = 32) String licenseNumber,
                                 @NotBlank @Size(max = 50) String carMake,
                                 @NotBlank @Size(max = 50) String carModel,
                                 @NotBlank @Size(max = 30) String carColor,
                                 @NotBlank @Size(max = 16) String plate) {}
    private final CurrentUser currentUser;
    private final DriverOnboardingService drivers;
    public DriverOnboardingController(CurrentUser currentUser, DriverOnboardingService drivers) {
        this.currentUser = currentUser; this.drivers = drivers;
    }
    @GetMapping("/me") public DriverProfile get() { return drivers.get(currentUser.id()); }
    @PostMapping("/onboard") public DriverProfile onboard(@Valid @RequestBody OnboardRequest body) {
        return drivers.onboard(currentUser.id(), body.licenseNumber(), body.carMake(), body.carModel(),
                body.carColor(), body.plate());
    }
}
