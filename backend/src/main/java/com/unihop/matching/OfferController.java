package com.unihop.matching;

import com.unihop.common.CurrentUser;
import com.unihop.ride.dto.Ride;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Contract section 8: accept / decline (rides) and missed-offer recovery (driver availability) [Dev]. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OfferController {

    private final CurrentUser currentUser;
    private final OfferService offers;

    @PostMapping("/rides/{id}/accept")
    public Ride accept(@PathVariable UUID id) {
        return offers.accept(id, currentUser.id());
    }

    @PostMapping("/rides/{id}/decline")
    public ResponseEntity<Void> decline(@PathVariable UUID id) {
        offers.decline(id, currentUser.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/drivers/me/offer")
    public ResponseEntity<RideOffer> currentOffer() {
        return offers.currentOffer(currentUser.id())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
