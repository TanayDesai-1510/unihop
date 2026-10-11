package com.unihop.mockpay;

import com.unihop.common.ApiException;
import com.unihop.common.enums.CardBrand;
import java.time.YearMonth;
import java.util.Map;

final class CardValidator {
    private static final Map<String, String> DECLINES = Map.of(
            "4000000000000002", "CARD_DECLINED", "4000000000009995", "INSUFFICIENT_FUNDS",
            "4000000000000069", "EXPIRED_CARD", "4000000000000127", "INCORRECT_CVC");
    record Validated(CardBrand brand, String last4, String behavior) {}

    static Validated validate(String input, Integer month, Integer year, String cvc, YearMonth now) {
        String number = input == null ? "" : input.replace(" ", "");
        if (!number.matches("[0-9]{13,19}")) throw invalid("INVALID_NUMBER");
        CardBrand brand = brand(number);
        int length = number.length();
        boolean validLength = switch (brand) {
            case VISA -> length == 13 || length == 16 || length == 19;
            case MASTERCARD -> length == 16;
            case AMEX -> length == 15;
            case DISCOVER -> length == 16 || length == 19;
        };
        int sum = 0;
        for (int i = length - 1, position = 0; i >= 0; i--, position++) {
            int digit = number.charAt(i) - '0';
            if (position % 2 == 1) { digit *= 2; if (digit > 9) digit -= 9; }
            sum += digit;
        }
        if (!validLength || sum % 10 != 0) throw invalid("INVALID_NUMBER");
        if (month == null || year == null || month < 1 || month > 12 || year < 1 || year > 9999
                || YearMonth.of(year, month).isBefore(now)) throw invalid("INVALID_EXPIRY");
        if (cvc == null || !cvc.matches(brand == CardBrand.AMEX ? "[0-9]{4}" : "[0-9]{3}")) {
            throw invalid("INVALID_CVC");
        }
        return new Validated(brand, number.substring(length - 4), DECLINES.getOrDefault(number, "SUCCESS"));
    }
    private static CardBrand brand(String number) {
        int first2 = Integer.parseInt(number.substring(0, 2));
        int first3 = Integer.parseInt(number.substring(0, 3));
        int first4 = Integer.parseInt(number.substring(0, 4));
        if (number.startsWith("4")) return CardBrand.VISA;
        if ((first2 >= 51 && first2 <= 55) || (first4 >= 2221 && first4 <= 2720)) return CardBrand.MASTERCARD;
        if (first2 == 34 || first2 == 37) return CardBrand.AMEX;
        if (first4 == 6011 || first2 == 65 || (first3 >= 644 && first3 <= 649)) return CardBrand.DISCOVER;
        throw invalid("INVALID_NUMBER");
    }
    private static ApiException invalid(String code) { return ApiException.badRequest(code, "Invalid card " + code.substring(8).toLowerCase()); }
}
