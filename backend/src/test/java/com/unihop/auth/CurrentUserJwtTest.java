package com.unihop.auth;

import com.unihop.common.ApiException;
import com.unihop.common.CurrentUser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class CurrentUserJwtTest {
    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret";
    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private final CurrentUser currentUser = new CurrentUser(true, new JwtSubjectReader(SECRET));

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void validJwtTakesPrecedenceOverDemoHeader() {
        request("Bearer " + token(USER.toString(), SECRET, Instant.now().plusSeconds(3600)));
        assertThat(currentUser.id()).isEqualTo(USER);
    }

    @Test
    void validJwtWorksWhenDemoHeaderIsDisabled() {
        request("Bearer " + token(USER.toString(), SECRET, Instant.now().plusSeconds(3600)));
        assertThat(new CurrentUser(false, new JwtSubjectReader(SECRET)).id()).isEqualTo(USER);
    }

    @Test
    void rejectsInvalidTokensEvenWithDemoHeader() {
        for (String token : new String[]{
                "broken", token(USER.toString(), SECRET, Instant.now().minusSeconds(60)),
                token(USER.toString(), "wrong-secret-wrong-secret-wrong-secret", Instant.now().plusSeconds(3600)),
                token("not-a-uuid", SECRET, Instant.now().plusSeconds(3600)),
                token("1-1-1-1-1", SECRET, Instant.now().plusSeconds(3600)),
                token(null, SECRET, Instant.now().plusSeconds(3600)),
                token(USER.toString(), SECRET, null)}) {
            request("Bearer " + token);
            assertUnauthorized(currentUser);
        }
    }

    @Test
    void rejectsMalformedAuthorizationInsteadOfFallingBack() {
        for (String header : new String[]{"", "Basic abc", "Bearer", "Bearer "}) {
            request(header);
            assertUnauthorized(currentUser);
        }
    }

    @Test
    void fallbackRequiresNoAuthorizationAndEnabledDemoMode() {
        request(null);
        assertThat(currentUser.id()).isEqualTo(UUID.fromString("00000000-0000-0000-0000-000000000102"));
        assertUnauthorized(new CurrentUser(false, new JwtSubjectReader(SECRET)));
        RequestContextHolder.resetRequestAttributes();
        assertUnauthorized(currentUser);
    }

    private static void assertUnauthorized(CurrentUser currentUser) {
        assertThatThrownBy(currentUser::id).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getCode()).isEqualTo("UNAUTHORIZED");
            assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        });
    }

    private static String token(String subject, String secret, Instant expiry) {
        return Jwts.builder().subject(subject)
                .expiration(expiry == null ? null : Date.from(expiry))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
    }

    private static void request(String authorization) {
        var request = new MockHttpServletRequest();
        if (authorization != null) request.addHeader("Authorization", authorization);
        request.addHeader(CurrentUser.DEMO_HEADER, "00000000-0000-0000-0000-000000000102");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
}
