package com.unihop.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenIssuerTest {
    @Test void issuesVerifiableHs256TokenWithSevenDayLifetime() {
        String secret = "test-secret-test-secret-test-secret-test-secret";
        UUID user = UUID.randomUUID();
        String token = new JwtTokenIssuer(secret).issue(user);
        var jwt = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .build().parseSignedClaims(token);
        assertThat(jwt.getHeader().getAlgorithm()).isEqualTo("HS256");
        assertThat(jwt.getPayload().getSubject()).isEqualTo(user.toString());
        assertThat(Duration.between(jwt.getPayload().getIssuedAt().toInstant(),
                jwt.getPayload().getExpiration().toInstant())).isEqualTo(Duration.ofDays(7));
        assertThat(new JwtSubjectReader(secret).subject(token)).isEqualTo(user);
    }
}
