# SOS Center — SAFE-DRIVE Integration Prompt
### For: `Amruni-Internship` repo · Branch: `feature/sos-center`
### Reference repo: `github.com/siddharthsharma99/SAFE-DRIVE` (already cloned at a path of your choice)

---

## What this task is

You are integrating the SOS Center feature into the Amruni women's health PWA by **extracting specific logic from the SAFE-DRIVE repo** and wiring it into Amruni's existing architecture. You are **not** porting SAFE-DRIVE's UI. SAFE-DRIVE's Tailwind/shadcn components are discarded entirely. Only its backend Twilio logic and Firestore service layer are being lifted.

Before touching any code:
1. Run `node .claude/skills/impeccable/scripts/context.mjs --target amruni-app` and read the output fully.
2. Read `amruni-app/.claude/skills/impeccable/reference/product.md`.
3. Read at least `amruni-app/src/index.css` (design tokens) and `amruni-app/src/screens/Settings.jsx` (pattern for new sections).

---

## Precise extraction map

### FROM `SAFE-DRIVE/server.ts` → TO `amruni-app/server.js` (new file)

**Take:**
- The lazy Twilio client initialisation (`getTwilio()` function) — lines 9–31
- The `/api/sos/alert` endpoint (you will create this, modelled on the existing `/api/accidents/detect` pattern)
- The `client.messages.create()` call (SMS)
- The `client.calls.create()` call with TwiML voice alert

**Adapt:**
- Strip TypeScript (`any`, type annotations, `as` casts). Amruni is plain JavaScript.
- Remove all accident detection logic (`predictBehavior`, `/api/accidents/detect`). Not relevant.
- Remove `/api/dashboard/stats` and `/api/config` stubs. Not relevant.
- The new endpoint you create is `POST /api/sos/alert` with body `{ contacts: [{name, phone}], userName, lat, lng }`.
- For each contact in the array, send one SMS and attempt one voice call.
- SMS body: `"🚨 URGENT: {userName} has sent an SOS alert. Live location: https://maps.google.com/?q={lat},{lng} — Please respond immediately."`
- TwiML voice: same message read aloud by `alice` in `en-IN`.
- Return `{ sent: number, failed: number, errors: [] }` — always 200, never throw at the route level.
- Integrate into Amruni's existing `vite.config.js` / entry server if one exists, or create `server.js` at root and add `"dev:full": "node server.js"` to `package.json` scripts.

**Do NOT take:**
- `createViteServer` middleware wiring (only if Amruni has no existing server; if it does, just add the new route to it)
- The `predictBehavior` heuristic
- Any TypeScript

---

### FROM `SAFE-DRIVE/src/services/api.ts` → TO `amruni-app/src/lib/sosService.js` (new file)

**Take and adapt (plain JS, no TypeScript):**
```js
// addContact(contact: { name, phone, relation }) — Firestore write
// getContacts() — Firestore read, userId-scoped
// saveAlert(alert: { message, sentTo[] }) — Firestore write
// getAlerts() — Firestore read, userId-scoped, newest first
```

**Adapt:**
- Strip TypeScript: remove all type imports, `Omit<>`, `as Promise<>`, enums, interfaces.
- Replace `import { db, auth } from '../lib/firebase'` with Amruni's actual Firebase init path. If Amruni has no Firebase yet, add it: `npm install firebase`, create `amruni-app/src/lib/firebase.js` initialising from `.env` vars `VITE_FIREBASE_*`.
- The `handleFirestoreError` utility: keep the logic, remove the TypeScript `unknown` type.
- No changes to Firestore collection names (`contacts`, `alerts`) — keep them.
- Contact schema: `{ name, phone, relation, userId, createdAt }` — same as SAFE-DRIVE.
- Alert schema: `{ message, sentTo[], userId, timestamp }` — drop `accidentId` (not applicable).

**Add one new function not in SAFE-DRIVE:**
```js
// deleteContact(contactId) — Firestore delete by doc id
export async function deleteContact(contactId) { ... }
```

---

### FROM `SAFE-DRIVE/src/types.ts` → inform `amruni-app/src/context/AppContext.jsx`

Use these shapes (as plain JS, no TypeScript) to define Amruni's `sos` state slice:

