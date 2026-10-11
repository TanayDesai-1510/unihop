package com.unihop.ride;

import com.unihop.common.CurrentUser;
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

import java.util.UUID;

/** Contract section 8, rides [Dev]. */
@RestController
@RequestMapping("/api/rides")
@RequiredArgsConstructor
public class RideController {

    private final CurrentUser currentUser;
    private final RideService rides;

    @PostMapping
    public ResponseEntity<Ride> create(@Valid @RequestBody CreateRideRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(rides.create(currentUser.id(), body));
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

    @PostMapping("/{id}/cancel")
    public Ride cancel(@PathVariable UUID id, @Valid @RequestBody CancelRideRequest body) {
        return rides.cancel(id, currentUser.id(), body.reason());
    }
}
