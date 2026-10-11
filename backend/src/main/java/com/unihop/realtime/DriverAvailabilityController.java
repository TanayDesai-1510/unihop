package com.unihop.realtime;

import com.unihop.common.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Contract section 8, driver availability [Dev]. */
@RestController
@RequestMapping("/api/drivers/me")
@RequiredArgsConstructor
public class DriverAvailabilityController {

    private final CurrentUser currentUser;
    private final DriverAvailabilityService availability;

    @PostMapping("/online")
    public DriverProfile online(@Valid @RequestBody LocationRequest body) {
        return availability.goOnline(currentUser.id(), body.lat(), body.lng());
    }

    @PostMapping("/offline")
    public DriverProfile offline() {
        return availability.goOffline(currentUser.id());
    }

    @PostMapping("/location")
    public ResponseEntity<Void> location(@Valid @RequestBody LocationRequest body) {
        availability.updateLocation(currentUser.id(), body.lat(), body.lng());
        return ResponseEntity.noContent().build();
    }
}
