package com.unihop.voice;

/** Body of {@code POST /api/voice/speech}. Validated in {@link VoiceService} so every failure is a contract error. */
public record SpeechRequest(String text, String languageCode) {
}
