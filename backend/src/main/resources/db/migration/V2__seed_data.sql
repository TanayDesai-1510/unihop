-- UniHop seed data. Fixed UUIDs are listed in docs/contract.md section 7. Frozen once merged.

-- Hubs
INSERT INTO hubs (id, code, name, zone, lat, lng) VALUES
  ('00000000-0000-0000-0000-000000000301', 'YARD',        'The Yard',                  'COLLEGE_AVE',   40.4998, -74.4479),
  ('00000000-0000-0000-0000-000000000302', 'BUSCH_SC',    'Busch Student Center',      'BUSCH',         40.5232, -74.4585),
  ('00000000-0000-0000-0000-000000000303', 'LIVI_SC',     'Livingston Student Center', 'LIVINGSTON',    40.5240, -74.4366),
  ('00000000-0000-0000-0000-000000000304', 'COOK_CC',     'Cook Campus Center',        'COOK_DOUGLASS', 40.4797, -74.4362),
  ('00000000-0000-0000-0000-000000000305', 'DOUGLASS_SC', 'Douglass Student Center',   'COOK_DOUGLASS', 40.4853, -74.4371),
  ('00000000-0000-0000-0000-000000000306', 'NB_STATION',  'New Brunswick Station',     'DOWNTOWN',      40.4966, -74.4455);

-- Fares: symmetric zone table, both directions stored (25 rows)
INSERT INTO fares (from_zone, to_zone, price) VALUES
  ('COLLEGE_AVE',   'COLLEGE_AVE',   4.50),
  ('COLLEGE_AVE',   'BUSCH',         6.50),
  ('COLLEGE_AVE',   'LIVINGSTON',    6.50),
  ('COLLEGE_AVE',   'COOK_DOUGLASS', 6.50),
  ('COLLEGE_AVE',   'DOWNTOWN',      4.50),
  ('BUSCH',         'COLLEGE_AVE',   6.50),
  ('BUSCH',         'BUSCH',         4.50),
  ('BUSCH',         'LIVINGSTON',    5.50),
  ('BUSCH',         'COOK_DOUGLASS', 8.50),
  ('BUSCH',         'DOWNTOWN',      6.50),
  ('LIVINGSTON',    'COLLEGE_AVE',   6.50),
  ('LIVINGSTON',    'BUSCH',         5.50),
  ('LIVINGSTON',    'LIVINGSTON',    4.50),
  ('LIVINGSTON',    'COOK_DOUGLASS', 8.50),
  ('LIVINGSTON',    'DOWNTOWN',      6.50),
  ('COOK_DOUGLASS', 'COLLEGE_AVE',   6.50),
  ('COOK_DOUGLASS', 'BUSCH',         8.50),
  ('COOK_DOUGLASS', 'LIVINGSTON',    8.50),
  ('COOK_DOUGLASS', 'COOK_DOUGLASS', 4.50),
  ('COOK_DOUGLASS', 'DOWNTOWN',      5.50),
  ('DOWNTOWN',      'COLLEGE_AVE',   4.50),
  ('DOWNTOWN',      'BUSCH',         6.50),
  ('DOWNTOWN',      'LIVINGSTON',    6.50),
  ('DOWNTOWN',      'COOK_DOUGLASS', 5.50),
  ('DOWNTOWN',      'DOWNTOWN',      4.50);

-- Users
INSERT INTO users (id, email, name, phone, mode, rating_avg, rating_count) VALUES
  ('00000000-0000-0000-0000-000000000101', 'rider1@scarletmail.rutgers.edu',  'Jordan Patel', '732-555-0101', 'RIDER',  4.95, 21),
  ('00000000-0000-0000-0000-000000000102', 'rider2@scarletmail.rutgers.edu',  'Sam Rivera',   '732-555-0102', 'RIDER',  4.80, 9),
  ('00000000-0000-0000-0000-000000000201', 'driver1@scarletmail.rutgers.edu', 'Alex Kim',     '732-555-0201', 'DRIVER', 4.92, 134),
  ('00000000-0000-0000-0000-000000000202', 'driver2@scarletmail.rutgers.edu', 'Maya Johnson', '732-555-0202', 'DRIVER', 4.97, 212),
  ('00000000-0000-0000-0000-000000000203', 'driver3@scarletmail.rutgers.edu', 'Chris Nguyen', '732-555-0203', 'DRIVER', 4.85, 76),
  ('00000000-0000-0000-0000-000000000204', 'driver4@scarletmail.rutgers.edu', 'Priya Shah',   '732-555-0204', 'DRIVER', 4.99, 158),
  ('00000000-0000-0000-0000-000000000205', 'driver5@scarletmail.rutgers.edu', 'Marcus Lee',   '732-555-0205', 'DRIVER', 4.88, 97);

