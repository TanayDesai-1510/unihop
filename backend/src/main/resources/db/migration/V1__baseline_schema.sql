-- UniHop baseline schema. Frozen once merged: add new migrations with timestamp versions instead.
-- Owners per docs/contract.md section 6.

-- [Hriday]
CREATE TABLE users (
    id            uuid PRIMARY KEY,
    email         varchar(255) NOT NULL UNIQUE,
    name          varchar(100),
    phone         varchar(32),
    mode          varchar(16)  NOT NULL DEFAULT 'RIDER',
    rating_avg    numeric(3,2) NOT NULL DEFAULT 5.00,
    rating_count  int          NOT NULL DEFAULT 0,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

-- [Hriday onboarding fields, Dev is_online/location fields]
CREATE TABLE driver_profiles (
    user_id         uuid PRIMARY KEY REFERENCES users(id),
    license_number  varchar(32)  NOT NULL,
    car_make        varchar(50)  NOT NULL,
    car_model       varchar(50)  NOT NULL,
    car_color       varchar(30)  NOT NULL,
    plate           varchar(16)  NOT NULL,
    status          varchar(16)  NOT NULL DEFAULT 'PENDING',
    is_online       boolean      NOT NULL DEFAULT false,
    current_lat     double precision,
    current_lng     double precision,
    last_seen_at    timestamptz
);

-- [Hriday]
CREATE TABLE hubs (
    id    uuid PRIMARY KEY,
    code  varchar(32)  NOT NULL UNIQUE,
    name  varchar(100) NOT NULL,
    zone  varchar(32)  NOT NULL,
    lat   double precision NOT NULL,
    lng   double precision NOT NULL
);

-- [Hriday]
CREATE TABLE fares (
    from_zone  varchar(32)  NOT NULL,
    to_zone    varchar(32)  NOT NULL,
    price      numeric(5,2) NOT NULL CHECK (price > 0 AND price < 10),
    PRIMARY KEY (from_zone, to_zone)
);

-- [Hriday, mockpay] simulated processor vault. Never a full card number or CVC.
CREATE TABLE mockpay_vault (
    token        varchar(64) PRIMARY KEY,
    brand        varchar(16) NOT NULL,
    last4        char(4)     NOT NULL,
    exp_month    int         NOT NULL,
    exp_year     int         NOT NULL,
    wallet_type  varchar(16),
    behavior     varchar(32) NOT NULL DEFAULT 'SUCCESS',
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- [Hriday, mockpay]
CREATE TABLE mockpay_charges (
    id               varchar(64)  PRIMARY KEY,
    token            varchar(64)  NOT NULL REFERENCES mockpay_vault(token),
    amount           numeric(8,2) NOT NULL,
    status           varchar(16)  NOT NULL,
    idempotency_key  varchar(128) NOT NULL UNIQUE,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now()
);

-- [Hriday]
CREATE TABLE payment_methods (
    id             uuid PRIMARY KEY,
    user_id        uuid        NOT NULL REFERENCES users(id),
    type           varchar(16) NOT NULL,
    brand          varchar(16) NOT NULL,
    last4          char(4)     NOT NULL,
    exp_month      int         NOT NULL,
    exp_year       int         NOT NULL,
    nickname       varchar(50),
    is_default     boolean     NOT NULL DEFAULT false,
    gateway_token  varchar(64) NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id) WHERE deleted_at IS NULL;

-- [Dev]
CREATE TABLE rides (
    id               uuid PRIMARY KEY,
    rider_id         uuid         NOT NULL REFERENCES users(id),
    driver_id        uuid         REFERENCES users(id),
    pickup_hub_id    uuid         NOT NULL REFERENCES hubs(id),
    dropoff_hub_id   uuid         NOT NULL REFERENCES hubs(id),
    status           varchar(16)  NOT NULL,
    fare_total       numeric(5,2) NOT NULL,
    platform_fee     numeric(5,2) NOT NULL,
    base_fare        numeric(5,2) NOT NULL,
    driver_payout    numeric(5,2) NOT NULL,
    platform_margin  numeric(5,2) NOT NULL,
    pin              char(4),
    share_token      varchar(64)  NOT NULL UNIQUE,
    promo_code       varchar(32),
    cancel_reason    varchar(255),
    cancelled_by     varchar(16),
    scheduled_for    timestamptz,
    requested_at     timestamptz  NOT NULL DEFAULT now(),
    accepted_at      timestamptz,
    arrived_at       timestamptz,
    started_at       timestamptz,
    completed_at     timestamptz,
    cancelled_at     timestamptz
);
CREATE INDEX idx_rides_rider ON rides(rider_id, requested_at DESC);
CREATE INDEX idx_rides_driver ON rides(driver_id, requested_at DESC);
CREATE INDEX idx_rides_status ON rides(status);

-- [Dev]
CREATE TABLE ride_offers (
    id            uuid PRIMARY KEY,
    ride_id       uuid        NOT NULL REFERENCES rides(id),
    driver_id     uuid        NOT NULL REFERENCES users(id),
    status        varchar(16) NOT NULL,
    offered_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    responded_at  timestamptz
);
CREATE INDEX idx_ride_offers_driver_status ON ride_offers(driver_id, status);
CREATE INDEX idx_ride_offers_ride ON ride_offers(ride_id);

-- [Hriday] ride FK is deferred so authorizeRide can run before the ride row is flushed.
CREATE TABLE ride_payments (
    id                 uuid PRIMARY KEY,
    ride_id            uuid         NOT NULL UNIQUE REFERENCES rides(id) DEFERRABLE INITIALLY DEFERRED,
    user_id            uuid         NOT NULL REFERENCES users(id),
    payment_method_id  uuid         REFERENCES payment_methods(id),
    amount_total       numeric(8,2) NOT NULL,
    credits_applied    numeric(8,2) NOT NULL DEFAULT 0,
    card_amount        numeric(8,2) NOT NULL DEFAULT 0,
    status             varchar(16)  NOT NULL,
    gateway_ref        varchar(64),
    decline_code       varchar(32),
    authorized_at      timestamptz,
    captured_at        timestamptz,
    voided_at          timestamptz
);

-- [Hriday]
CREATE TABLE credit_transactions (
    id          uuid PRIMARY KEY,
    user_id     uuid         NOT NULL REFERENCES users(id),
    ride_id     uuid         REFERENCES rides(id) DEFERRABLE INITIALLY DEFERRED,
    type        varchar(16)  NOT NULL,
    amount      numeric(8,2) NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- [Hriday]
CREATE TABLE driver_earnings (
    id                 uuid PRIMARY KEY,
    driver_id          uuid         NOT NULL REFERENCES users(id),
    ride_id            uuid         REFERENCES rides(id) DEFERRABLE INITIALLY DEFERRED,
    type               varchar(16)  NOT NULL,
    amount             numeric(8,2) NOT NULL,
    payment_method_id  uuid         REFERENCES payment_methods(id),
    created_at         timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_earnings_driver ON driver_earnings(driver_id, created_at DESC);

-- [Hriday]
CREATE TABLE ratings (
    id          uuid PRIMARY KEY,
    ride_id     uuid        NOT NULL REFERENCES rides(id),
    rater_id    uuid        NOT NULL REFERENCES users(id),
    ratee_id    uuid        NOT NULL REFERENCES users(id),
    stars       int         NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment     varchar(500),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ride_id, rater_id)
);

-- [Dev, stretch]
CREATE TABLE chat_messages (
    id          uuid PRIMARY KEY,
    ride_id     uuid          NOT NULL REFERENCES rides(id),
    sender_id   uuid          NOT NULL REFERENCES users(id),
    body        varchar(1000) NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_ride ON chat_messages(ride_id, created_at);

-- [Hriday, stretch]
CREATE TABLE promo_codes (
    code      varchar(32) PRIMARY KEY,
    discount  numeric(5,2) NOT NULL,
    active    boolean      NOT NULL DEFAULT true
);
