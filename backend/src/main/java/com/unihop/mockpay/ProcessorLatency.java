package com.unihop.mockpay;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ProcessorLatency {
    private final long milliseconds;
    public ProcessorLatency(@Value("${app.mockpay.latency-ms:800}") long milliseconds) {
        if (milliseconds < 0) throw new IllegalArgumentException("Processor latency must not be negative");
        this.milliseconds = milliseconds;
    }
    public void pause() {
        try {
            Thread.sleep(milliseconds);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Processor call interrupted");
        }
    }
}
