package com.unihop.voice;

/** The voice provider is not configured, failed, timed out, or answered with something unusable. Maps to 503. */
final class VoiceProviderException extends RuntimeException {

    VoiceProviderException(String reason) {
        super(reason);
    }

    VoiceProviderException(String reason, Throwable cause) {
        super(reason, cause);
    }
}
