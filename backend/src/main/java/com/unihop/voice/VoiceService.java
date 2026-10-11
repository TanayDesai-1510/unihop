package com.unihop.voice;

import com.unihop.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Contract section 8 voice rules: input limits, the speech cache, and 503 {@code VOICE_UNAVAILABLE}. */
@Service
@RequiredArgsConstructor
public class VoiceService {

    static final long MAX_AUDIO_BYTES = 1024 * 1024;
    static final int MAX_SPEECH_CHARS = 300;
    private static final int CACHE_ENTRIES = 256;
    private static final Set<String> AUDIO_TYPES = Set.of(
            "audio/webm", "audio/ogg", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave");

    private final VoiceGateway gateway;

    /** Repeated phrases (driver announcements) cost provider credits once. */
    private final Map<String, byte[]> speechCache = new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
            return size() > CACHE_ENTRIES;
        }
    };

    public VoiceTranscript transcribe(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Attach the recording as the 'audio' part");
        }
        if (audio.getSize() > MAX_AUDIO_BYTES) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Recording must be at most 1 MB");
        }
        String type = baseType(audio.getContentType());
        if (!AUDIO_TYPES.contains(type)) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Unsupported audio type " + type);
        }
        byte[] bytes;
        try {
            bytes = audio.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Could not read the recording");
        }
        String filename = audio.getOriginalFilename() == null || audio.getOriginalFilename().isBlank()
                ? "speech" : audio.getOriginalFilename();
        try {
            return gateway.transcribe(bytes, filename, type);
        } catch (VoiceProviderException e) {
            throw unavailable();
        }
    }

    public byte[] speak(SpeechRequest request) {
        String text = request == null || request.text() == null ? "" : request.text().trim();
        if (text.isEmpty() || text.length() > MAX_SPEECH_CHARS) {
            throw ApiException.badRequest("VALIDATION_ERROR", "text must contain 1-" + MAX_SPEECH_CHARS + " characters");
        }
        String language = request.languageCode() == null || request.languageCode().isBlank()
                ? null : request.languageCode().trim().toLowerCase(Locale.ROOT);
        if (language != null && !language.matches("[a-z]{2}")) {
            throw ApiException.badRequest("VALIDATION_ERROR", "languageCode must be ISO 639-1, e.g. \"es\"");
        }
        String key = language + "|" + text;
        synchronized (speechCache) {
            byte[] cached = speechCache.get(key);
            if (cached != null) {
                return cached;
            }
        }
        byte[] audio;
        try {
            audio = gateway.speak(text, language);
        } catch (VoiceProviderException e) {
            throw unavailable();
        }
        synchronized (speechCache) {
            speechCache.put(key, audio);
        }
        return audio;
    }

    private static String baseType(String contentType) {
        if (contentType == null) {
            return "";
        }
        int semi = contentType.indexOf(';');
        return (semi < 0 ? contentType : contentType.substring(0, semi)).trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "VOICE_UNAVAILABLE", "Voice is unavailable right now. Please type instead.");
    }
}
