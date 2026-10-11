package com.unihop.matching;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class HaversineTest {

    @Test
    void knownDistances() {
        assertThat(Haversine.meters(40.4998, -74.4479, 40.4998, -74.4479)).isZero();
        // one degree of latitude is ~111.2 km
        assertThat(Haversine.meters(40, -74, 41, -74)).isCloseTo(111_195, within(50.0));
        // The Yard -> Busch Student Center, ~2.75 km
        assertThat(Haversine.meters(40.4998, -74.4479, 40.5232, -74.4585)).isCloseTo(2_750, within(100.0));
        assertThat(Haversine.meters(40.5, -74.4, 40.6, -74.5)).isEqualTo(Haversine.meters(40.6, -74.5, 40.5, -74.4));
    }
}
