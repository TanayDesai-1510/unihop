package com.unihop.payments;

import com.unihop.common.ApiException;
import com.unihop.common.enums.DeclineCode;
import com.unihop.common.enums.PaymentStatus;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class RealPaymentServiceIntegrationTest {
    private static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID RIDER2 = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    private static final UUID RIDER1_APPLE = UUID.fromString("00000000-0000-0000-0000-000000000402");
    private static final UUID RIDER2_DECLINE = UUID.fromString("00000000-0000-0000-0000-000000000404");

    @Autowired PaymentService payments;
    @Autowired JdbcTemplate jdbc;

    @Test
    void authorizeAppliesCreditsFirstAndIsIdempotent() {
        UUID ride = insertRide(RIDER1, DRIVER1);
        PaymentSummary first = payments.authorizeRide(ride, RIDER1, null, true, new BigDecimal("6.50"));
        PaymentSummary second = payments.authorizeRide(ride, RIDER1, RIDER1_APPLE, false,
                new BigDecimal("8.50"));

        assertThat(first).isEqualTo(new PaymentSummary(PaymentStatus.AUTHORIZED,
                "UniHop Cash + Visa •••• 4242", new BigDecimal("5.00"), new BigDecimal("1.50"),
                new BigDecimal("6.50"), null));
        assertThat(second).isEqualTo(first);
        assertThat(count("ride_payments", "ride_id", ride)).isEqualTo(1);
        assertThat(count("credit_transactions", "ride_id", ride)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT amount FROM credit_transactions WHERE ride_id = ? AND type = 'RIDE_SPEND'
                """, BigDecimal.class, ride)).isEqualByComparingTo("-5.00");
        assertThat(jdbc.queryForObject("""
                SELECT amount FROM mockpay_charges WHERE idempotency_key = ?
                """, BigDecimal.class, ride.toString())).isEqualByComparingTo("1.50");
        assertThat(creditBalance(RIDER1)).isEqualByComparingTo("0.00");
    }

    @Test
    void fullCreditsNeedNoCardAndUseCashLabel() {
        UUID user = insertUser();
        jdbc.update("""
                INSERT INTO credit_transactions (id, user_id, type, amount)
                VALUES (?, ?, 'PROMO', 10.00)
                """, UUID.randomUUID(), user);
        UUID ride = insertRide(user, DRIVER1);

        PaymentSummary summary = payments.authorizeRide(ride, user, UUID.randomUUID(), true,
                new BigDecimal("4.50"));
        assertThat(summary.methodLabel()).isEqualTo("UniHop Cash");
        assertThat(summary.creditsApplied()).isEqualByComparingTo("4.50");
        assertThat(summary.cardAmount()).isEqualByComparingTo("0.00");
        assertThat(jdbc.queryForObject("""
                SELECT payment_method_id IS NULL AND gateway_ref IS NULL
                FROM ride_payments WHERE ride_id = ?
                """, Boolean.class, ride)).isTrue();
        assertThat(count("mockpay_charges", "idempotency_key", ride.toString())).isZero();
    }

    @Test
    void selectedWalletIsUsedWhenCreditsAreDisabled() {
        UUID ride = insertRide(RIDER1, DRIVER1);
        PaymentSummary summary = payments.authorizeRide(ride, RIDER1, RIDER1_APPLE, false,
                new BigDecimal("4.50"));
        assertThat(summary.methodLabel()).isEqualTo("Apple Pay");
        assertThat(summary.creditsApplied()).isEqualByComparingTo("0.00");
        assertThat(summary.cardAmount()).isEqualByComparingTo("4.50");
        assertThat(creditBalance(RIDER1)).isEqualByComparingTo("5.00");
    }

    @Test
    void declineAndMissingMethodWriteNothing() {
        UUID declinedRide = insertRide(RIDER2, DRIVER1);
        assertThatThrownBy(() -> payments.authorizeRide(declinedRide, RIDER2, RIDER2_DECLINE,
                false, new BigDecimal("6.50")))
                .isInstanceOfSatisfying(PaymentDeclinedException.class,
                        error -> assertThat(error.getDeclineCode()).isEqualTo(DeclineCode.CARD_DECLINED));
        assertThat(count("ride_payments", "ride_id", declinedRide)).isZero();
        assertThat(count("credit_transactions", "ride_id", declinedRide)).isZero();
        assertThat(count("mockpay_charges", "idempotency_key", declinedRide.toString())).isZero();

        UUID user = insertUser();
        UUID missingRide = insertRide(user, DRIVER1);
        assertThatThrownBy(() -> payments.authorizeRide(missingRide, user, null,
                false, new BigDecimal("4.50")))
                .isInstanceOf(PaymentMethodRequiredException.class);
        assertThat(count("ride_payments", "ride_id", missingRide)).isZero();
    }

    @Test
    void captureCapturesCardAndAddsOneDriverEarning() {
        UUID ride = insertRide(RIDER1, DRIVER1);
        payments.authorizeRide(ride, RIDER1, null, true, new BigDecimal("6.50"));
        payments.captureRide(ride);
        payments.captureRide(ride);

        assertThat(paymentStatus(ride)).isEqualTo("CAPTURED");
        assertThat(jdbc.queryForObject("""
                SELECT status FROM mockpay_charges WHERE idempotency_key = ?
                """, String.class, ride.toString())).isEqualTo("CAPTURED");
        assertThat(count("driver_earnings", "ride_id", ride)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT amount FROM driver_earnings
                WHERE ride_id = ? AND driver_id = ? AND type = 'RIDE_EARNING'
                """, BigDecimal.class, ride, DRIVER1)).isEqualByComparingTo("4.50");
        assertThat(count("credit_transactions", "ride_id", ride)).isEqualTo(1);
        assertThatThrownBy(() -> payments.voidRide(ride))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("INVALID_TRANSITION"));
    }

    @Test
    void voidReleasesCardAndRefundsCreditsExactlyOnce() {
        UUID ride = insertRide(RIDER1, DRIVER1);
        payments.authorizeRide(ride, RIDER1, null, true, new BigDecimal("6.50"));
        payments.voidRide(ride);
        payments.voidRide(ride);

        assertThat(paymentStatus(ride)).isEqualTo("VOIDED");
        assertThat(jdbc.queryForObject("""
                SELECT status FROM mockpay_charges WHERE idempotency_key = ?
                """, String.class, ride.toString())).isEqualTo("VOIDED");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM credit_transactions
                WHERE ride_id = ? AND type = 'RIDE_REFUND'
                """, Integer.class, ride)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT amount FROM credit_transactions
                WHERE ride_id = ? AND type = 'RIDE_REFUND'
                """, BigDecimal.class, ride)).isEqualByComparingTo("5.00");
        assertThat(creditBalance(RIDER1)).isEqualByComparingTo("5.00");
        assertThat(count("driver_earnings", "ride_id", ride)).isZero();
        assertThatThrownBy(() -> payments.captureRide(ride))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("INVALID_TRANSITION"));
    }

    @Test
    void creditsOnlyCaptureAndVoidSkipGateway() {
        UUID user = insertUser();
        jdbc.update("""
                INSERT INTO credit_transactions (id, user_id, type, amount)
                VALUES (?, ?, 'PROMO', 20.00)
                """, UUID.randomUUID(), user);

        UUID completed = insertRide(user, DRIVER1);
        payments.authorizeRide(completed, user, null, true, new BigDecimal("4.50"));
        payments.captureRide(completed);
        assertThat(paymentStatus(completed)).isEqualTo("CAPTURED");

        UUID cancelled = insertRide(user, DRIVER1);
        payments.authorizeRide(cancelled, user, null, true, new BigDecimal("4.50"));
        payments.voidRide(cancelled);
        assertThat(paymentStatus(cancelled)).isEqualTo("VOIDED");
        assertThat(count("mockpay_charges", "idempotency_key", completed.toString())).isZero();
        assertThat(count("mockpay_charges", "idempotency_key", cancelled.toString())).isZero();
    }

    @Test
    void captureRequiresAssignedDriverAndUnknownPaymentsAreNotFound() {
        UUID ride = insertRide(RIDER1, null);
        payments.authorizeRide(ride, RIDER1, null, false, new BigDecimal("4.50"));
        assertThatThrownBy(() -> payments.captureRide(ride))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("INVALID_TRANSITION"));
        assertThat(paymentStatus(ride)).isEqualTo("AUTHORIZED");
        assertThat(jdbc.queryForObject("""
                SELECT status FROM mockpay_charges WHERE idempotency_key = ?
                """, String.class, ride.toString())).isEqualTo("AUTHORIZED");

        for (Runnable operation : new Runnable[]{
                () -> payments.captureRide(UUID.randomUUID()),
                () -> payments.voidRide(UUID.randomUUID())}) {
            assertThatThrownBy(operation::run).isInstanceOfSatisfying(ApiException.class,
                    error -> assertThat(error.getCode()).isEqualTo("NOT_FOUND"));
        }
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, name, mode) VALUES (?, ?, 'Payment Tester', 'RIDER')",
                id, id + "@scarletmail.rutgers.edu");
        return id;
    }

    private UUID insertRide(UUID rider, UUID driver) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides
                    (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total,
                     platform_fee, base_fare, driver_payout, platform_margin, share_token)
                VALUES (?, ?, ?, '00000000-0000-0000-0000-000000000301',
                        '00000000-0000-0000-0000-000000000302', 'REQUESTED',
                        6.50, 1.50, 5.00, 4.50, 2.00, ?)
                """, id, rider, driver, "share-" + id);
        return id;
    }

    private BigDecimal creditBalance(UUID user) {
        return jdbc.queryForObject("""
                SELECT COALESCE(sum(amount), 0) FROM credit_transactions WHERE user_id = ?
                """, BigDecimal.class, user);
    }

    private String paymentStatus(UUID ride) {
        return jdbc.queryForObject("SELECT status FROM ride_payments WHERE ride_id = ?", String.class, ride);
    }

    private int count(String table, String column, Object value) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE " + column + " = ?",
                Integer.class, value);
    }
}
