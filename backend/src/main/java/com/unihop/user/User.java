package com.unihop.user;

import com.unihop.common.enums.UserMode;
import java.math.BigDecimal;
import java.util.UUID;

public record User(UUID id, String email, String name, String phone, UserMode mode,
                   BigDecimal ratingAvg, int ratingCount, boolean isDriverApproved) {}
