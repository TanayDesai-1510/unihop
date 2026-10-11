package com.unihop.realtime;

import java.util.UUID;

/** Contract section 11: {@code {type: "OFFER_REVOKED", offerId}} on {@code /topic/drivers/{driverId}/offers}. */
public record OfferRevokedEvent(String type, UUID offerId) {

    public static final String TYPE = "OFFER_REVOKED";

    public static OfferRevokedEvent of(UUID offerId) {
        return new OfferRevokedEvent(TYPE, offerId);
    }
}
