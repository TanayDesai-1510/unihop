package com.unihop.common;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CurrentUserTest {

    static final String RIDER1 = "00000000-0000-0000-0000-000000000101";

    @AfterEach
    void clear() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void readsDemoHeaderWhenEnabled() {
        withHeader(RIDER1);
        assertThat(new CurrentUser(true).id()).isEqualTo(UUID.fromString(RIDER1));
    }

    @Test
    void ignoresDemoHeaderWhenDisabled() {
        withHeader(RIDER1);
        assertThatThrownBy(() -> new CurrentUser(false).id())
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("UNAUTHORIZED");
    }

    @Test
    void rejectsMissingOrMalformedHeader() {
        withHeader(null);
        assertThatThrownBy(() -> new CurrentUser(true).id()).isInstanceOf(ApiException.class);
        withHeader("not-a-uuid");
        assertThatThrownBy(() -> new CurrentUser(true).id()).isInstanceOf(ApiException.class);
    }

    private static void withHeader(String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (value != null) {
            request.addHeader(CurrentUser.DEMO_HEADER, value);
        }
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
}
