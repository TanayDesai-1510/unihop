package com.unihop.ride;

import org.springframework.jdbc.core.JdbcTemplate;

/** Cleanup for tests that commit real rides (not @Transactional). */
public final class RideTestData {

    private RideTestData() {
    }

    /**
     * Deletes every ride and everything that references one, children first. The real PaymentService writes
     * ride_payments, credit_transactions (RIDE_SPEND / RIDE_REFUND) and driver_earnings (RIDE_EARNING) per ride;
     * removing the ride-linked rows also restores seeded balances (rider1's 5.00 PROMO credit has no ride).
     */
    public static void deleteAllRides(JdbcTemplate jdbc) {
        jdbc.update("DELETE FROM chat_messages");
        jdbc.update("DELETE FROM ratings");
        jdbc.update("DELETE FROM driver_earnings WHERE ride_id IS NOT NULL");
        jdbc.update("DELETE FROM credit_transactions WHERE ride_id IS NOT NULL");
        jdbc.update("DELETE FROM ride_payments");
        jdbc.update("DELETE FROM ride_offers");
        jdbc.update("DELETE FROM rides");
    }
}
