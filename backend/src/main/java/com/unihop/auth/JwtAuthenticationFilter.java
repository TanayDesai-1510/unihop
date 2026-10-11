package com.unihop.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unihop.common.ApiError;
import com.unihop.common.ApiException;
import com.unihop.common.CurrentUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/** Installed only in the security chain, after CORS and before anonymous authentication. */
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtSubjectReader tokens;
    private final boolean demoEnabled;
    private final ObjectMapper mapper;

    public JwtAuthenticationFilter(JwtSubjectReader tokens, boolean demoEnabled, ObjectMapper mapper) {
        this.tokens = tokens;
        this.demoEnabled = demoEnabled;
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        UUID userId;
        try {
            userId = authenticate(request);
        } catch (ApiException e) {
            SecurityContextHolder.clearContext();
            response.setStatus(e.getStatus().value());
            response.setContentType("application/json");
            mapper.writeValue(response.getOutputStream(), new ApiError(e.getCode(), e.getMessage()));
            return;
        }
        if (userId != null) {
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
            SecurityContextHolder.setContext(context);
        }
        chain.doFilter(request, response);
    }

    private UUID authenticate(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null) {
            if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                    || authorization.substring(7).isBlank()) {
                throw ApiException.unauthorized("Invalid access token");
            }
            return tokens.subject(authorization.substring(7).trim());
        }
        String demo = request.getHeader(CurrentUser.DEMO_HEADER);
        if (demoEnabled && demo != null && !demo.isBlank()) {
            try {
                return UUID.fromString(demo.trim());
            } catch (IllegalArgumentException e) {
                throw ApiException.unauthorized("X-Demo-User must be a user UUID");
            }
        }
        return null;
    }
}
