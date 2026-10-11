package com.unihop.voice;

/** Contract DTO {@code VoiceTranscript} (section 9). {@code languageCode} is ISO 639-1, null when no speech was found. */
public record VoiceTranscript(String text, String languageCode) {
}
