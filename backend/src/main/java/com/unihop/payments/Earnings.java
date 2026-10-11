package com.unihop.payments;

import com.unihop.records.RideSummary;

import java.math.BigDecimal;
import java.util.List;

/** Contract DTO for a driver's earnings dashboard. */
public record Earnings(
        BigDecimal balance,
        BigDecimal today,
        BigDecimal week,
        BigDecimal total,
        List<RideSummary> rides
) {
}
