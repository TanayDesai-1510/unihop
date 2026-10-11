package com.unihop.payments;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.unihop.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/payment-methods")
public class PaymentMethodController {
    public record AddRequest(@NotBlank @Size(max = 64) String token,
                             @Size(max = 50) String nickname) {
    }

    public static final class UpdateRequest {
        private Boolean isDefault;
        @Size(max = 50)
        private String nickname;
        private boolean nicknamePresent;

        @JsonProperty("isDefault")
        public Boolean isDefault() {
            return isDefault;
        }

        @JsonProperty("isDefault")
        public void setDefault(Boolean isDefault) {
            this.isDefault = isDefault;
        }

        public String nickname() {
            return nickname;
        }

        @JsonSetter("nickname")
        public void setNickname(String nickname) {
            this.nickname = nickname;
            this.nicknamePresent = true;
        }

        public boolean nicknamePresent() {
            return nicknamePresent;
        }
    }

    private final CurrentUser currentUser;
    private final PaymentMethodService methods;

    public PaymentMethodController(CurrentUser currentUser, PaymentMethodService methods) {
        this.currentUser = currentUser;
        this.methods = methods;
    }

    @GetMapping
    public List<PaymentMethod> list() {
        return methods.list(currentUser.id());
    }

    @PostMapping
    public PaymentMethod add(@Valid @RequestBody AddRequest body) {
        return methods.add(currentUser.id(), body.token(), body.nickname());
    }

    @PatchMapping("/{id}")
    public PaymentMethod update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest body) {
        return methods.update(currentUser.id(), id, body.isDefault(),
                body.nicknamePresent(), body.nickname());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        methods.delete(currentUser.id(), id);
        return ResponseEntity.noContent().build();
    }
}
