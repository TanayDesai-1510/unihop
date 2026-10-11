package com.unihop.assistant;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unihop.common.enums.AssistantAction;
import com.unihop.common.enums.UserMode;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class AssistantIntegrationTest {

    private static final String RIDER = "00000000-0000-0000-0000-000000000101";
    private static final String DRIVER = "00000000-0000-0000-0000-000000000201";
    private static final String YARD = "00000000-0000-0000-0000-000000000301";
    private static final String BUSCH = "00000000-0000-0000-0000-000000000302";
    private static final String COOK = "00000000-0000-0000-0000-000000000304";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean AssistantGateway gateway;

    @Test
    void riderCommandReturnsValidatedBooking() throws Exception {
        when(gateway.interpret(eq("Book from the Yard to Busch Student Center"), eq(UserMode.RIDER), anyList()))
                .thenReturn(new AssistantDecision(AssistantAction.BOOK_RIDE, "Booking your ride now.", YARD, BUSCH));

        mvc.perform(post("/api/assistant/commands")
                        .header("X-Demo-User", RIDER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"  Book from the Yard to Busch Student Center  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("BOOK_RIDE"))
                .andExpect(jsonPath("$.reply").value("Booking your ride now."))
                .andExpect(jsonPath("$.pickupHubId").value(YARD))
                .andExpect(jsonPath("$.dropoffHubId").value(BUSCH));
    }

    @Test
    void driverCommandReturnsDestinationWatch() throws Exception {
        when(gateway.interpret(eq("Find rides ending at Cook Student Center"), eq(UserMode.DRIVER), anyList()))
                .thenReturn(new AssistantDecision(AssistantAction.WATCH_RIDES, "Watching for Cook trips.", null, COOK));

        mvc.perform(post("/api/assistant/commands")
                        .header("X-Demo-User", DRIVER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Find rides ending at Cook Student Center\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("WATCH_RIDES"))
                .andExpect(jsonPath("$.pickupHubId").isEmpty())
                .andExpect(jsonPath("$.dropoffHubId").value(COOK));
    }

    @Test
    void modeIncompatibleCommandBecomesHelpWithoutHubIds() throws Exception {
        when(gateway.interpret(eq("Book me a ride"), eq(UserMode.DRIVER), anyList()))
                .thenReturn(new AssistantDecision(AssistantAction.BOOK_RIDE, "Booking.", YARD, BUSCH));

        mvc.perform(post("/api/assistant/commands")
                        .header("X-Demo-User", DRIVER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Book me a ride\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("HELP"))
                .andExpect(jsonPath("$.reply").value("Switch to rider mode to book a ride."))
                .andExpect(jsonPath("$.pickupHubId").isEmpty())
                .andExpect(jsonPath("$.dropoffHubId").isEmpty());
    }

    @Test
    void malformedOrFailedProviderResponseIsUnavailable() throws Exception {
        String unknownHub = UUID.randomUUID().toString();
        when(gateway.interpret(eq("unknown hub"), eq(UserMode.RIDER), anyList()))
                .thenReturn(new AssistantDecision(AssistantAction.BOOK_RIDE, "Booking.", YARD, unknownHub));
        when(gateway.interpret(eq("provider down"), eq(UserMode.RIDER), anyList()))
                .thenThrow(new AssistantProviderException());

        for (String message : new String[]{"unknown hub", "provider down"}) {
            mvc.perform(post("/api/assistant/commands")
                            .header("X-Demo-User", RIDER)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.writeValueAsString(new AssistantCommandRequest(message))))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.error").value("ASSISTANT_UNAVAILABLE"));
        }
    }

    @Test
    void endpointRequiresAuthenticationAndValidMessage() throws Exception {
        mvc.perform(post("/api/assistant/commands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Book a ride\"}"))
                .andExpect(status().isUnauthorized());

        for (String message : new String[]{"   ", "x".repeat(501)}) {
            mvc.perform(post("/api/assistant/commands")
                            .header("X-Demo-User", RIDER)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.writeValueAsString(new AssistantCommandRequest(message))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        }
    }
}
