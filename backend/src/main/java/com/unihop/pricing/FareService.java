package com.unihop.pricing;

import java.util.UUID;

/**
 * Cross-team interface (contract section 1). Signature is frozen.
 * Called by Dev's ride creation.
 */
public interface FareService {

    /**
     * @throws com.unihop.common.ApiException 404 HUB_NOT_FOUND for an unknown hub, 400 SAME_HUB if both ids are equal
     */
    FareBreakdown quote(UUID fromHubId, UUID toHubId);
}
