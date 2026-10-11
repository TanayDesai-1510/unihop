package com.unihop.rating;

import com.unihop.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Contract section 8: two-way ratings for completed rides. */
@RestController
@RequestMapping("/api/rides")
public class RatingController {

    public record RatingRequest(
            @NotNull @Min(1) @Max(5) Integer stars,
            @Size(max = 500) String comment
    ) {
    }

    private final CurrentUser currentUser;
    private final RatingService ratings;

    public RatingController(CurrentUser currentUser, RatingService ratings) {
        this.currentUser = currentUser;
        this.ratings = ratings;
    }

    @PostMapping("/{id}/rating")
    public ResponseEntity<Void> rate(@PathVariable UUID id, @Valid @RequestBody RatingRequest body) {
        ratings.rate(id, currentUser.id(), body.stars(), body.comment());
        return ResponseEntity.noContent().build();
    }
}
