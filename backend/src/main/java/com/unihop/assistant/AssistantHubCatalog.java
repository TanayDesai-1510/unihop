package com.unihop.assistant;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
class AssistantHubCatalog {

    private final JdbcTemplate jdbc;

    AssistantHubCatalog(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    List<AssistantHub> all() {
        return jdbc.query("SELECT id, code, name FROM hubs ORDER BY code", (rs, row) ->
                new AssistantHub(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name")));
    }
}
