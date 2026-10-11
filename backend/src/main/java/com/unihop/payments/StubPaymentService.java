package com.unihop.payments;

import com.unihop.common.enums.PaymentStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * SCAFFOLD STUB so Dev can build ride flows from minute one. Hriday replaces this with the real
 * implementation (issue "Real PaymentService"): delete this class when the real one is a @Service.
 * <p>
 * authorizeRide always succeeds and writes nothing; captureRide and voidRide only log.
 */
@Slf4j
@Service
public class StubPaymentService implements PaymentService {

    @Override
    public PaymentSummary authorizeRide(UUID rideId, UUID riderId, UUID paymentMethodId, boolean useCredits, BigDecimal amount) {
        log.info("[stub] authorizeRide ride={} rider={} method={} useCredits={} amount={}",
                rideId, riderId, paymentMethodId, useCredits, amount);
        return new PaymentSummary(PaymentStatus.AUTHORIZED, "Visa •••• 4242", BigDecimal.ZERO.setScale(2), amount, amount, null);
    }

    @Override
    public void captureRide(UUID rideId) {
        log.info("[stub] captureRide ride={}", rideId);
    }

    @Override
    public void voidRide(UUID rideId) {
        log.info("[stub] voidRide ride={}", rideId);
    }
}
