# UniHop design notes: patterns borrowed from rideshare leaders

Research pass for the frontend design overhaul. We borrow **patterns and flow only**. Never Uber's branding, typeface (Uber Move), icons, illustrations, colors, or exact layouts. Everything visual comes from `frontend/DESIGN.md` (navy + orange, Bricolage / Instrument / Geist Mono, the road motif).

## What we learned

**Uber Base (design system).** Base is a design language (typography, color, grid, motion, content) plus Base Web, an open-source React component library. Public summaries of its principles: *go big on legibility*, *less is more on choices*, *minimal, composable, fast*, and *design for patterns* shared across rider and driver surfaces. One primary button per screen; cards present related content in context while tiles are actionable. Base's motion specs are not public (the docs are SSO-gated), so our motion system comes from Apple's fluid-interface guidance instead (DESIGN.md section 7).

**Rider flow (2016 redesign onward).** The app opens on a single question, "Where to?", instead of a list of car types. Ride options appear only after the destination is known, each showing upfront price and arrival time. The stated reasoning: riders already know where they're going. The current matching screens aren't documented publicly; the general pattern is a full-screen map with step-by-step content in a bottom sheet that reassures while a driver is found.

**Driver app (2018 redesign).** Co-designed with drivers. Goals: a cleaner design and tools that help drivers feel confident. A status bar shows real-time demand while online; trip screens show distance remaining, not just a countdown. There's no public case study of the offer card or its timer.

## Patterns worth borrowing, mapped to UniHop

| Pattern | Why it works | UniHop version |
|---|---|---|
| **One question first: "Where to?"** | Riders already have a destination; it removes a decision. | Rider home opens on a big "Where to?" pill with a "Now" chip. Hub shortcut chips (The Yard, Busch SC, Livingston, Cook) below, because UniHop only goes hub to hub. |
| **Destination first, options after** | Upfront price and ETA make the choice obvious. | After pickup and dropoff are chosen, one ride option row: "UniHop · 4 seats · 3 min away · drop-off 4:12" with the fare in the price-tag style. We have one product, so the row is about confidence, not choice. |
| **Upfront price on every option** | Removes anxiety before committing. | Fare is the biggest thing on the request sheet (Display, price tag), always under $10, rendered on the ticket card. |
| **Map is the canvas, sheet is the conversation** | The map gives place; the sheet gives steps. | Every rider state lives in one glass sheet over the map with detents (peek / half / full). States cross-fade inside the sheet; the page never changes during a ride. |
| **Confirm pickup by moving the map under a fixed pin** | Precise, physical, no tiny targets. | The map drags under a fixed logo pin that lifts while dragging and drops with a spring, snapping to the nearest hub (we only pick up at hubs). |
| **Matching reassures with motion, not text walls** | Waiting feels shorter when something is visibly happening. | Thin animated progress line across the sheet top, pulsing pickup pin, copy that changes over time ("Finding your driver", "Checking nearby drivers", "Almost there"). |
| **En route: one line that answers "where and when"** | The rider glances at it while walking. | "Meet at The Yard · 3 min" headline, driver avatar over a car silhouette tinted to the car color, the plate as a real plate, actions (message, call, share, safety). |
| **In trip: arrival time, not duration** | People plan around clock time. | "Arriving at 4:12" hero line; the road timeline's car advances along a dashed lane. |
| **Single primary action per screen** | Base's button hierarchy. | One accent (orange) CTA per screen max; everything else navy, secondary, or ghost. |
| **Driver confidence tools** | Drivers decide fast under time pressure. | Offer card: big "You earn $X.XX", pickup distance, countdown ring in accent, Accept (accent) vs Decline (ghost). Earnings count up after each trip. |
| **Legibility over decoration** | Glanceable in motion. | Huge numbers, small labels, hierarchy from size and weight rather than boxes. |

## What we deliberately do differently

- **Warmth and identity.** Uber is monochrome; UniHop has a navy hero surface, an orange spark, and the road motif (lane line, ticket, plate) so it reads as a student product, not a clone.
- **Physical motion.** Springs everywhere a finger can touch (Apple's *Designing Fluid Interfaces*): interruptible sheets, momentum projection, velocity handoff, a small "hop" as the micro-signature.
- **Fixed hubs.** No free-form address search; hubs are chips and pins, which makes the flow two taps.

## Sources
- [Uber Base design system overview (Motiff wiki)](https://motiff.com/design-system-wiki/design-systems-overview/uber-base-design-system)
- [Uber design system teardown (Superdesign)](https://www.superdesign.dev/blog/uber-design-system)
- [How we scale design using patterns (Uber Design)](https://www.uber.com/bd/en/careers/design/work/design-platform/)
- [Uber introduces Base Web (Packt Hub)](https://hub.packtpub.com/uber-introduces-base-web-an-open-source-unified-design-system-for-building-websites-in-react)
- [Uber app redesign, 2016 (Fortune)](https://fortune.com/2016/11/02/uber-app-redesign)
- [Uber's latest redesign aims for a quicker pickup (TechCrunch)](https://techcrunch.com/?p=1410318)
- [Uber Redesigns App, Focusing on a Single Question (Mobile Marketing)](https://mobilemarketingmagazine.com/uber-redesigns-app-focusing-on-a-single-question/)
- [Introducing the new Driver app (Uber blog)](https://www.uber.com/ca/en/blog/introducing-the-new-driver-app/)
- [Uber's redesigned app shows drivers where they can get peak fares (The Points Guy)](https://thepointsguy.com/news/ubers-redesigned-app-shows-drivers-where-they-can-get-peak-fares)
