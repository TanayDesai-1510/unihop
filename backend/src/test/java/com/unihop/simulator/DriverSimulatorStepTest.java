package com.unihop.simulator;

import com.unihop.matching.Haversine;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class DriverSimulatorStepTest {

    @Test
    void stepsTowardTheTargetAndSnapsOntoItWhenClose() {
        // The Yard -> Busch Student Center, ~2.75 km
        double[] pos = {40.4998, -74.4479};
        double targetLat = 40.5232, targetLng = -74.4585;
        int ticks = 0;
        double previous = Haversine.meters(pos[0], pos[1], targetLat, targetLng);
        while (pos[0] != targetLat || pos[1] != targetLng) {
            pos = DriverSimulator.step(pos[0], pos[1], targetLat, targetLng);
            double remaining = Haversine.meters(pos[0], pos[1], targetLat, targetLng);
            assertThat(remaining).isLessThan(previous);
            previous = remaining;
            ticks++;
            assertThat(ticks).isLessThan(100);
        }
        // at 2 s per tick the leg takes well under a minute
        assertThat(ticks).isBetween(10, 30);
    }

    @Test
    void shortHopsArriveInOneTick() {
        double[] pos = DriverSimulator.step(40.5004, -74.4471, 40.5005, -74.4472);
        assertThat(pos[0]).isEqualTo(40.5005);
        assertThat(pos[1]).isCloseTo(-74.4472, within(0.0));
    }
}
