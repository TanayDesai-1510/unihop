package com.unihop.ride;

import com.unihop.ride.dto.PublicRideView;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Contract section 8, public trip sharing [Dev, stretch]. No auth: the unguessable share token is the key. */
@RestController
@RequiredArgsConstructor
public class ShareController {

    private final ShareService shares;

    @GetMapping("/api/share/{shareToken}")
    public PublicRideView view(@PathVariable String shareToken) {
        return shares.view(shareToken);
    }
}
