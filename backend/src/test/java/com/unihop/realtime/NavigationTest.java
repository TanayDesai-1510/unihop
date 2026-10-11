package com.unihop.realtime;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class NavigationTest {

    @Test
    void headingIsClockwiseFromNorth() {
        assertThat(Navigation.heading(40.50, -74.45, 40.51, -74.45)).isCloseTo(0, within(0.5));
        assertThat(Navigation.heading(40.50, -74.45, 40.50, -74.44)).isCloseTo(90, within(0.5));
        assertThat(Navigation.heading(40.51, -74.45, 40.50, -74.45)).isCloseTo(180, within(0.5));
        assertThat(Navigation.heading(40.50, -74.44, 40.50, -74.45)).isCloseTo(270, within(0.5));
        assertThat(Navigation.heading(40.50, -74.45, 40.49, -74.46)).isBetween(180.0, 270.0);
    }

    @Test
    void etaUsesRoadFactorAndCampusSpeed() {
        assertThat(Navigation.etaSeconds(40.4998, -74.4479, 40.4998, -74.4479)).isZero();
        // The Yard -> Busch Student Center is ~2.75 km straight line: ~2.75 * 1.3 / 8 m/s ~ 7.5 min
        assertThat(Navigation.etaSeconds(40.4998, -74.4479, 40.5232, -74.4585)).isBetween(420, 480);
    }
}
