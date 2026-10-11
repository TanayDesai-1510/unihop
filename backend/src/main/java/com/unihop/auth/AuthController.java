package com.unihop.auth;

import com.unihop.user.LoginUserService;
import com.unihop.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    public record RequestOtp(@NotBlank String email) {}
    public record VerifyOtp(@NotBlank String email, @NotBlank String otp, @Size(max = 100) String name) {}
    public record OtpResponse(String devOtp) {}
    public record AuthResponse(String token, User user) {}

    private final OtpService otps;
    private final LoginUserService users;
    private final JwtTokenIssuer tokens;

    public AuthController(OtpService otps, LoginUserService users, JwtTokenIssuer tokens) {
        this.otps = otps; this.users = users; this.tokens = tokens;
    }

    @PostMapping("/request-otp")
    public OtpResponse request(@Valid @RequestBody RequestOtp body) {
        return new OtpResponse(otps.request(body.email()));
    }

    @PostMapping("/verify-otp")
    public AuthResponse verify(@Valid @RequestBody VerifyOtp body) {
        String email = OtpService.normalizeEmail(body.email());
        otps.verify(email, body.otp());
        User user = users.findOrCreate(email, body.name());
        return new AuthResponse(tokens.issue(user.id()), user);
    }
}
