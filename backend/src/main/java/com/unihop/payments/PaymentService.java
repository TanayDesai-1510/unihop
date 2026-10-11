package com.unihop.payments;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Cross-team interface (contract section 1). Signatures are frozen.
 * Dev calls these from the ride lifecycle; Hriday owns the implementation.
 */
public interface PaymentService {

    /**
     * Hold the fare for a new ride. Called inside the ride-creation transaction.
     *
     * @param paymentMethodId nullable, null means the rider's default method
     * @throws PaymentDeclinedException       402 PAYMENT_DECLINED with a declineCode
     * @throws PaymentMethodRequiredException 402 PAYMENT_METHOD_REQUIRED
     */
    PaymentSummary authorizeRide(UUID rideId, UUID riderId, UUID paymentMethodId, boolean useCredits, BigDecimal amount);

    /** Ride COMPLETED: capture the hold, finalize credits, add driver earnings. Idempotent. */
    void captureRide(UUID rideId);

    /** Ride CANCELLED or NO_DRIVERS: release the hold, restore credits. Idempotent. */
    void voidRide(UUID rideId);
}
