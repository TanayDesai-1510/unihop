package com.unihop.auth;

import com.unihop.common.ApiException;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.assertj.core.api.Assertions.*;

class OtpServiceTest {
    private static final String EMAIL = "new@scarletmail.rutgers.edu";
    static class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-11T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
    @Test void expiresAtTenMinutesAndCannotBeReplayed() {
        TestClock clock = new TestClock();
        OtpService service = new OtpService(clock);
        String code = service.request(EMAIL);
        assertThat(code).matches("[0-9]{6}");
        clock.now = clock.now.plusSeconds(599);
        service.verify(EMAIL, code);
        assertThatThrownBy(() -> service.verify(EMAIL, code)).isInstanceOf(ApiException.class);
        String expired = service.request(EMAIL);
        clock.now = clock.now.plusSeconds(600);
        assertThatThrownBy(() -> service.verify(EMAIL, expired)).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("INVALID_OTP");
    }
    @Test void wrongCodeDoesNotAuthenticate() {
        OtpService service = new OtpService();
        service.request(EMAIL);
        assertThatThrownBy(() -> service.verify(EMAIL, "wrong")).isInstanceOf(ApiException.class);
    }
    @Test void normalizesAndRejectsOtherDomains() {
        assertThat(OtpService.normalizeEmail(" NEW@SCARLETMAIL.RUTGERS.EDU ")).isEqualTo(EMAIL);
        for (String email : new String[]{"x@gmail.com", "x@scarletmail.rutgers.edu.evil.com", "@scarletmail.rutgers.edu"}) {
            assertThatThrownBy(() -> OtpService.normalizeEmail(email)).isInstanceOf(ApiException.class)
                    .extracting("code").isEqualTo("INVALID_EMAIL_DOMAIN");
        }
    }
}
