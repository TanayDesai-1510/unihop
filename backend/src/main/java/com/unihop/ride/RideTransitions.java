package com.unihop.ride;

import com.unihop.common.ApiException;
import com.unihop.common.enums.RideStatus;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static com.unihop.common.enums.RideStatus.*;

/** Contract section 3 ride state machine. Anything not listed is 409 {@code INVALID_TRANSITION}. */
public final class RideTransitions {

    private static final Map<RideStatus, Set<RideStatus>> ALLOWED = Map.of(
            REQUESTED, EnumSet.of(ACCEPTED, CANCELLED, NO_DRIVERS),
            ACCEPTED, EnumSet.of(ARRIVED, CANCELLED),
            ARRIVED, EnumSet.of(IN_PROGRESS, CANCELLED),
            IN_PROGRESS, EnumSet.of(COMPLETED));

    private static final Set<RideStatus> TERMINAL = EnumSet.of(COMPLETED, CANCELLED, NO_DRIVERS);

    private RideTransitions() {
    }

    public static boolean isAllowed(RideStatus from, RideStatus to) {
        return ALLOWED.getOrDefault(from, Set.of()).contains(to);
    }

    public static void check(RideStatus from, RideStatus to) {
        if (!isAllowed(from, to)) {
            throw ApiException.conflict("INVALID_TRANSITION", "Ride cannot go from " + from + " to " + to);
        }
    }

    public static boolean isTerminal(RideStatus status) {
        return TERMINAL.contains(status);
    }
}
