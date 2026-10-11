package com.unihop.voice;

/** Speech provider seam (ElevenLabs today). Implementations throw {@link VoiceProviderException} on any provider failure. */
public interface VoiceGateway {

    /** Speech to text with automatic language detection. Text stays in the spoken language. */
    VoiceTranscript transcribe(byte[] audio, String filename, String contentType);

    /** Text to MP3 audio. {@code languageCode} (ISO 639-1) is a pronunciation hint and may be null. */
    byte[] speak(String text, String languageCode);
}