-- Driver profiles: APPROVED, online, each parked near a different hub
INSERT INTO driver_profiles (user_id, license_number, car_make, car_model, car_color, plate, status, is_online, current_lat, current_lng, last_seen_at) VALUES
  ('00000000-0000-0000-0000-000000000201', 'K2041 38211 07154', 'Honda',   'Civic',   'Blue',   'R23-HKP', 'APPROVED', true, 40.5004, -74.4471, now()),
  ('00000000-0000-0000-0000-000000000202', 'J6372 90145 22381', 'Toyota',  'Camry',   'Silver', 'S81-MTW', 'APPROVED', true, 40.5226, -74.4577, now()),
  ('00000000-0000-0000-0000-000000000203', 'N1198 47302 91046', 'Hyundai', 'Elantra', 'White',  'K56-BNX', 'APPROVED', true, 40.5233, -74.4378, now()),
  ('00000000-0000-0000-0000-000000000204', 'S5520 13987 64420', 'Toyota',  'Prius',   'Gray',   'T09-LRV', 'APPROVED', true, 40.4804, -74.4351, now()),
  ('00000000-0000-0000-0000-000000000205', 'L3307 66518 30992', 'Honda',   'Accord',  'Black',  'M74-GDC', 'APPROVED', true, 40.4972, -74.4463, now());

-- Mock processor vault (token, brand, last4, expiry, behavior only)
INSERT INTO mockpay_vault (token, brand, last4, exp_month, exp_year, wallet_type, behavior) VALUES
  ('tok_seed_rider1_visa',     'VISA',       '4242', 12, 2030, NULL,        'SUCCESS'),
  ('tok_seed_rider1_applepay', 'VISA',       '8431', 11, 2031, 'APPLE_PAY', 'SUCCESS'),
  ('tok_seed_rider2_mc',       'MASTERCARD', '4444',  9, 2029, NULL,        'SUCCESS'),
  ('tok_seed_rider2_oldcard',  'VISA',       '0002',  6, 2028, NULL,        'CARD_DECLINED'),
  ('tok_seed_driver1_debit',   'VISA',       '5556',  3, 2030, NULL,        'SUCCESS'),
  ('tok_seed_driver2_debit',   'VISA',       '5556',  3, 2030, NULL,        'SUCCESS'),
  ('tok_seed_driver3_debit',   'VISA',       '5556',  3, 2030, NULL,        'SUCCESS'),
  ('tok_seed_driver4_debit',   'VISA',       '5556',  3, 2030, NULL,        'SUCCESS'),
  ('tok_seed_driver5_debit',   'VISA',       '5556',  3, 2030, NULL,        'SUCCESS');

-- Saved payment methods
INSERT INTO payment_methods (id, user_id, type, brand, last4, exp_month, exp_year, nickname, is_default, gateway_token, created_at) VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', 'CARD',      'VISA',       '4242', 12, 2030, NULL,         true,  'tok_seed_rider1_visa',     now() - interval '30 days'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', 'APPLE_PAY', 'VISA',       '8431', 11, 2031, NULL,         false, 'tok_seed_rider1_applepay', now() - interval '20 days'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000102', 'CARD',      'MASTERCARD', '4444',  9, 2029, NULL,         true,  'tok_seed_rider2_mc',       now() - interval '30 days'),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000102', 'CARD',      'VISA',       '0002',  6, 2028, 'Old card',   false, 'tok_seed_rider2_oldcard',  now() - interval '200 days'),
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000201', 'CARD',      'VISA',       '5556',  3, 2030, 'Debit card', true,  'tok_seed_driver1_debit',   now() - interval '60 days'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000202', 'CARD',      'VISA',       '5556',  3, 2030, 'Debit card', true,  'tok_seed_driver2_debit',   now() - interval '60 days'),
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000203', 'CARD',      'VISA',       '5556',  3, 2030, 'Debit card', true,  'tok_seed_driver3_debit',   now() - interval '60 days'),
  ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000204', 'CARD',      'VISA',       '5556',  3, 2030, 'Debit card', true,  'tok_seed_driver4_debit',   now() - interval '60 days'),
  ('00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-000000000205', 'CARD',      'VISA',       '5556',  3, 2030, 'Debit card', true,  'tok_seed_driver5_debit',   now() - interval '60 days');

-- UniHop Cash: rider1 gets $5.00 promo credits
INSERT INTO credit_transactions (id, user_id, ride_id, type, amount) VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', NULL, 'PROMO', 5.00);
