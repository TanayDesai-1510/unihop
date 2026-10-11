package com.unihop.realtime;

import java.util.UUID;

/**
 * Verifies the bearer token sent on STOMP CONNECT and returns its user id, or throws
 * {@link com.unihop.common.ApiException} (UNAUTHORIZED). {@link WebSocketConfig} wires it to the auth package's
 * {@link com.unihop.auth.JwtSubjectReader}; tests can pass their own.
 */
public interface StompTokenVerifier {

    UUID subject(String token);
}
