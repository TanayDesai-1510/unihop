package com.unihop.pricing;

import com.unihop.common.enums.Zone;
import com.unihop.ride.dto.Hub;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class PricingController {
    private final JdbcTemplate jdbc;
    private final FareService fares;
    public PricingController(JdbcTemplate jdbc, FareService fares) {
        this.jdbc = jdbc; this.fares = fares;
    }

    @GetMapping("/hubs")
    public List<Hub> hubs() {
        return jdbc.query("SELECT id, code, name, zone, lat, lng FROM hubs ORDER BY id", (rs, row) ->
                new Hub(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                        Zone.valueOf(rs.getString("zone")), rs.getDouble("lat"), rs.getDouble("lng")));
    }

    @GetMapping("/fares/quote")
    public FareBreakdown quote(@RequestParam UUID from, @RequestParam UUID to) {
        return fares.quote(from, to);
    }
}
