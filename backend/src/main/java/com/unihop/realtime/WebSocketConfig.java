package com.unihop.realtime;

import com.unihop.auth.JwtSubjectReader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

/** Contract section 11: plain STOMP over WebSocket at {@code /ws} (no SockJS), simple in-memory broker on {@code /topic}. */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String[] allowedOrigins;
    private final StompAuthInterceptor authInterceptor;

    public WebSocketConfig(@Value("${app.cors.origins}") String origins,
                           @Value("${app.auth.demo-header:false}") boolean demoHeaderEnabled,
                           JwtSubjectReader jwtSubjectReader) {
        this.allowedOrigins = Arrays.stream(origins.split(",")).map(String::trim).toArray(String[]::new);
        this.authInterceptor = new StompAuthInterceptor(jwtSubjectReader::subject, demoHeaderEnabled);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns(allowedOrigins);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker(Topics.PREFIX);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
    }
}
