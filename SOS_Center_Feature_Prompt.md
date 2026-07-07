# SOS Center — Feature Integration Prompt
### For: `Amruni-Internship` repo · Branch: `feature/sos-center`

---

## Context

You are working inside the `Amruni-Internship` monorepo. The app lives at `amruni-app/`. It is a React + Vite PWA (React 19, React Router 7, Framer Motion 12) using only CSS custom properties — no Tailwind, no component library. All design tokens live in `src/index.css`. The app uses `AppContext` (useReducer + localStorage) for global state. Impeccable is the design skill wired into this repo — use it for all UI work.

**Before touching any code**, run:
```bash
node .claude/skills/impeccable/scripts/context.mjs --target amruni-app
```
Read the output in full. Then read `reference/product.md` (impeccable register is `product`).

---

## Step 0 — Branch

```bash
cd amruni-app
git checkout -b feature/sos-center
```

---

## What to Build

**SOS Center** — a one-tap emergency feature accessible from anywhere in the app.

### Features

1. **One-tap SOS trigger** — a persistent floating SOS button visible on all authenticated screens. On hold (500 ms press), it launches a 5-second countdown with cancel. After countdown, it fires the full alert sequence.

2. **Live GPS tracking** — on SOS activation, use the browser Geolocation API (`watchPosition`) to get the user's live coordinates. Construct a shareable Google Maps tracking link: `https://maps.google.com/?q={lat},{lng}`. Update the coordinates every 30 seconds for as long as the SOS session is active (up to 30 minutes).

3. **Automatic SMS to emergency contacts** — on activation, open `sms:` URIs for each stored emergency contact with a pre-filled message containing the user's name, a distress message, and the live location link. Because the Web API cannot auto-send SMS without a backend, open these as `sms:` deep links sequentially. If a backend is later added, the pattern is ready.

4. **WhatsApp alert integration** — generate a WhatsApp `wa.me` deep link with a pre-composed message containing the user's name, alert message, live coordinates, and the Google Maps link. Open this in a new tab. The message must be encoded via `encodeURIComponent`.

