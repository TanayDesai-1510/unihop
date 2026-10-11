# UniHop Design System

Every screen follows this file. If something isn't covered, match the closest existing pattern instead of inventing a new one. Do not change these tokens without asking the human.

## 1. Product feel
UniHop should feel like a real, shipped rideshare app built by a confident team: calm, fast, trustworthy. The map is the hero; UI sits on top of it in sheets and cards. Think Uber's clarity with a bit more warmth, built for students.

- One primary action per screen, always obvious
- Numbers (fares, ETAs, earnings) are big, bold, and easy to scan
- State changes (searching, driver found, arrived) feel alive through motion, not text walls
- Never looks like a template: no default Tailwind colors, no purple gradients, no stock emoji icons
- Feels unmistakably UniHop: navy, white, and a confident orange spark, straight from the logo

## 2. Brand and color tokens

### Logo
The UniHop logo is a white location pin wearing a graduation cap, with a winding road (one orange lane, one white lane with dashes) running through it, on a navy rounded square. It says: students, place, journey.
- Source file: `public/brand/logo-source.png`. Derived assets live in `public/brand/` (see the setup prompt).
- App icon / favicon / PWA icons: the full navy rounded-square version.
- In-app mark (top bar, login, splash, receipt): the pin mark on a transparent background, or the full icon at small sizes. Never stretch, recolor, rotate, add effects, or place the navy icon on a navy surface without a white or light container.
- Wordmark: "UniHop" set in Bricolage Grotesque 800 with tight tracking, "Uni" in `--brand`, "Hop" in `--accent`. In dark mode "Uni" uses `--ink`.
- Minimum clear space around the mark: 25% of its width.

