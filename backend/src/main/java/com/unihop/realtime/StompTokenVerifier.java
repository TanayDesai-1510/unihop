package com.unihop.realtime;

import java.util.UUID;

/**
 * Verifies the bearer token sent on STOMP CONNECT and returns its user id, or throws
 * {@link com.unihop.common.ApiException} (UNAUTHORIZED). JWT parsing belongs to the auth package, so the
 * real implementation delegates to it; until that is merged, {@link WebSocketConfig} registers one that rejects every token.
 */
public interface StompTokenVerifier {

    UUID subject(String token);
}