5. **Emergency services dial** — a prominent "Call 112" button (India's unified emergency number) that triggers `tel:112`. Label it: **Emergency Services (112)**. This is always the first CTA shown, above contacts.

6. **SOS session management** — while an SOS is active, show a persistent "SOS Active" banner at the top of all screens. The banner shows elapsed time and a "Cancel SOS" button. Cancelling clears state, stops location polling, and shows a confirmation toast.

7. **Emergency contacts management** — in the Settings screen, add a new section: **Emergency Contacts**. Users can add up to 5 contacts (name + phone number). Stored in `AppContext` state. These contacts are used for the SMS and WhatsApp alerts.

---

## Architecture

### State changes — `src/context/AppContext.jsx`

Add to `initialState`:
```js
sos: {
  contacts: [],          // [{ id, name, phone }]
  activeSession: null,   // null | { startedAt, coords: { lat, lng } }
}
```

Add reducers:
- `SET_SOS_CONTACTS` — replace the contacts array
- `SOS_ACTIVATE` — set `activeSession` with timestamp and initial coords
- `SOS_UPDATE_COORDS` — update coords on the active session
- `SOS_CANCEL` — set `activeSession` to null

### New files to create

```
src/screens/SOSCenter.jsx         ← main SOS screen (pre-activation hub)
src/components/SOSButton.jsx      ← persistent floating hold-to-activate button
src/components/SOSBanner.jsx      ← top banner shown while SOS session is active
src/lib/sos.js                    ← utility: build SMS body, WA link, Maps link, geo helpers
```

### Routing — `src/App.jsx`

Add inside the protected `<AppShell>` route group:
```jsx
<Route path="/sos" element={<SOSCenter />} />
```

### Bottom nav — `src/components/AppShell.jsx`

Add an SOS tab to the nav array:
```js
{ path: '/sos', label: 'SOS', icon: SOSIcon }
```

The SOS icon should be a distinct shield-with-pulse or alert-bell SVG. It does **not** use the brand red (`--clr-brand`) — use a dedicated emergency red token (see Design section below).

### Settings — `src/screens/Settings.jsx`

Add an **Emergency Contacts** section below the existing settings rows. Each contact shows name + phone. An "Add contact" row opens a BottomSheet with two inputs (name, phone) and a save button. Max 5 contacts enforced with a toast on overflow.

---

## `src/lib/sos.js`

```js
// Build the Google Maps link for given coords
export function mapsLink({ lat, lng }) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

// Build SMS body
export function smsBod(userName, link) {
  return `URGENT: ${userName || 'Someone'} needs help. Live location: ${link}. Please call or reach them immediately.`;
}

// Build WhatsApp deep link
export function waLink(userName, link) {
  const msg = smsBod(userName, link);
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

// Open SMS for each contact
export function fireSmsBurst(contacts, body) {
  contacts.forEach(({ phone }) => {
    const a = document.createElement('a');
    a.href = `sms:${phone}?body=${encodeURIComponent(body)}`;
    a.click();
  });
}
```

---

## `src/screens/SOSCenter.jsx`

This is the screen at `/sos`. It is the **pre-activation hub**, not the live session view (that's the banner + button overlay).

Layout (stagger fadeUp, matching Home.jsx pattern):

1. **Header** — "SOS Center" title + subtitle: "In an emergency, one tap alerts your contacts and emergency services."

2. **Call 112 card** — full-width prominent card, dark background (`--clr-dark`), with a phone icon, "Emergency Services" label, and a large "Call 112" button. This fires `tel:112`. Always topmost. Text in `--clr-ink-on-dark`.

3. **How it works** — 3-step explainer (icon + label): "Hold SOS → Sends location → Alerts contacts". Subtle card, light surface.

4. **Emergency contacts preview** — shows the stored contacts list (name + phone). If empty, shows an empty state: "No emergency contacts added yet." with a "Add contacts →" button that navigates to `/settings`.

5. **Activate SOS** button (secondary, full-width) — triggers the same hold logic as the floating button but as a fallback tap action. Opens the countdown modal.

---

## `src/components/SOSButton.jsx`

A floating action button rendered inside `AppShell`, above the bottom nav, pinned bottom-right (`position: fixed`, `bottom: calc(var(--nav-height) + var(--sp-4))`, `right: var(--sp-5)`).

- Normal state: circular button, 56×56px, emergency red background, white "SOS" text, subtle pulse ring animation (keyframe `@keyframes sos-pulse`).
- Press behavior: `onPointerDown` starts a 500 ms timer. If released before 500 ms, no action (prevents accidental taps). If held 500 ms, trigger countdown.
- Countdown: a centered modal overlay (not a BottomSheet) counting down 5 → 1 with a large number, "Sending alert in Xs" label, and a "Cancel" button. Uses `framer-motion` `AnimatePresence` for the digit change.
- On countdown completion: call `activateSOS()` from a custom hook `useSOSActivation`.
- While SOS is active (`state.sos.activeSession !== null`): show "SOS Active" label instead of "SOS", button color stays emergency red, no pulse ring.

---

## `src/components/SOSBanner.jsx`

Rendered at the top of `AppShell` content area while `state.sos.activeSession !== null`.

- Full-width bar, emergency red background, white text.
- Shows: "🚨 SOS Active · {elapsed}" — elapsed ticks up every second via `setInterval`.
- Right side: "Cancel" button (white, ghost style).
- On cancel: dispatch `SOS_CANCEL`, stop geolocation watch, show toast "SOS cancelled".
- Animate in/out with `framer-motion` `AnimatePresence` (slide down from top).

---

## Design — Strict Token Rules

### New tokens to add to `src/index.css` (`:root` block)

```css
/* SOS / Emergency */
--clr-emergency: oklch(0.52 0.22 25);          /* vivid alert red, distinct from brand */
--clr-emergency-hover: oklch(0.44 0.22 25);
--clr-emergency-soft: oklch(0.94 0.06 25);
--clr-emergency-on: oklch(0.99 0 0);            /* white on emergency red */

/* SOS pulse ring keyframe */
@keyframes sos-pulse {
  0%   { box-shadow: 0 0 0 0 oklch(0.52 0.22 25 / 0.5); }
  70%  { box-shadow: 0 0 0 14px oklch(0.52 0.22 25 / 0); }
  100% { box-shadow: 0 0 0 0 oklch(0.52 0.22 25 / 0); }
}
```

**Do not use `--clr-brand` (the pink-red) for SOS.** Emergency red must be perceptually distinct — more orange-red, higher chroma.

### Screen design

- `SOSCenter` follows the same `screen screen--light` shell and `motion.div` stagger pattern as every other screen.
- Spacing, typography, radius, shadow — use existing tokens only. No new spacing or radius variables.
- The "Call 112" card uses `--clr-dark` background (matching the health tip card on Home), with `--clr-emergency` used only on the button CTA inside it.
- Empty-state for contacts uses `--clr-surface-2` background, muted ink, same style as other empty states in the app.
- All tap targets minimum 48×48px (elderly-accessible per PRODUCT.md).

### Motion

- Countdown digit transition: `key={countdown}` on a `motion.div` with `initial={{ opacity: 0, scale: 0.8 }}` → `animate={{ opacity: 1, scale: 1 }}` → `exit={{ opacity: 0, scale: 1.1 }}`, `duration: 0.18`, ease `[0.16, 1, 0.3, 1]`.
- SOSBanner slide: `initial={{ y: -48, opacity: 0 }}` → `animate={{ y: 0, opacity: 1 }}`.
- SOSButton pulse: CSS keyframe only (no JS animation). Respects `@media (prefers-reduced-motion: reduce)` — pulse animation removed under reduced motion.
- FloatingButton press scale: `whileTap={{ scale: 0.93 }}` (framer-motion).

---

## Geolocation hook — `src/lib/sos.js` (add)

```js
// Start watching position and return a cleanup fn
export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) { onError('Geolocation not supported'); return () => {}; }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onError(err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}
```

Call `watchLocation` inside `useSOSActivation` hook on activation. Store the cleanup in a `ref` and call it on cancel.

---

## `useSOSActivation` hook — `src/lib/sos.js` (add)

```js
// Returns { activateSOS, cancelSOS }
// activateSOS():
//   1. navigator.geolocation.getCurrentPosition → dispatch SOS_ACTIVATE with coords
//   2. Start watchLocation → on each update, dispatch SOS_UPDATE_COORDS
//   3. fireSmsBurst(contacts, smsBod(userName, mapsLink(coords)))
//   4. window.open(waLink(userName, mapsLink(coords)), '_blank')
//   5. haptic([0, 30, 60, 30])  ← use existing warn() from haptics.js
//
// cancelSOS():
//   1. stopLocationWatch()
//   2. dispatch SOS_CANCEL
//   3. toast('SOS cancelled', { icon: '✓' })
```

---

## Haptics

Use the existing `warn()` from `src/lib/haptics.js` (`haptic([0, 30, 60, 30])`) on SOS activation.  
Use `confirm()` on successful contact save in Settings.  
Use `tap()` on the "Call 112" button press.

---

## Impeccable Usage

After implementing the above, run impeccable polish on the new files:

```
npx impeccable polish src/screens/SOSCenter.jsx
npx impeccable polish src/components/SOSButton.jsx
npx impeccable polish src/components/SOSBanner.jsx
```

Impeccable must verify:
- Emergency red contrast ≥ 4.5:1 against white text
- Tap targets all ≥ 48×48px
- Pulse animation has `prefers-reduced-motion` guard
- No hardcoded hex/rgb colors — all values use CSS custom properties

---

## Checklist before commit

- [ ] New branch `feature/sos-center` created
- [ ] `AppContext` has `sos` slice with all 4 action types
- [ ] `src/lib/sos.js` exports: `mapsLink`, `smsBod`, `waLink`, `fireSmsBurst`, `watchLocation`, `useSOSActivation`
- [ ] `SOSCenter.jsx` renders: 112 card, how-it-works, contacts preview, fallback activate button
- [ ] `SOSButton.jsx` is rendered in `AppShell`, hold-to-activate 500 ms, 5-second countdown modal, active state
- [ ] `SOSBanner.jsx` shown when `state.sos.activeSession !== null`, elapsed timer, cancel button
- [ ] `/sos` route registered in `App.jsx`
- [ ] SOS tab added to `AppShell` bottom nav
- [ ] Emergency contacts section in `Settings.jsx` with BottomSheet add form, 5-contact max
- [ ] New CSS tokens (`--clr-emergency`, `--clr-emergency-hover`, `--clr-emergency-soft`, `--clr-emergency-on`, `sos-pulse` keyframe) in `index.css`
- [ ] `@media (prefers-reduced-motion)` guard on pulse animation
- [ ] All new strings in natural, non-alarmist language consistent with Amruni brand voice
- [ ] `git add -A && git commit -m "feat: SOS Center — emergency alerts, GPS tracking, 112 dial, WhatsApp integration"`

---

## Brand voice reminders (from PRODUCT.md)

The SOS screen copy must match Amruni's voice: **dignified, calm, expert** — not panicked or alarmist. Examples:

- ✅ "In an emergency, SOS alerts your contacts instantly."  
- ❌ "DANGER! PRESS SOS NOW!"  
- ✅ "Your location will be shared with your emergency contacts."  
- ❌ "We're watching your every move for your safety!"  

The 5-second countdown message: **"Sending alert in {n}s — tap Cancel to stop."** (calm, informative, not dramatic).

---

*Stack: React 19 · React Router 7 · Framer Motion 12 · Vite 8 · CSS custom properties (OKLCH) · DM Sans + Playfair Display · No external UI libraries*
