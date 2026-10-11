package com.unihop.ride;

import com.unihop.common.ApiException;
import com.unihop.common.enums.RideStatus;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static com.unihop.common.enums.RideStatus.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RideTransitionsTest {

    /** Contract section 3, verbatim. */
    static final Set<String> ALLOWED = Set.of(
            "REQUESTED->ACCEPTED", "REQUESTED->CANCELLED", "REQUESTED->NO_DRIVERS",
            "ACCEPTED->ARRIVED", "ACCEPTED->CANCELLED",
            "ARRIVED->IN_PROGRESS", "ARRIVED->CANCELLED",
            "IN_PROGRESS->COMPLETED");

    @Test
    void everyPairMatchesTheContract() {
        int allowed = 0;
        for (RideStatus from : RideStatus.values()) {
            for (RideStatus to : RideStatus.values()) {
                boolean expected = ALLOWED.contains(from + "->" + to);
                assertThat(RideTransitions.isAllowed(from, to)).as(from + "->" + to).isEqualTo(expected);
                if (expected) {
                    allowed++;
                    assertThatCode(() -> RideTransitions.check(from, to)).doesNotThrowAnyException();
                } else {
                    assertThatThrownBy(() -> RideTransitions.check(from, to))
                            .as(from + "->" + to)
                            .isInstanceOf(ApiException.class)
                            .extracting("code").isEqualTo("INVALID_TRANSITION");
                }
            }
        }
        assertThat(allowed).isEqualTo(ALLOWED.size());
    }

    @Test
    void terminalStatusesHaveNoWayOut() {
        assertThat(RideTransitions.isTerminal(COMPLETED)).isTrue();
        assertThat(RideTransitions.isTerminal(CANCELLED)).isTrue();
        assertThat(RideTransitions.isTerminal(NO_DRIVERS)).isTrue();
        for (RideStatus s : Set.of(REQUESTED, ACCEPTED, ARRIVED, IN_PROGRESS)) {
            assertThat(RideTransitions.isTerminal(s)).as(s.name()).isFalse();
        }
        for (RideStatus to : RideStatus.values()) {
            assertThat(RideTransitions.isAllowed(COMPLETED, to)).isFalse();
            assertThat(RideTransitions.isAllowed(CANCELLED, to)).isFalse();
            assertThat(RideTransitions.isAllowed(NO_DRIVERS, to)).isFalse();
        }
    }

    @Test
    void methodLabelsFollowContract() {
        assertThat(RidePaymentReader.methodLabel("CARD", "VISA", "4242")).isEqualTo("Visa •••• 4242");
        assertThat(RidePaymentReader.methodLabel("CARD", "MASTERCARD", "4444")).isEqualTo("Mastercard •••• 4444");
        assertThat(RidePaymentReader.methodLabel("APPLE_PAY", "VISA", "8431")).isEqualTo("Apple Pay");
        assertThat(RidePaymentReader.methodLabel("GOOGLE_PAY", "VISA", "1111")).isEqualTo("Google Pay");
        var zero = new java.math.BigDecimal("0.00");
        var some = new java.math.BigDecimal("1.50");
        assertThat(RidePaymentReader.label(some, zero, null)).isEqualTo("UniHop Cash");
        assertThat(RidePaymentReader.label(some, zero, "Visa •••• 4242")).isEqualTo("UniHop Cash");
        assertThat(RidePaymentReader.label(some, some, "Visa •••• 4242")).isEqualTo("UniHop Cash + Visa •••• 4242");
        assertThat(RidePaymentReader.label(zero, some, "Visa •••• 4242")).isEqualTo("Visa •••• 4242");
    }
}
