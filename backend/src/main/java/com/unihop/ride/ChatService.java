package com.unihop.ride;

import com.unihop.common.ApiException;
import com.unihop.realtime.AfterCommit;
import com.unihop.realtime.RealtimePublisher;
import com.unihop.ride.dto.ChatMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** In-ride chat between the rider and the assigned driver (contract sections 8 and 11, stretch). */
@Service
@RequiredArgsConstructor
public class ChatService {

    private final RideRepository rides;
    private final JdbcTemplate jdbc;
    private final RealtimePublisher publisher;

    /** Oldest first. */
    @Transactional(readOnly = true)
    public List<ChatMessage> messages(UUID rideId, UUID callerId) {
        requireParticipant(rideId, callerId);
        return jdbc.query("SELECT * FROM chat_messages WHERE ride_id = ? ORDER BY created_at, id", (rs, i) -> new ChatMessage(
                rs.getObject("id", UUID.class), rs.getObject("sender_id", UUID.class), rs.getString("body"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant()), rideId);
    }

    /** Stores the message and pushes it to {@code /topic/rides/{rideId}/chat} after commit. */
    @Transactional
    public ChatMessage send(UUID rideId, UUID senderId, String body) {
        requireParticipant(rideId, senderId);
        UUID id = UUID.randomUUID();
        OffsetDateTime createdAt = jdbc.queryForObject("""
                INSERT INTO chat_messages (id, ride_id, sender_id, body) VALUES (?, ?, ?, ?)
                RETURNING created_at""", OffsetDateTime.class, id, rideId, senderId, body.trim());
        ChatMessage message = new ChatMessage(id, senderId, body.trim(), createdAt.toInstant());
        AfterCommit.run(() -> publisher.chat(rideId, message));
        return message;
    }

    private void requireParticipant(UUID rideId, UUID callerId) {
        RideRow ride = rides.find(rideId).orElseThrow(() -> ApiException.notFound("NOT_FOUND", "Ride not found"));
        if (!ride.isParticipant(callerId)) {
            throw ApiException.forbidden("Not a participant in this ride");
        }
    }
}
