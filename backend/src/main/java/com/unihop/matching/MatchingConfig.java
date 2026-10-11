package com.unihop.matching;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on {@code @Scheduled} for the offer-expiry sweeper. */
@Configuration
@EnableScheduling
public class MatchingConfig {
}