### Colors (taken from the logo)
Define as CSS variables in `globals.css` and expose through Tailwind. Light mode is the default; dark mode follows `prefers-color-scheme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | #002E73 | #5B8DEF | UniHop navy: primary buttons, active nav, links, selected states, headers |
| `--brand-strong` | #001F4F | #8DB0F5 | Pressed states, high-emphasis text on brand-soft |
| `--brand-soft` | #E8EEF8 | #13254A | Selected rows, info backgrounds, chips |
| `--accent` | #FE6531 | #FF7A4D | UniHop orange: hero CTAs (Request UniHop, Accept), live route line, live car marker, offer countdown, active ride status |
| `--accent-soft` | #FFEFE8 | #3D2015 | Accent tints, highlight backgrounds |
| `--bg` | #FFFFFF | #0A1222 | App background (dark mode is navy-tinted, not pure gray) |
| `--surface` | #F4F6FA | #111B2F | Cards, inputs, secondary areas |
| `--surface-raised` | #FFFFFF | #17233B | Bottom sheets, modals |
| `--ink` | #0B1630 | #F2F5FA | Primary text |
| `--ink-muted` | #5A6478 | #98A3B8 | Secondary text, labels |
| `--line` | #E1E6EF | #24314D | Dividers, borders |
| `--on-brand` | #FFFFFF | #FFFFFF | Text and icons on brand or accent fills |
| `--success` | #12A150 | #2CC56F | Completed, captured, earnings |
| `--warning` | #E8A317 | #F2BE45 | Pending states (kept yellow so it never reads as the orange accent) |
| `--danger` | #D92D20 | #FF5A50 | Declines, cancel, SOS |

Rules:
- Navy carries the app; orange is the spark. Roughly 60% neutrals, 30% navy, 10% orange. If a screen has more than two orange elements, one of them is wrong.
- Orange is reserved for: the single hero CTA on a screen, things that are live or moving (route line, car marker, countdown, in-progress status), and the wordmark "Hop".
- The rider's route on the map is drawn like the logo's road: an orange line with a thin white casing.
- Map pins for hubs use a small navy pin; the selected pickup/dropoff uses the logo pin shape.
- Cancel and decline use outlined or ghost styling, never an orange or red fill (except SOS).
- Text contrast meets WCAG AA. White text on `--accent` must be 16px+ and semibold or larger.
- Never use default Tailwind palette colors directly; always tokens.

## 3. Typography
Three fonts, each with one job. Load all through `next/font/google` (self-hosted, no layout shift).

- **Display: Bricolage Grotesque** (700 and 800, use the optical-size axis). Characterful, confident, a bit playful: screen titles, hero headlines, fares, ETAs, earnings, the wordmark. Tight tracking (-0.02em to -0.04em at large sizes).
- **Text: Instrument Sans** (400, 500, 600). Clean and modern: body, labels, buttons, lists, inputs.
- **Mono: Geist Mono** (500, 600). Only for the license plate, the ride PIN, card numbers, and timers.

| Style | Font | Size / line height | Weight | Use |
|---|---|---|---|---|
| Hero | Display | 48 / 48 | 800 | Login headline, receipt fare, earnings balance |
| Display | Display | 36 / 40 | 800 | Fare on request sheet, ETA |
| Title | Display | 26 / 30 | 700 | Screen titles, sheet headers |
| Headline | Text | 18 / 24 | 600 | Card titles, driver name |
| Body | Text | 16 / 24 | 400 | Default text |
| Label | Text | 14 / 20 | 500 | Form labels, secondary text |
| Caption | Text | 12 / 16 | 600 | Metadata, badges, uppercase eyebrows (+0.08em tracking) |
| Mono | Mono | 16 to 28 | 600 | Plate, PIN, card number |

- All numbers use `font-variant-numeric: tabular-nums`. Big money figures put the `$` and cents at about 55% size, top-aligned (like a price tag).
- Headlines may highlight one key phrase in `--accent` (e.g. "Every ride under **$10**."). One highlight per screen, max.
- Minimum input text size is 16px (prevents iOS zoom).

## 3b. Visual language (what makes it UniHop, not a template)
The logo's **road** is the signature motif. Use it with intent, not everywhere.

- **The lane line**: a dashed white or `--line` stroke (rounded dashes, like the logo road) used for the ride progress timeline, the pickup-to-dropoff connector, and section dividers on key screens. The ride timeline is a road: a small car glides along it as status advances.
- **Navy hero surfaces**: login, splash, driver offer, and receipt top halves use full-bleed `--brand` with white type and a soft radial orange glow in one corner (very subtle, 10 to 15% opacity). Everything else stays light and calm.
- **Glass sheets over the map**: bottom sheets over the map use `--surface-raised` at 92% with `backdrop-filter: blur(20px) saturate(1.4)` and a hairline top border.
- **The ticket**: fare quotes and receipts are a ticket card with perforated notches on both sides and a dashed tear line between route and price.
- **License plate**: drivers' plates render as a real plate (white, navy border, Mono 600, slight inner shadow).
- **The hop**: UniHop's micro-signature is a small bounce. The accent CTA does a tiny hop (translateY -2px spring) when it becomes enabled; the success check hops once; loading uses three dots hopping in sequence instead of a spinner where space allows.
- **Depth**: layered, soft shadows (two layers: tight + wide) on floating elements; never harsh gray drop shadows.
- **Illustrated empty states**: simple line illustrations built from the road motif (a winding dashed road with a pin), drawn in SVG with tokens.
- **Generous scale contrast**: huge numbers next to small labels. Hierarchy comes from size and weight, not from boxes and borders.

## 4. Spacing, radius, elevation
- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40. Screen side padding is 20.
- Radius: inputs and small chips 12, buttons 14, cards 16, bottom sheets 24 (top corners only), avatars and status dots full.
- Elevation: sheets `0 -8px 30px rgba(14,17,22,0.12)`, floating cards `0 4px 16px rgba(14,17,22,0.08)`. In dark mode use borders (`--line`) instead of heavy shadows.

## 5. Layout
- Design for 375px wide first; must also look right at 390 to 430. On desktop, center the app in a 430px column (looks like a phone) so judges see the real mobile layout.
- Respect safe areas: `env(safe-area-inset-top/bottom)` on the top bar, bottom nav, and bottom sheets.
- Touch targets at least 44x44px.
- **Core pattern: full-screen map + bottom sheet.** Rider home, finding driver, active ride, and driver home all use a map behind a draggable bottom sheet with snap points (peek, half, full). Only list-style screens (history, payment methods, earnings, profile) are normal scroll pages.
- Bottom nav (Home, Activity, Payment/Earnings, Profile) is hidden during an active ride.

## 6. Components
Build these once in `src/components/ui/` and reuse everywhere.

- **Button**: height 52, full width by default, radius 14, Headline-weight text. Variants: primary (brand navy fill), accent (orange fill, only the one hero CTA per screen like "Request UniHop" and "Accept"), secondary (surface fill), ghost (text only), danger-outline. Loading state shows a spinner and keeps width fixed. Pressed state scales to 0.98.
- **Input**: height 52, surface fill, no border until focus (2px brand ring), label above, error text below in danger.
- **Card**: surface-raised, radius 16, padding 16.
- **ListRow**: 56 to 64 tall, leading icon or avatar, title + secondary text, trailing value or chevron. Used for hubs, payment methods, rides.
- **BottomSheet**: drag handle (36x4, ink-muted at 30%), radius 24 top, snap points, backdrop only when full.
- **StatusPill**: caption text, small dot, colors by status (accent for live in-progress states, brand for accepted/scheduled, success for completed, warning for pending, ink-muted for cancelled).
- **Badge** for card brands: text-based (VISA, MC, AMEX, DISC) in a small rounded rectangle, not logo artwork.
- **Toast**: top of screen, auto-dismiss 3s, for success and non-blocking errors.
- **Skeleton** loaders matching the real layout shape, never a centered spinner on a blank page.
- Icons: `lucide-react`, 20 or 24px, stroke 1.75 to 2, rounded caps. No emoji as icons.

## 7. Motion
Use `motion` (Framer Motion) for sheets and state transitions; CSS for small things.
- Durations: 150ms (press, toggles), 250ms (sheets, cards in/out), 400ms (major state changes). Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Ride states cross-fade and slide within the same sheet rather than jumping to a new page.
- Finding driver: pulsing accent ring around the logo-shaped pickup pin.
- Driver offer: circular countdown ring (15s) in accent, turning danger in the last 5s.
- Live car marker glides between location updates (interpolate, don't teleport) and rotates to heading.
- Card decline: input row shakes once (200ms) plus the error message.
- Respect `prefers-reduced-motion`: replace movement with fades.

## 8. Key screens
- **Splash**: logo icon centered on `--brand`, scales in with a soft spring, road lane draws in, then fades to login or home (under 1.2s total, skipped on repeat visits).
- **Login**: logo mark + wordmark + one line value prop ("Every ride under $10. Students only."), scarletmail input, then a 6-box OTP input with auto-advance and paste support. The dev OTP shows as a small hint card ("Demo code: 123456").
- **Rider home**: map with hub pins, sheet titled "Where to?", pickup and dropoff as ListRows, then a fare card (big fare, "Under $10, always" caption), payment row ("Visa •••• 4242", tap to change), UniHop Cash toggle, and an accent "Request UniHop" button.
- **Finding driver**: pulsing pin, "Finding your driver" with live elapsed time, cancel ghost button.
- **Active ride (rider)**: driver card (name, rating, car color + model, plate in a bold plate-style box), large 4-digit PIN with "Share this with your driver", status timeline (Accepted, Arrived, In progress), ETA in Display style, share trip and SOS actions.
- **Driver home**: big online/offline toggle (offline = ink-muted, online = brand fill with an accent glow and a "You're online" pill), today's earnings summary card.
- **Driver offer**: full-width sheet slides up with haptic-style bounce, pickup to dropoff, distance to pickup, big "You earn $X.XX", countdown ring, Accept (accent) and Decline (ghost).
- **Driver active ride**: navigation-style top card with next step, "I've arrived", PIN entry (4 boxes), "Complete ride".
- **Receipt**: success check animation, fare in Display, breakdown rows (Rider paid, Platform & safety fee, Driver earns), payment method row, star rating (large, tappable), optional comment.
- **Payment**: UniHop Cash card at top (balance, Add funds), then saved methods as ListRows with brand badges, default marked with a check, swipe or menu to delete, "Add payment method" opens a sheet: Card, Apple Pay, Google Pay.
- **Add card**: live card preview at top that flips to the back when CVC is focused, brand detected as you type (preview color changes per brand), number auto-formats in groups, expiry MM/YY, CVC length by brand, inline validation, nickname optional, "Save card" button with realistic ~800ms processing state.
- **Apple Pay / Google Pay sheets**: native-feeling bottom sheets. Apple Pay style: black sheet, card row, "Confirm with Side Button" animation for ~1.2s, then checkmark. Google Pay style: white sheet with account row and a "Continue" button. Text-based buttons only, no official logo artwork.
- **Earnings**: Display-size balance, today/week/total tabs, per-ride list, "Cash out" primary button with destination debit card row, success state showing amount sent.

## 9. Copy
- Short, human, direct. Sentence case everywhere ("Request UniHop", not "REQUEST UNIHOP").
- No em dashes. No exclamation marks except on true celebration moments (ride complete).
- Errors say what happened and what to do: "Your card was declined. Try another payment method." "No drivers nearby right now. Try again in a minute."
- Money always as $X.XX.

## 10. States checklist (every screen)
Loading (skeleton), empty (friendly message + one action), error (message + retry), offline/reconnecting banner for WebSocket drops, and disabled buttons that explain why when tapped.

## 11. Don'ts
- No default Tailwind colors used directly (always tokens)
- No centered-spinner-on-blank-page loading
- No modal stacked on modal
- No horizontal page scroll at 375px
- No placeholder lorem ipsum in anything a judge might see
- No official Apple, Google, Visa, or Mastercard logo artwork
