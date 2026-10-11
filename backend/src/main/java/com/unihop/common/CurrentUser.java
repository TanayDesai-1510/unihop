package com.unihop.common;

import jakarta.servlet.http.HttpServletRequest;
import com.unihop.auth.JwtSubjectReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

/**
 * Cross-team interface (contract section 1). Signature {@code UUID id()} is frozen.
 * <p>
 * Verifies the JWT subject first; the demo header is accepted only without Authorization
 * and when {@code app.auth.demo-header=true}.
 */
@Component
public class CurrentUser {

    public static final String DEMO_HEADER = "X-Demo-User";

    private final boolean demoHeaderEnabled;
    private final JwtSubjectReader jwtSubjectReader;

    public CurrentUser(boolean demoHeaderEnabled) {
        this(demoHeaderEnabled, null);
    }

    @Autowired
    public CurrentUser(@Value("${app.auth.demo-header:false}") boolean demoHeaderEnabled,
                       JwtSubjectReader jwtSubjectReader) {
        this.demoHeaderEnabled = demoHeaderEnabled;
        this.jwtSubjectReader = jwtSubjectReader;
    }

    public UUID id() {
        HttpServletRequest request = currentRequest();
        if (request != null && request.getHeader("Authorization") != null) {
            String authorization = request.getHeader("Authorization");
            if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                    || authorization.substring(7).isBlank() || jwtSubjectReader == null) {
                throw ApiException.unauthorized("Invalid access token");
            }
            return jwtSubjectReader.subject(authorization.substring(7).trim());
        }
        if (demoHeaderEnabled && request != null) {
            String header = request.getHeader(DEMO_HEADER);
            if (header != null && !header.isBlank()) {
                try {
                    return UUID.fromString(header.trim());
                } catch (IllegalArgumentException e) {
                    throw ApiException.unauthorized(DEMO_HEADER + " must be a user UUID");
                }
            }
        }
        throw ApiException.unauthorized("Authentication required");
    }

    private static HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return attrs.getRequest();
        }
        return null;
    }
}