```js
// In AppContext initialState:
sos: {
  contacts: [],     // [{ id, name, phone, relation, userId, createdAt }]
  alerts: [],       // [{ id, message, sentTo[], userId, timestamp }]
  activeSession: null, // null | { startedAt: ISO string, coords: { lat, lng } }
}

// New action types:
// 'SET_SOS_CONTACTS'   — payload: contacts[]
// 'SET_SOS_ALERTS'     — payload: alerts[]
// 'SOS_ACTIVATE'       — payload: { startedAt, coords }
// 'SOS_UPDATE_COORDS'  — payload: { lat, lng }
// 'SOS_CANCEL'         — no payload
```

---

### FROM `SAFE-DRIVE/src/pages/ContactsPage.tsx` → inform `amruni-app/src/screens/Settings.jsx`

**Take the logic, not the JSX:**
- `loadContacts()` → `useEffect` fetch via `sosService.getContacts()`
- `handleAdd(e)` → calls `sosService.addContact({ name, phone, relation })`, refetches
- `handleDelete(id)` → calls `sosService.deleteContact(id)`, refetches
- 5-contact max guard: `if (contacts.length >= 5) { toast('Maximum 5 contacts'); return; }`
- Form state: `name`, `phone`, `relation` (three `useState`)

**Build the UI in Amruni's design system** (CSS custom props, not Tailwind):
- Add an **Emergency Contacts** section at the bottom of `Settings.jsx`, above the logout row
- Section title: same style as existing settings section headers
- Each contact: a row with name, phone, relation tag, and a delete icon button (right side)
- "Add contact" row: opens the existing `BottomSheet` component with the three-field form
- Save button: `btn btn--primary` class (existing Amruni button class)
- Empty state: muted text "No emergency contacts added. Add up to 5."

---

## New files to create in `amruni-app/src/`

### `src/screens/SOSCenter.jsx`

Follows the exact same structure as `Home.jsx`:
- `<div className="screen screen--light">`
- `<motion.div variants={stagger} initial="hidden" animate="show">` with `stagger` and `fadeUp` variants (copy from Home.jsx)
- `padding: 'var(--sp-6)'`, `paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-6))'`

**Sections (top to bottom):**

1. **Page header**
   ```jsx
   <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>Emergency</p>
   <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>SOS Center</h1>
   <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 4 }}>
     Hold the SOS button to alert your emergency contacts instantly.
   </p>
   ```

2. **Call 112 card** — uses `--clr-dark` background (same as "Today's insight" card on Home), with `--clr-emergency` only on the CTA button inside
   ```jsx
   <div style={{ background: 'var(--clr-dark)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-5)', ... }}>
     <p style={{ color: 'var(--clr-gold)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Emergency Services</p>
     <p style={{ color: 'var(--clr-ink-on-dark)', fontSize: 'var(--text-md)', fontWeight: 600, margin: 'var(--sp-2) 0 var(--sp-4)' }}>Call 112 — India's unified emergency number</p>
     <a href="tel:112" onClick={() => tap()} className="btn btn--emergency" style={{ display: 'inline-flex', ... }}>
       📞 Call 112 Now
     </a>
   </div>
   ```

3. **How it works** — three steps in a light surface card
   ```
   1. Hold SOS button for 0.5s
   2. 5-second countdown (cancel anytime)
   3. SMS + call sent to all contacts
   ```
   Use a horizontal flex row per step: number badge (`--clr-brand-soft` bg, `--clr-brand` text) + short label.

4. **Contacts preview** — reads `state.sos.contacts`
   - If empty: `--clr-surface-2` rounded card, muted text "No emergency contacts added yet.", link/button to `/settings`
   - If populated: list each contact's name + phone in a compact row with a shield icon

5. **Alert history** — reads `state.sos.alerts` (newest first, max 3 shown)
   - Section title "Recent alerts"
   - Each row: message snippet + timestamp (`toLocaleString()`)
   - Empty state: muted "No alerts sent yet."

6. Bottom padding `<div style={{ height: 'var(--sp-4)' }} />`

---

### `src/components/SOSButton.jsx`

Floating button, position fixed, above bottom nav:
```jsx
style={{
  position: 'fixed',
  bottom: 'calc(var(--nav-height, 72px) + var(--sp-4))',
  right: 'var(--sp-5)',
  zIndex: 'var(--z-modal)',
  width: 56, height: 56,
  borderRadius: 'var(--radius-full)',
  background: 'var(--clr-emergency)',
  color: 'var(--clr-emergency-on)',
  border: 'none',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.05em',
  animation: isActive ? 'none' : 'sos-pulse 2s ease-out infinite',
  boxShadow: 'var(--shadow-lg)',
}}
```

