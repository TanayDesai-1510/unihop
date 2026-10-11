package com.unihop.user;

import com.unihop.common.enums.UserMode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class LoginUserService {
    private final JdbcTemplate jdbc;
    public LoginUserService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public User findOrCreate(String email, String name) {
        String displayName = name == null || name.isBlank() ? email.substring(0, email.indexOf('@')) : name.trim();
        displayName = displayName.substring(0, Math.min(displayName.length(), 100));
        jdbc.update("INSERT INTO users (id, email, name, mode) VALUES (?, ?, ?, 'RIDER') ON CONFLICT (email) DO NOTHING",
                UUID.randomUUID(), email, displayName);
        return jdbc.queryForObject("""
                SELECT u.*, EXISTS (SELECT 1 FROM driver_profiles d WHERE d.user_id = u.id
                    AND d.status = 'APPROVED') AS approved FROM users u WHERE u.email = ?
                """, (rs, row) -> new User(rs.getObject("id", UUID.class), rs.getString("email"),
                rs.getString("name"), rs.getString("phone"), UserMode.valueOf(rs.getString("mode")),
                rs.getBigDecimal("rating_avg"), rs.getInt("rating_count"), rs.getBoolean("approved")), email);
    }
}
