package com.unihop.voice;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Endpoints, limits, cache and error mapping with the provider mocked out. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class VoiceControllerTest {

    static final String RIDER1 = "00000000-0000-0000-0000-000000000101";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    VoiceGateway gateway;

    @Test
    void transcribeReturnsTheTranscriptInTheSpokenLanguage() throws Exception {
        when(gateway.transcribe(any(), eq("clip.webm"), eq("audio/webm")))
                .thenReturn(new VoiceTranscript("Llévame a Busch", "es"));
        mvc.perform(multipart("/api/voice/transcribe")
                        .file(new MockMultipartFile("audio", "clip.webm", "audio/webm;codecs=opus", new byte[]{1, 2, 3}))
                        .header("X-Demo-User", RIDER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("Llévame a Busch"))
                .andExpect(jsonPath("$.languageCode").value("es"));
    }

    @Test
    void silenceIsAnEmptyTranscriptWithNullLanguage() throws Exception {
        when(gateway.transcribe(any(), anyString(), anyString())).thenReturn(new VoiceTranscript("", null));
        mvc.perform(multipart("/api/voice/transcribe")
                        .file(new MockMultipartFile("audio", "a.wav", "audio/wav", new byte[]{1}))
                        .header("X-Demo-User", RIDER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value(""))
                .andExpect(jsonPath("$.languageCode").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void badRecordingsAre400AndNeverReachTheProvider() throws Exception {
        mvc.perform(multipart("/api/voice/transcribe").header("X-Demo-User", RIDER1))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(multipart("/api/voice/transcribe")
                        .file(new MockMultipartFile("audio", "notes.txt", "text/plain", "hi".getBytes()))
                        .header("X-Demo-User", RIDER1))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(multipart("/api/voice/transcribe")
                        .file(new MockMultipartFile("audio", "big.webm", "audio/webm", new byte[(int) VoiceService.MAX_AUDIO_BYTES + 1]))
                        .header("X-Demo-User", RIDER1))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        verify(gateway, never()).transcribe(any(), any(), any());
    }

    @Test
    void speechReturnsMp3AndRepeatedPhrasesHitTheCache() throws Exception {
        byte[] mp3 = {(byte) 0xFF, (byte) 0xFB, 0x01};
        when(gateway.speak("New trip to Busch Student Center. You earn $4.50.", null)).thenReturn(mp3);
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/voice/speech").header("X-Demo-User", RIDER1).contentType("application/json")
                            .content("{\"text\":\"  New trip to Busch Student Center. You earn $4.50.  \"}"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", "audio/mpeg"))
                    .andExpect(content().bytes(mp3));
        }
        verify(gateway, times(1)).speak("New trip to Busch Student Center. You earn $4.50.", null);
    }

    @Test
    void languageIsPartOfTheCacheKeyAndIsNormalised() throws Exception {
        when(gateway.speak(eq("Hola"), any())).thenReturn(new byte[]{1});
        mvc.perform(post("/api/voice/speech").header("X-Demo-User", RIDER1).contentType("application/json")
                .content("{\"text\":\"Hola\",\"languageCode\":\"ES\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/voice/speech").header("X-Demo-User", RIDER1).contentType("application/json")
                .content("{\"text\":\"Hola\"}")).andExpect(status().isOk());
        verify(gateway).speak("Hola", "es");
        verify(gateway).speak("Hola", null);
    }

    @Test
    void speechTextAndLanguageAreValidated() throws Exception {
        for (String body : new String[]{"{}", "{\"text\":\"   \"}", "{\"text\":\"" + "x".repeat(301) + "\"}",
                "{\"text\":\"hi\",\"languageCode\":\"spanish\"}"}) {
            mvc.perform(post("/api/voice/speech").header("X-Demo-User", RIDER1).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        }
        mvc.perform(post("/api/voice/speech").header("X-Demo-User", RIDER1).contentType("application/json")
                .content("{\"text\":\"" + "x".repeat(300) + "\"}")).andExpect(status().isOk());
    }

    @Test
    void providerFailureIs503VoiceUnavailable() throws Exception {
        when(gateway.speak(anyString(), any())).thenThrow(new VoiceProviderException("down"));
        when(gateway.transcribe(any(), anyString(), anyString())).thenThrow(new VoiceProviderException("down"));
        mvc.perform(post("/api/voice/speech").header("X-Demo-User", RIDER1).contentType("application/json")
                        .content("{\"text\":\"The rider cancelled.\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("VOICE_UNAVAILABLE"));
        mvc.perform(multipart("/api/voice/transcribe")
                        .file(new MockMultipartFile("audio", "a.ogg", "audio/ogg", new byte[]{1}))
                        .header("X-Demo-User", RIDER1))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("VOICE_UNAVAILABLE"));
    }

    @Test
    void voiceRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/voice/speech").contentType("application/json").content("{\"text\":\"hi\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/voice/transcribe")
                        .file(new MockMultipartFile("audio", "a.ogg", "audio/ogg", new byte[]{1})))
                .andExpect(status().isUnauthorized());
        verify(gateway, never()).speak(any(), any());
    }
}
