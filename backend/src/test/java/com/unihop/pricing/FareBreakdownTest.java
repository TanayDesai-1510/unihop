package com.unihop.pricing;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class FareBreakdownTest {

    @ParameterizedTest
    @CsvSource({
            // total, baseFare, driverPayout, platformMargin
            "4.50, 3.00, 2.70, 1.80",
            "5.50, 4.00, 3.60, 1.90",
            "6.50, 5.00, 4.50, 2.00",
            "8.50, 7.00, 6.30, 2.20",
            "7.25, 5.75, 5.18, 2.07",
    })
    void appliesContractPricingRules(String total, String base, String payout, String margin) {
        FareBreakdown f = FareBreakdown.fromTotal(new BigDecimal(total));
        assertThat(f.total()).isEqualByComparingTo(total);
        assertThat(f.platformFee()).isEqualByComparingTo("1.50");
        assertThat(f.baseFare()).isEqualByComparingTo(base);
        assertThat(f.driverPayout()).isEqualByComparingTo(payout);
        assertThat(f.platformMargin()).isEqualByComparingTo(margin);
        assertThat(f.driverPayout().add(f.platformMargin())).isEqualByComparingTo(f.total());
        assertThat(f.total().scale()).isEqualTo(2);
    }
}
