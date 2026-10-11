package com.unihop.user;

import com.unihop.common.ApiException;
import com.unihop.common.enums.UserMode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class UserService {
    private final JdbcTemplate jdbc;
    public UserService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public User get(UUID id) {
        var users = jdbc.query("""
                SELECT u.*, EXISTS (SELECT 1 FROM driver_profiles d WHERE d.user_id = u.id
                    AND d.status = 'APPROVED') AS approved FROM users u WHERE u.id = ?
                """, (rs, row) -> new User(rs.getObject("id", UUID.class), rs.getString("email"),
                rs.getString("name"), rs.getString("phone"), UserMode.valueOf(rs.getString("mode")),
                rs.getBigDecimal("rating_avg"), rs.getInt("rating_count"), rs.getBoolean("approved")), id);
        if (users.isEmpty()) throw ApiException.notFound("NOT_FOUND", "User not found");
        return users.getFirst();
    }

    @Transactional
    public User update(UUID id, String name, String phone, UserMode mode) {
        if (jdbc.query("SELECT id FROM users WHERE id = ? FOR UPDATE", (rs, row) -> rs.getObject(1), id).isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "User not found");
        }
        if (mode == UserMode.DRIVER && !get(id).isDriverApproved()) {
            throw ApiException.conflict("DRIVER_NOT_ONBOARDED", "Complete driver onboarding before switching to DRIVER");
        }
        jdbc.update("UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), mode = COALESCE(?, mode) WHERE id = ?",
                name == null ? null : name.trim(), phone == null ? null : phone.trim(),
                mode == null ? null : mode.name(), id);
        return get(id);
    }
}
