# UniHop Design System

Every screen follows this file. If something isn't covered, match the closest existing pattern instead of inventing a new one. Do not change these tokens without asking the human.

## 1. Product feel
UniHop should feel like a real, shipped rideshare app built by a confident team: calm, fast, trustworthy. The map is the hero; UI sits on top of it in sheets and cards. Think Uber's clarity with a bit more warmth, built for students.

- One primary action per screen, always obvious
- Numbers (fares, ETAs, earnings) are big, bold, and easy to scan
- State changes (searching, driver found, arrived) feel alive through motion, not text walls
- Never looks like a template: no default Tailwind blue, no purple gradients, no stock emoji icons

## 2. Color tokens
Define as CSS variables in `globals.css` and expose through Tailwind. Light mode is the default; dark mode follows `prefers-color-scheme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FFFFFF | #0E1116 | App background |
| `--surface` | #F5F6F8 | #171B22 | Cards, inputs, secondary areas |
| `--surface-raised` | #FFFFFF | #1E232C | Bottom sheets, modals |
| `--ink` | #0E1116 | #F2F4F7 | Primary text, primary buttons |
| `--ink-muted` | #5B6472 | #9AA3B2 | Secondary text, labels |
| `--line` | #E4E7EC | #2A303B | Dividers, borders |
| `--brand` | #FF4D3D | #FF5C4D | UniHop accent: brand moments, active states, live markers |
| `--brand-soft` | #FFF0EE | #3A1D1A | Brand tints, selected rows |
| `--success` | #12A150 | #2CC56F | Completed, captured, earnings |
| `--warning` | #E89A0C | #F2B233 | Pending, expiring offer |
| `--danger` | #E5383B | #FF5A5D | Declines, cancel, SOS |

Rules:
- Primary buttons are **ink** (black in light, near-white in dark). Brand red is the accent, not every button.
- Brand red is used for: the logo, the rider's live position/route, the active ride status, the driver offer countdown ring, and selected states.
- Never put brand red and danger red next to each other. Cancel/decline uses outlined or ghost styling, not a red fill, except SOS.
- Text contrast meets WCAG AA.

## 3. Typography
Font: **Geist** (already bundled with Next.js), fallback `system-ui, sans-serif`. Use `font-variant-numeric: tabular-nums` for every price, ETA, timer, and earnings figure.

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| Display | 40 / 44 | 700 | Fare on receipt, earnings total |
| Title | 24 / 30 | 700 | Screen titles, sheet headers |
| Headline | 18 / 24 | 600 | Card titles, driver name |
| Body | 16 / 24 | 400 | Default text |
| Label | 14 / 20 | 500 | Form labels, list secondary text |
| Caption | 12 / 16 | 500 | Metadata, timestamps, badges |

Minimum body size is 16px (prevents iOS zoom on inputs).

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

- **Button**: height 52, full width by default, radius 14, Headline-weight text. Variants: primary (ink fill), brand (brand fill, only for "Request UniHop" and "Accept"), secondary (surface fill), ghost (text only), danger-outline. Loading state shows a spinner and keeps width fixed. Pressed state scales to 0.98.
- **Input**: height 52, surface fill, no border until focus (2px ink ring), label above, error text below in danger.
- **Card**: surface-raised, radius 16, padding 16.
- **ListRow**: 56 to 64 tall, leading icon or avatar, title + secondary text, trailing value or chevron. Used for hubs, payment methods, rides.
- **BottomSheet**: drag handle (36x4, ink-muted at 30%), radius 24 top, snap points, backdrop only when full.
- **StatusPill**: caption text, small dot, colors by status (brand for in-progress states, success for completed, warning for pending, ink-muted for cancelled).
- **Badge** for card brands: text-based (VISA, MC, AMEX, DISC) in a small rounded rectangle, not logo artwork.
- **Toast**: top of screen, auto-dismiss 3s, for success and non-blocking errors.
- **Skeleton** loaders matching the real layout shape, never a centered spinner on a blank page.
- Icons: `lucide-react`, 20 or 24px, stroke 2. No emoji as icons.

## 7. Motion
Use `motion` (Framer Motion) for sheets and state transitions; CSS for small things.
- Durations: 150ms (press, toggles), 250ms (sheets, cards in/out), 400ms (major state changes). Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Ride states cross-fade and slide within the same sheet rather than jumping to a new page.
- Finding driver: pulsing brand ring around the pickup pin.
- Driver offer: circular countdown ring (15s) in brand, turning warning in the last 5s.
- Live car marker glides between location updates (interpolate, don't teleport) and rotates to heading.
- Card decline: input row shakes once (200ms) plus the error message.
- Respect `prefers-reduced-motion`: replace movement with fades.

## 8. Key screens
- **Login**: logo + one line value prop ("Every ride under $10. Students only."), scarletmail input, then a 6-box OTP input with auto-advance and paste support. The dev OTP shows as a small hint card ("Demo code: 123456").
- **Rider home**: map with hub pins, sheet titled "Where to?", pickup and dropoff as ListRows, then a fare card (big fare, "Under $10, always" caption), payment row ("Visa •••• 4242", tap to change), UniHop Cash toggle, and a brand "Request UniHop" button.
- **Finding driver**: pulsing pin, "Finding your driver" with live elapsed time, cancel ghost button.
- **Active ride (rider)**: driver card (name, rating, car color + model, plate in a bold plate-style box), large 4-digit PIN with "Share this with your driver", status timeline (Accepted, Arrived, In progress), ETA in Display style, share trip and SOS actions.
- **Driver home**: big online/offline toggle (offline = ink-muted, online = success with "You're online" pill), today's earnings summary card.
- **Driver offer**: full-width sheet slides up with haptic-style bounce, pickup to dropoff, distance to pickup, big "You earn $X.XX", countdown ring, Accept (brand) and Decline (ghost).
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