Hold-to-activate (port from `mahmud-r-farhan/Realtime-Location-Tracker` `sos.js` hold pattern):
```jsx
const holdTimer = useRef(null);

function onPointerDown() {
  holdTimer.current = setTimeout(() => startCountdown(), 500);
}
function onPointerUp() {
  clearTimeout(holdTimer.current);
}
```

Countdown modal (not a BottomSheet — a full overlay):
```jsx
// position fixed, inset 0, background oklch(0 0 0 / 0.7), z-index var(--z-modal)
// Centered: countdown digit (font-size var(--text-4xl), color var(--clr-emergency-on), font-weight 900)
// Label: "Sending alert in {n}s"
// Cancel button: ghost, white text
// Digit change animation: AnimatePresence + key={countdown}, initial/exit { opacity: 0, scale: 0.8 }
```

On countdown reaching 0: call `activateSOS()` (defined below).

While `state.sos.activeSession !== null`: label = "ACTIVE", no pulse, pressing opens a cancel confirmation.

---

### `src/components/SOSBanner.jsx`

Rendered at top of `AppShell` content when session is active:
```jsx
// Slide down: initial={{ y: -48, opacity: 0 }} → animate={{ y: 0, opacity: 1 }}
// background: var(--clr-emergency), color: var(--clr-emergency-on)
// Left: "🚨 SOS Active · {elapsed}" (elapsed via setInterval, formatted as mm:ss)
// Right: "Cancel" ghost button → calls cancelSOS()
```

---

### `src/lib/sos.js`

```js
export function mapsLink({ lat, lng }) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function smsBod(userName, link) {
  return `🚨 URGENT: ${userName || 'Someone you know'} has sent an SOS alert.\nLive location: ${link}\nPlease respond immediately.`;
}

export function waLink(userName, link) {
  return `https://wa.me/?text=${encodeURIComponent(smsBod(userName, link))}`;
}

