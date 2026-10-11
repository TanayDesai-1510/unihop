package com.unihop.auth;

import com.unihop.common.ApiException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Verifies signed access tokens before exposing their user subject. */
@Component
public class JwtSubjectReader {
    private final JwtParser parser;

    public JwtSubjectReader(@Value("${app.jwt.secret}") String secret) {
        parser = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .build();
    }

    public UUID subject(String token) {
        try {
            var jwt = parser.parseSignedClaims(token);
            if (!"HS256".equals(jwt.getHeader().getAlgorithm()) || jwt.getPayload().getExpiration() == null) {
                throw ApiException.unauthorized("Invalid access token");
            }
            String subject = jwt.getPayload().getSubject();
            UUID id = UUID.fromString(subject);
            if (!id.toString().equalsIgnoreCase(subject)) {
                throw ApiException.unauthorized("Invalid access token");
            }
            return id;
        } catch (JwtException | IllegalArgumentException | NullPointerException e) {
            throw ApiException.unauthorized("Invalid access token");
        }
    }
}
