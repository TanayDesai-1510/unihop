package com.unihop.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Contract DTO {@code FareBreakdown}. Frozen (cross-team).
 */
public record FareBreakdown(
        BigDecimal total,
        BigDecimal platformFee,
        BigDecimal baseFare,
        BigDecimal driverPayout,
        BigDecimal platformMargin
) {

    public static final BigDecimal PLATFORM_FEE = new BigDecimal("1.50");
    public static final BigDecimal DRIVER_SHARE = new BigDecimal("0.90");

    /** Contract section 4: fee 1.50, base = total - fee, payout = 90% of base, margin = total - payout. HALF_UP to 2dp. */
    public static FareBreakdown fromTotal(BigDecimal total) {
        BigDecimal t = total.setScale(2, RoundingMode.HALF_UP);
        BigDecimal base = t.subtract(PLATFORM_FEE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal payout = base.multiply(DRIVER_SHARE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal margin = t.subtract(payout).setScale(2, RoundingMode.HALF_UP);
        return new FareBreakdown(t, PLATFORM_FEE, base, payout, margin);
    }
}
