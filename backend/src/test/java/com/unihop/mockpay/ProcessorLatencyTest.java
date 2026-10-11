package com.unihop.mockpay;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProcessorLatencyTest {
    @Test
    void appliesConfiguredDelay() {
        Instant started = Instant.now();
        new ProcessorLatency(30).pause();
        assertThat(Duration.between(started, Instant.now())).isGreaterThanOrEqualTo(Duration.ofMillis(20));
    }

    @Test
    void rejectsNegativeDelay() {
        assertThatThrownBy(() -> new ProcessorLatency(-1)).isInstanceOf(IllegalArgumentException.class);
    }
}
