package com.unihop.auth;

import com.unihop.common.ApiException;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.Duration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Demo OTPs live in this process; issuing a new code replaces the previous code. */
@Service
public class OtpService {
    private record Challenge(String code, Instant expiresAt) {}
    private final Map<String, Challenge> challenges = new HashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final Clock clock;

    public OtpService() { this(Clock.systemUTC()); }
    OtpService(Clock clock) { this.clock = clock; }

    public static String normalizeEmail(String email) {
        if (email == null || email.isBlank()) throw ApiException.badRequest("VALIDATION_ERROR", "Email is required");
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 255 || !normalized.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@scarletmail\\.rutgers\\.edu")) {
            throw ApiException.badRequest("INVALID_EMAIL_DOMAIN", "Use your @scarletmail.rutgers.edu email");
        }
        return normalized;
    }

    public synchronized String request(String email) {
        email = normalizeEmail(email);
        Instant now = clock.instant();
        challenges.values().removeIf(challenge -> !challenge.expiresAt().isAfter(now));
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
        challenges.put(email, new Challenge(code, now.plus(Duration.ofMinutes(10))));
        return code;
    }

    public synchronized void verify(String email, String otp) {
        email = normalizeEmail(email);
        Challenge challenge = challenges.get(email);
        if (challenge == null || !challenge.expiresAt().isAfter(clock.instant()) || !challenge.code().equals(otp)) {
            if (challenge != null && !challenge.expiresAt().isAfter(clock.instant())) challenges.remove(email);
            throw ApiException.badRequest("INVALID_OTP", "Wrong or expired OTP");
        }
        challenges.remove(email);
    }
}
