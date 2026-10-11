package com.unihop.ride;

import com.unihop.common.CurrentUser;
import com.unihop.ride.dto.ChatMessage;
import com.unihop.ride.dto.Ride;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Contract section 8, rides [Dev]. */
@RestController
@RequestMapping("/api/rides")
@RequiredArgsConstructor
public class RideController {

    private final CurrentUser currentUser;
    private final RideService rides;
    private final ChatService chat;

    @PostMapping
    public ResponseEntity<Ride> create(@Valid @RequestBody CreateRideRequest body) {
        UUID riderId = currentUser.id();
        Ride created = rides.create(riderId, body);
        // Matching runs as the ride commits, before we get here. With no drivers the ride is already NO_DRIVERS and its
        // status event went out before the client could subscribe, so return the current state, not the REQUESTED one.
        return ResponseEntity.status(HttpStatus.CREATED).body(rides.get(created.id(), riderId));
    }

    @GetMapping("/active")
    public ResponseEntity<Ride> active() {
        return rides.active(currentUser.id())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}")
    public Ride get(@PathVariable UUID id) {
        return rides.get(id, currentUser.id());
    }

    @PostMapping("/{id}/arrived")
    public Ride arrived(@PathVariable UUID id) {
        return rides.arrived(id, currentUser.id());
    }

    @PostMapping("/{id}/start")
    public Ride start(@PathVariable UUID id, @Valid @RequestBody StartRideRequest body) {
        return rides.start(id, currentUser.id(), body.pin());
    }

    @PostMapping("/{id}/complete")
    public Ride complete(@PathVariable UUID id) {
        return rides.complete(id, currentUser.id());
    }

    @GetMapping("/{id}/chat")
    public List<ChatMessage> chat(@PathVariable UUID id) {
        return chat.messages(id, currentUser.id());
    }

    @PostMapping("/{id}/chat")
    public ChatMessage sendChat(@PathVariable UUID id, @Valid @RequestBody SendChatRequest body) {
        return chat.send(id, currentUser.id(), body.body());
    }

    @PostMapping("/{id}/cancel")
    public Ride cancel(@PathVariable UUID id, @Valid @RequestBody CancelRideRequest body) {
        return rides.cancel(id, currentUser.id(), body.reason());
    }
}
