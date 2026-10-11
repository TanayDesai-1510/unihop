package com.unihop.records;

import com.unihop.common.CurrentUser;
import com.unihop.common.enums.UserMode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Contract section 8: ride history and completed-ride receipts. */
@RestController
public class RecordsController {
    private final CurrentUser currentUser;
    private final RecordsService records;

    public RecordsController(CurrentUser currentUser, RecordsService records) {
        this.currentUser = currentUser;
        this.records = records;
    }

    @GetMapping("/api/me/rides")
    public List<RideSummary> rides(@RequestParam UserMode mode) {
        return records.rides(currentUser.id(), mode);
    }

    @GetMapping("/api/rides/{id}/receipt")
    public Receipt receipt(@PathVariable UUID id) {
        return records.receipt(id, currentUser.id());
    }
}
