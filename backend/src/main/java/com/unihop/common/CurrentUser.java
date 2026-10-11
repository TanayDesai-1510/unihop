package com.unihop.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

/**
 * Cross-team interface (contract section 1). Signature {@code UUID id()} is frozen.
 * <p>
 * Scaffold behavior: reads the {@code X-Demo-User} header (a user UUID) when {@code app.auth.demo-header=true}.
 * Hriday adds JWT subject lookup first (issue "CurrentUser with JWT subject"), keeping this header as the fallback.
 */
@Component
public class CurrentUser {

    public static final String DEMO_HEADER = "X-Demo-User";

    private final boolean demoHeaderEnabled;

    public CurrentUser(@Value("${app.auth.demo-header:false}") boolean demoHeaderEnabled) {
        this.demoHeaderEnabled = demoHeaderEnabled;
    }

    public UUID id() {
        HttpServletRequest request = currentRequest();
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
