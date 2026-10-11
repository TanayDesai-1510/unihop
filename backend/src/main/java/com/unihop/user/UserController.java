package com.unihop.user;

import com.unihop.common.CurrentUser;
import com.unihop.common.enums.UserMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/me")
public class UserController {
    public record UpdateUser(@Size(max = 100) @Pattern(regexp = "(?s).*\\S.*", message = "must not be blank") String name,
                             @Size(max = 32) String phone, UserMode mode) {}
    private final CurrentUser currentUser;
    private final UserService users;
    public UserController(CurrentUser currentUser, UserService users) {
        this.currentUser = currentUser; this.users = users;
    }
    @GetMapping public User get() { return users.get(currentUser.id()); }
    @PatchMapping public User update(@Valid @RequestBody UpdateUser body) {
        return users.update(currentUser.id(), body.name(), body.phone(), body.mode());
    }
}
