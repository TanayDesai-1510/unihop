package com.unihop.voice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs the real gateway against a local stand-in for the ElevenLabs API. No network, no credits. */
class ElevenLabsVoiceGatewayTest {

    final ObjectMapper json = new ObjectMapper();
    HttpServer server;
    final AtomicReference<String> path = new AtomicReference<>();
    final AtomicReference<String> apiKeyHeader = new AtomicReference<>();
    final AtomicReference<String> contentType = new AtomicReference<>();
    final AtomicReference<byte[]> requestBody = new AtomicReference<>();
    final AtomicInteger calls = new AtomicInteger();
    volatile int status = 200;
    volatile byte[] responseBody = new byte[0];

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            calls.incrementAndGet();
            path.set(exchange.getRequestURI().toString());
            apiKeyHeader.set(exchange.getRequestHeaders().getFirst("xi-api-key"));
            contentType.set(exchange.getRequestHeaders().getFirst("content-type"));
            requestBody.set(exchange.getRequestBody().readAllBytes());
            exchange.sendResponseHeaders(status, responseBody.length == 0 ? -1 : responseBody.length);
            if (responseBody.length > 0) {
                exchange.getResponseBody().write(responseBody);
            }
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    ElevenLabsVoiceGateway gateway(String key, String ttsModel) {
        return new ElevenLabsVoiceGateway(json, "http://127.0.0.1:" + server.getAddress().getPort() + "/",
                key, "VOICE123", "scribe_v2", ttsModel, 2000);
    }

    @Test
    void transcribeSendsMultipartAndMapsLanguageToIso1() throws Exception {
        responseBody = "{\"text\":\" Llévame a Busch \",\"language_code\":\"spa\",\"language_probability\":0.98}"
                .getBytes(StandardCharsets.UTF_8);
        byte[] audio = {1, 2, 3, 4};

        VoiceTranscript t = gateway("sk_test", "eleven_multilingual_v2").transcribe(audio, "clip.webm", "audio/webm");

        assertThat(t).isEqualTo(new VoiceTranscript("Llévame a Busch", "es"));
        assertThat(path.get()).isEqualTo("/v1/speech-to-text");
        assertThat(apiKeyHeader.get()).isEqualTo("sk_test");
        assertThat(contentType.get()).startsWith("multipart/form-data; boundary=");
        String body = new String(requestBody.get(), StandardCharsets.ISO_8859_1);
        assertThat(body).contains("name=\"model_id\"\r\n\r\nscribe_v2\r\n");
        assertThat(body).contains("name=\"file\"; filename=\"clip.webm\"\r\nContent-Type: audio/webm\r\n\r\n");
        assertThat(body).contains(new String(audio, StandardCharsets.ISO_8859_1));
    }

    @Test
    void silenceComesBackAsEmptyTextWithoutLanguage() {
        responseBody = "{\"text\":\"\",\"language_code\":\"en\"}".getBytes(StandardCharsets.UTF_8);
        assertThat(gateway("sk_test", "eleven_multilingual_v2").transcribe(new byte[]{1}, "a.wav", "audio/wav"))
                .isEqualTo(new VoiceTranscript("", null));
    }

    @Test
    void speakPostsJsonToTheVoiceAndReturnsTheMp3() throws Exception {
        responseBody = new byte[]{(byte) 0xFF, (byte) 0xFB, 0x10};

        byte[] mp3 = gateway("sk_test", "eleven_multilingual_v2").speak("New trip to Busch.", "en");

        assertThat(mp3).containsExactly(0xFF, 0xFB, 0x10);
        assertThat(path.get()).isEqualTo("/v1/text-to-speech/VOICE123?output_format=mp3_44100_128");
        assertThat(apiKeyHeader.get()).isEqualTo("sk_test");
        JsonNode sent = json.readTree(requestBody.get());
        assertThat(sent.get("text").asText()).isEqualTo("New trip to Busch.");
        assertThat(sent.get("model_id").asText()).isEqualTo("eleven_multilingual_v2");
        // multilingual_v2 detects the language itself and rejects language_code
        assertThat(sent.has("language_code")).isFalse();
    }

    @Test
    void languageHintIsSentForModelsThatAcceptIt() throws Exception {
        responseBody = new byte[]{1};
        gateway("sk_test", "eleven_flash_v2_5").speak("Hola", "es");
        assertThat(json.readTree(requestBody.get()).get("language_code").asText()).isEqualTo("es");
    }

    @Test
    void providerErrorsAndMissingKeyBecomeProviderExceptions() {
        status = 401;
        responseBody = "{\"detail\":\"invalid key\"}".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> gateway("sk_bad", "eleven_multilingual_v2").speak("hi", null))
                .isInstanceOf(VoiceProviderException.class);
        assertThatThrownBy(() -> gateway("sk_bad", "eleven_multilingual_v2").transcribe(new byte[]{1}, "a.webm", "audio/webm"))
                .isInstanceOf(VoiceProviderException.class);

        int before = calls.get();
        assertThatThrownBy(() -> gateway("  ", "eleven_multilingual_v2").speak("hi", null))
                .isInstanceOf(VoiceProviderException.class);
        assertThat(calls.get()).as("no request without a key").isEqualTo(before);

        status = 200;
        responseBody = "not json".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> gateway("sk_test", "eleven_multilingual_v2").transcribe(new byte[]{1}, "a.webm", "audio/webm"))
                .isInstanceOf(VoiceProviderException.class);
    }

    @Test
    void languageCodesNormaliseToIso1() {
        assertThat(ElevenLabsVoiceGateway.toIso1("spa")).isEqualTo("es");
        assertThat(ElevenLabsVoiceGateway.toIso1("hin")).isEqualTo("hi");
        assertThat(ElevenLabsVoiceGateway.toIso1("EN")).isEqualTo("en");
        assertThat(ElevenLabsVoiceGateway.toIso1("")).isNull();
        assertThat(ElevenLabsVoiceGateway.toIso1(null)).isNull();
    }
}
