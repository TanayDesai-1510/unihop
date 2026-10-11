package com.unihop.voice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * ElevenLabs REST API: {@code POST /v1/speech-to-text} (multipart {@code file} + {@code model_id}) and
 * {@code POST /v1/text-to-speech/{voice_id}} (JSON {@code text} + {@code model_id}), authenticated with {@code xi-api-key}.
 * The key is backend-only. Audio and text are never logged.
 */
@Component
class ElevenLabsVoiceGateway implements VoiceGateway {

    private static final Map<String, String> ISO3_TO_ISO1 = new HashMap<>();

    static {
        for (String iso1 : Locale.getISOLanguages()) {
            try {
                ISO3_TO_ISO1.put(Locale.of(iso1).getISO3Language(), iso1);
            } catch (java.util.MissingResourceException ignored) {
                // a few codes have no ISO 639-2 form
            }
        }
    }

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String baseUrl;
    private final String apiKey;
    private final String voiceId;
    private final String sttModel;
    private final String ttsModel;
    private final Duration timeout;

    ElevenLabsVoiceGateway(ObjectMapper mapper,
            @Value("${app.voice.base-url:https://api.elevenlabs.io}") String baseUrl,
            @Value("${ELEVENLABS_API_KEY:}") String apiKey,
            @Value("${ELEVENLABS_VOICE_ID:JBFqnCBsd6RMkjVDRZzb}") String voiceId,
            @Value("${ELEVENLABS_STT_MODEL:scribe_v2}") String sttModel,
            @Value("${ELEVENLABS_TTS_MODEL:eleven_multilingual_v2}") String ttsModel,
            @Value("${app.voice.timeout-ms:15000}") long timeoutMs) {
        this.mapper = mapper;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.voiceId = voiceId;
        this.sttModel = sttModel;
        this.ttsModel = ttsModel;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    @Override
    public VoiceTranscript transcribe(byte[] audio, String filename, String contentType) {
        requireKey();
        String boundary = "unihop-" + UUID.randomUUID();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeField(body, boundary, "model_id", sttModel);
        writeFile(body, boundary, "file", filename, contentType, audio);
        write(body, "--" + boundary + "--\r\n");

        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/v1/speech-to-text"))
                .timeout(timeout)
                .header("xi-api-key", apiKey)
                .header("content-type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                .build();
        HttpResponse<byte[]> response = send(request);
        try {
            JsonNode json = mapper.readTree(response.body());
            String text = json.path("text").asText("").trim();
            String language = text.isEmpty() ? null : toIso1(json.path("language_code").asText(null));
            return new VoiceTranscript(text, language);
        } catch (IOException e) {
            throw new VoiceProviderException("unreadable transcription response", e);
        }
    }

    @Override
    public byte[] speak(String text, String languageCode) {
        requireKey();
        ObjectNode json = mapper.createObjectNode().put("text", text).put("model_id", ttsModel);
        // eleven_multilingual_v2 detects the language from the text and rejects language_code
        if (languageCode != null && !ttsModel.startsWith("eleven_multilingual")) {
            json.put("language_code", languageCode);
        }
        HttpRequest request = HttpRequest.newBuilder(
                        URI.create(baseUrl + "/v1/text-to-speech/" + voiceId + "?output_format=mp3_44100_128"))
                .timeout(timeout)
                .header("xi-api-key", apiKey)
                .header("content-type", "application/json")
                .header("accept", "audio/mpeg")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString(), StandardCharsets.UTF_8))
                .build();
        byte[] audio = send(request).body();
        if (audio.length == 0) {
            throw new VoiceProviderException("empty audio");
        }
        return audio;
    }

    private void requireKey() {
        if (apiKey.isBlank()) {
            throw new VoiceProviderException("ELEVENLABS_API_KEY is not configured");
        }
    }

    private HttpResponse<byte[]> send(HttpRequest request) {
        try {
            HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new VoiceProviderException("provider answered HTTP " + response.statusCode());
            }
            return response;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new VoiceProviderException("interrupted", e);
        } catch (IOException e) {
            throw new VoiceProviderException("provider unreachable", e);
        }
    }

    /** ElevenLabs may answer with ISO 639-3 ("spa"); the contract promises ISO 639-1 ("es"). */
    static String toIso1(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String lower = code.trim().toLowerCase(Locale.ROOT);
        if (lower.length() == 2) {
            return lower;
        }
        return ISO3_TO_ISO1.get(lower);
    }

    private static void writeField(ByteArrayOutputStream out, String boundary, String name, String value) {
        write(out, "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n");
    }

    private static void writeFile(ByteArrayOutputStream out, String boundary, String name, String filename,
                                  String contentType, byte[] bytes) {
        write(out, "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"; filename=\""
                + filename.replace("\"", "") + "\"\r\nContent-Type: " + contentType + "\r\n\r\n");
        out.writeBytes(bytes);
        write(out, "\r\n");
    }

    private static void write(ByteArrayOutputStream out, String s) {
        out.writeBytes(s.getBytes(StandardCharsets.UTF_8));
    }
}