// Deep-link SMS to each contact (browser-only fallback, no backend)
export function fireSmsBurst(contacts, body) {
  contacts.forEach(({ phone }) => {
    const a = document.createElement('a');
    a.href = `sms:${phone}?body=${encodeURIComponent(body)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

// Start GPS watch, return cleanup fn
export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) { onError('Geolocation not supported'); return () => {}; }
  const id = navigator.geolocation.watchPosition(
    pos => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    err => onError(err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}
```

---

### `src/lib/useSOSActivation.js` (hook)

```js
import { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { mapsLink, smsBod, waLink, fireSmsBurst, watchLocation } from './sos';
import { saveAlert } from './sosService';
import { warn } from './haptics';
import { useToast } from '../components/Toast';

export function useSOSActivation() {
  const { state, dispatch } = useApp();
  const stopWatch = useRef(null);
  const toast = useToast();

  async function activateSOS() {
    // 1. Get initial position
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const userName = state.user.name;
      const contacts = state.sos.contacts;

      // 2. Dispatch activate
      dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: new Date().toISOString(), coords } });

      // 3. Haptic
      warn();

      // 4. Start live watch — update coords every position change
      stopWatch.current = watchLocation(
        newCoords => dispatch({ type: 'SOS_UPDATE_COORDS', payload: newCoords }),
        err => console.warn('GPS watch error:', err)
      );

      // 5. Fire SMS burst (deep links)
      const link = mapsLink(coords);
      fireSmsBurst(contacts, smsBod(userName, link));

      // 6. WhatsApp alert (open in new tab, small delay to not block SMS)
      setTimeout(() => window.open(waLink(userName, link), '_blank'), 600);

      // 7. Backend Twilio call (if server.js is running)
      try {
        await fetch('/api/sos/alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts, userName, lat: coords.lat, lng: coords.lng }),
        });
      } catch {
        // Non-fatal: deep links already fired
      }

      // 8. Persist alert to Firestore
      try {
        await saveAlert({
          message: `SOS triggered by ${userName}. Location: ${link}`,
          sentTo: contacts.map(c => c.phone),
        });
      } catch {
        // Non-fatal
      }

      // 9. Auto-cancel after 30 minutes
      setTimeout(() => cancelSOS(), 30 * 60 * 1000);
    },
    () => {
      toast('Could not get your location. Please enable GPS.', { icon: '⚠️' });
    },
    { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function cancelSOS() {
    if (stopWatch.current) { stopWatch.current(); stopWatch.current = null; }
    dispatch({ type: 'SOS_CANCEL' });
    toast('SOS cancelled', { icon: '✓' });
  }

  return { activateSOS, cancelSOS };
}
```

---

## Routing and nav changes

### `src/App.jsx`
Add inside the protected `<AppShell>` route group:
```jsx
import SOSCenter from './screens/SOSCenter';
// ...
<Route path="/sos" element={<SOSCenter />} />
```

### `src/components/AppShell.jsx`
1. Add SOS tab to `tabs` array:
```js
{ path: '/sos', label: 'SOS', icon: SOSIcon }
```

2. Add `<SOSButton />` import and render it inside the `app-shell` div, after `<Outlet />` and before `<BottomNav />`:
```jsx
import SOSButton from './SOSButton';
import SOSBanner from './SOSBanner';
// ...
<div className="app-shell">
  <SOSBanner />          {/* only visible when session active */}
  <div className="app-shell__content">
    <Outlet />
  </div>
  <SOSButton />
  <BottomNav tabs={tabs} active={activeTab} onTab={navigate} lifeStage={lifeStage} />
</div>
```

3. `SOSIcon` SVG:
```jsx
function SOSIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill={active ? 'currentColor' : 'none'} fillOpacity={0.15} />
      <path d="M12 8v4M12 16h.01" stroke={active ? 'var(--clr-emergency)' : 'currentColor'} />
    </svg>
  );
}
```

---

## CSS additions to `src/index.css`

Add to `:root`:
```css
--clr-emergency:        oklch(0.52 0.22 25);
--clr-emergency-hover:  oklch(0.44 0.22 25);
--clr-emergency-soft:   oklch(0.94 0.06 25);
--clr-emergency-on:     oklch(0.99 0 0);
```

Add as a class:
```css
.btn--emergency {
  background: var(--clr-emergency);
  color: var(--clr-emergency-on);
  border-radius: var(--radius-full);
  padding: var(--sp-3) var(--sp-6);
  font-size: var(--text-sm);
  font-weight: 700;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background var(--dur-fast) var(--ease-out);
}
.btn--emergency:hover { background: var(--clr-emergency-hover); }
.btn--emergency:active { transform: scale(0.97); }
```

Add keyframe:
```css
@keyframes sos-pulse {
  0%   { box-shadow: 0 0 0 0 oklch(0.52 0.22 25 / 0.5); }
  70%  { box-shadow: 0 0 0 14px oklch(0.52 0.22 25 / 0); }
  100% { box-shadow: 0 0 0 0 oklch(0.52 0.22 25 / 0); }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes sos-pulse { 0%, 100% { box-shadow: none; } }
}
```

---

## Environment variables

Create or update `amruni-app/.env.local`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Create `amruni-app/.env.example` with the same keys but empty values. Commit only `.env.example`, never `.env.local`.

Update `amruni-app/.gitignore` (if not already present):
```
.env.local
.env
```

---

## Package changes

In `amruni-app/package.json`:
```bash
npm install firebase twilio express
npm install --save-dev tsx
```

Add scripts:
```json
"dev:server": "node --experimental-vm-modules server.js",
"dev:full": "concurrently \"npm run dev\" \"npm run dev:server\""
```

---

## Impeccable polish pass

After all components are built:
```
npx impeccable polish amruni-app/src/screens/SOSCenter.jsx
npx impeccable polish amruni-app/src/components/SOSButton.jsx
npx impeccable polish amruni-app/src/components/SOSBanner.jsx
```

Impeccable must check:
- Emergency red (`--clr-emergency`) contrast ≥ 4.5:1 against `--clr-emergency-on` (white)
- Pulse animation has `prefers-reduced-motion` guard ✓ (already in CSS above)
- All tap targets ≥ 48×48px
- No hardcoded hex or rgb anywhere — only CSS custom properties
- SOSBanner is visible and not clipped by `overflow: hidden` on any parent

---

## What NOT to do

- ❌ Do not copy any JSX from SAFE-DRIVE's pages — they use Tailwind classes that don't exist in Amruni
- ❌ Do not install `shadcn`, `tailwindcss`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tw-animate-css` — none of these are in Amruni
- ❌ Do not copy SAFE-DRIVE's `App.tsx`, `Layout.tsx`, `ThemeProvider.tsx`, `ThemeToggle.tsx`
- ❌ Do not copy the accident detection logic from `server.ts` (`predictBehavior`, `/api/accidents/detect`)
- ❌ Do not add Firebase Auth — Amruni uses its own phone-OTP auth stored in `AppContext`. Use `state.auth.phone` as the user identifier for Firestore documents (instead of `auth.currentUser.uid`)
- ❌ Do not use TypeScript — Amruni is plain JavaScript throughout
- ❌ Do not add `next-themes`, `@base-ui/react`, or any SAFE-DRIVE-specific dependencies

---

## Firestore adjustment (no Firebase Auth)

Since Amruni does not use Firebase Auth (it uses its own phone OTP flow in `AppContext`), replace all occurrences of `auth.currentUser.uid` in `sosService.js` with:

```js
import { useApp } from '../context/AppContext'; // only in components
// In sosService.js (not a hook), pass userId as a parameter:
export async function addContact(contact, userId) { ... }
export async function getContacts(userId) { ... }
export async function saveAlert(alert, userId) { ... }
export async function getAlerts(userId) { ... }
export async function deleteContact(contactId) { ... }
```

The `userId` passed in should be `state.auth.phone` from `AppContext` — it's unique per user and already persisted.

---

## Checklist before commit

- [ ] `feature/sos-center` branch created
- [ ] `server.js` at `amruni-app/` root with `POST /api/sos/alert` using SAFE-DRIVE's Twilio pattern
- [ ] `src/lib/firebase.js` initialised from `VITE_FIREBASE_*` env vars
- [ ] `src/lib/sosService.js` with `addContact`, `getContacts`, `saveAlert`, `getAlerts`, `deleteContact` — all plain JS, phone-based userId
- [ ] `AppContext` has `sos` slice with 5 action types
- [ ] `src/lib/sos.js` with `mapsLink`, `smsBod`, `waLink`, `fireSmsBurst`, `watchLocation`
- [ ] `src/lib/useSOSActivation.js` hook wiring all of the above
- [ ] `SOSCenter.jsx` — all 5 sections, matches Amruni screen pattern exactly
- [ ] `SOSButton.jsx` — floating, hold-to-activate, countdown modal, active state
- [ ] `SOSBanner.jsx` — slide-in, elapsed timer, cancel
- [ ] `/sos` route in `App.jsx`
- [ ] SOS tab + `SOSIcon` in `AppShell.jsx`
- [ ] `SOSButton` and `SOSBanner` rendered in `AppShell.jsx`
- [ ] Emergency contacts section in `Settings.jsx` (load, add, delete, 5-max guard)
- [ ] CSS tokens + `btn--emergency` + `sos-pulse` keyframe + `prefers-reduced-motion` guard in `index.css`
- [ ] `.env.example` committed, `.env.local` gitignored
- [ ] `firebase` + `twilio` + `express` in `package.json`
- [ ] No Tailwind, no shadcn, no lucide-react, no TypeScript introduced
- [ ] impeccable polish run on all 3 new components
- [ ] `git add -A && git commit -m "feat(sos): integrate SAFE-DRIVE Twilio + Firestore into SOS Center"`

---

## Reference files (read these before writing any code)

| File | Why |
|---|---|
| `amruni-app/src/index.css` | All design tokens — use nothing else for colors/spacing/radius |
| `amruni-app/src/screens/Home.jsx` | `stagger` + `fadeUp` variants, screen shell, card patterns |
| `amruni-app/src/screens/Settings.jsx` | How to add a new section, BottomSheet pattern, toast usage |
| `amruni-app/src/components/AppShell.jsx` | How tabs are declared, where to mount floating UI |
| `amruni-app/src/components/BottomSheet.jsx` | The sheet component API (`open`, `onClose`, `title`, `children`) |
| `amruni-app/src/lib/haptics.js` | `warn()`, `confirm()`, `tap()` — use these, don't define new ones |
| `amruni-app/src/context/AppContext.jsx` | Reducer pattern, `dispatch` calls, `useApp` hook |
| `SAFE-DRIVE/server.ts` | Twilio init + SMS + voice call — extract logic only |
| `SAFE-DRIVE/src/services/api.ts` | Firestore CRUD — extract logic only |

---

*Stack: React 19 · React Router 7 · Framer Motion 12 · Vite 8 · CSS custom properties (OKLCH) · DM Sans + Playfair Display · Firebase Firestore · Twilio (SMS + voice) · No Tailwind · No TypeScript · No shadcn*
