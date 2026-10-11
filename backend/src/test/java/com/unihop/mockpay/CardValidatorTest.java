package com.unihop.mockpay;

import com.unihop.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.YearMonth;
import static org.assertj.core.api.Assertions.*;

class CardValidatorTest {
    static final YearMonth NOW = YearMonth.of(2026, 10);
    @ParameterizedTest
    @CsvSource({"4242424242424242,VISA,SUCCESS,123", "5555555555554444,MASTERCARD,SUCCESS,123",
            "378282246310005,AMEX,SUCCESS,1234", "6011111111111117,DISCOVER,SUCCESS,123",
            "4000000000000002,VISA,CARD_DECLINED,123", "4000000000009995,VISA,INSUFFICIENT_FUNDS,123",
            "4000000000000069,VISA,EXPIRED_CARD,123", "4000000000000127,VISA,INCORRECT_CVC,123"})
    void allTestCards(String number, String brand, String behavior, String cvc) {
        var result = CardValidator.validate(number, 10, 2030, cvc, NOW);
        assertThat(result.brand().name()).isEqualTo(brand);
        assertThat(result.behavior()).isEqualTo(behavior);
        assertThat(result.last4()).isEqualTo(number.substring(number.length() - 4));
    }
    @Test void supportsSpacesAndCurrentExpiryMonth() {
        assertThat(CardValidator.validate("4242 4242 4242 4242", 10, 2026, "123", NOW).behavior()).isEqualTo("SUCCESS");
    }
    @Test void rejectsInvalidNumbersExpiryAndCvc() {
        for (String number : new String[]{"", "4242424242424241", "123", "4242-4242-4242-4242", "7000000000000005", "41111111111111"}) {
            expect("INVALID_NUMBER", () -> CardValidator.validate(number, 10, 2030, "123", NOW));
        }
        for (Integer month : new Integer[]{null, 0, 13}) {
            expect("INVALID_EXPIRY", () -> CardValidator.validate("4242424242424242", month, 2030, "123", NOW));
        }
        expect("INVALID_EXPIRY", () -> CardValidator.validate("4242424242424242", 9, 2026, "123", NOW));
        expect("INVALID_EXPIRY", () -> CardValidator.validate("4242424242424242", 12, null, "123", NOW));
        for (String cvc : new String[]{null, "12", "1234", "abc"}) {
            expect("INVALID_CVC", () -> CardValidator.validate("4242424242424242", 10, 2030, cvc, NOW));
        }
        expect("INVALID_CVC", () -> CardValidator.validate("378282246310005", 10, 2030, "123", NOW));
    }
    @ParameterizedTest
    @CsvSource({"2221,MASTERCARD", "2720,MASTERCARD", "51,MASTERCARD", "55,MASTERCARD",
            "34,AMEX", "65,DISCOVER", "644,DISCOVER", "649,DISCOVER", "4,VISA"})
    void detectsOtherValidPrefixes(String prefix, String brand) {
        int length = brand.equals("AMEX") ? 15 : 16;
        String base = prefix + "0".repeat(length - prefix.length() - 1);
        // Choose the Luhn check digit independently by testing the weighted sum.
        int sum = 0;
        for (int i = base.length() - 1, position = 0; i >= 0; i--, position++) {
            int digit = base.charAt(i) - '0';
            if (position % 2 == 0) { digit *= 2; digit = digit / 10 + digit % 10; }
            sum += digit;
        }
        String number = base + ((10 - sum % 10) % 10);
        assertThat(CardValidator.validate(number, 10, 2030, brand.equals("AMEX") ? "1234" : "123", NOW)
                .brand().name()).isEqualTo(brand);
    }
    static void expect(String code, org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOf(ApiException.class).extracting("code").isEqualTo(code);
    }
}
