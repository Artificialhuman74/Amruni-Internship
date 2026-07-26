# Pregnancy mode — real feature plan (not a gimmick)

Handoff doc for implementation. Written after a planning session — nothing in
this doc has been built yet except what's explicitly marked "already exists."
Codebase is `amruni-app/` (React 19 + Vite, patient/doctor/admin multi-target
build) and `server/` (FastAPI + SQLite).

## The core problem

`state.pregnancy.weeksPregnant` defaults to `16` and **nothing in the UI ever
sets it**. Every user who turns on pregnancy mode is frozen at "Week 16"
forever. This is the blocking fix — everything else in this doc is built on
top of a real date, not a hardcoded default.

## 1. Due date input — research-backed design

Researched ACOG Committee Opinion No. 700 ("Methods for Estimating the Due
Date") before designing this, because the ordering of input methods actually
matters medically, not just as UX preference:

- Only ~50% of women accurately recall their LMP (last menstrual period).
- **First-trimester ultrasound is the most accurate dating method.** ACOG's
  own override rule: if ultrasound dating differs from LMP-calculated dating
  by more than **7 days (1st trimester)**, **14 days (2nd trimester, up to
  27w6d)**, or **21 days (3rd trimester)**, the ultrasound/doctor date wins and
  becomes the official EDD.
- Practical implication: **if a woman has already seen a doctor and been given
  a due date, that number is usually more accurate than anything the app could
  calculate from LMP.** Don't treat it as just an alternate input — prefer it.

### Setup card — order of options (first one is default/primary)

1. **"My doctor already gave me a due date"** — a single date picker. Copy:
   *"If you've had a dating scan, use that — it's usually the most accurate."*
   Store as the source of truth (`dueDateOverride`); don't let a later LMP
   entry silently recompute over it.
2. **"First day of my last period"** — fallback for someone very early on who
   hasn't had a scan yet. Standard Naegele's rule: `dueDate = LMP + 280 days`.
   Same anchor concept the cycle tracker already uses (`lastPeriodStart`).
3. *(Explicitly out of scope for v1 — note only)* Conception date / IVF
   transfer date. More precise but a smaller slice of users; don't build this
   round.

### Must stay editable after onboarding

Dating gets revised — e.g. she enters LMP at week 6, gets a scan at week 10
that shifts the date by 9+ days. **"Edit due date" needs to live somewhere
reachable after setup** (Settings, or a tap target on the Track screen itself),
not just a one-time onboarding field, or she loses the ability to correct it
without losing her logged history.

Sources: [ACOG Committee Opinion No. 700](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date), [When LMP and Ultrasound Dates Don't Match](https://www.obgproject.com/2023/01/02/accurate-ultrasound-pregnancy-dating/)

## 2. Screen layout — Track tab in pregnancy mode

Current file: `amruni-app/src/screens/Pregnancy.jsx` (already exists, shown
below what to keep vs. change). Routed in via
`amruni-app/src/apps/PatientApp.jsx`: `TrackScreen = pregnancyMode ? Pregnancy
: CycleTracker`.

**First visit, due date unknown:** show the setup card (section 1) in place of
everything else. Nothing below it renders until answered — no fake "Week 16."

**Once known, top to bottom:**

1. **Header** — due date front and center: *"Due 15 Jan 2027 · 174 days to
   go"*, trimester underneath. Replaces the current buried, frozen label.
2. **Week ring** — already exists (`Pregnancy.jsx` lines ~92-127), keep the
   visual as-is, just drive it from a real computed week instead of the static
   default.
3. **Today's check-in — summary + symptom chips.** SUPERSEDED by section 3a
   below: the mood entry itself now happens as an Apple-style card on the
   **Home** screen, not here. This slot on Track just shows a summary of
   today's already-logged mood (*"Today: Peaceful 🧡 · tap to edit"*) plus a
   **physical symptom chip picker** (nausea, swelling, back pain, etc.) —
   Apple's mood feature doesn't cover physical symptoms, so that half stays
   Amruni-specific and lives here, not on Home. Same `loggedDays` storage
   pattern as the cycle tracker (`cycle.loggedDays` in `AppContext.jsx`), just
   the `pregnancy` equivalent.
4. **Kick counter** — NEW. Only render once `weeks >= 28`; showing it earlier
   is just noise. Simple tap-to-count, one count per day.
5. **Weight tracker** — NEW, replaces a dead "coming soon" placeholder
   elsewhere in the app. See section 3 for the full design (researched against
   Flo + HealthifyMe).
6. **Next milestone card** — already exists (`MILESTONES` array, lines ~10-17,
   ~130-144). UPGRADE: when the milestone is a real medical checkpoint (week
   12, 20, 28, 36), make it a **"Book your [scan name]"** action wired into the
   existing appointment-booking flow (`BookAppointment.jsx`,
   `appointmentApi.getDoctors()`), pre-filtered to the "Pregnancy" specialty —
   not a second, separate doctor list. (`Home.jsx` already filters recommended
   doctors to "Pregnancy" specialty when `pregnancyMode` is on — reuse that
   specialty-matching logic rather than inventing new matching.)
7. **Share with a loved one** — already exists (lines ~147-160, ~212-231) but
   the "Generate share link" button is currently fake (just closes the sheet).
   **Not in this build batch** — leave as-is, flagged for later.
8. **Trusted contacts / emergency** — already exists (lines ~162-208,
   ~233-248). **Not in this build batch.** Two things worth knowing for
   whoever picks this up later:
   - This list duplicates the Emergency Contacts list in `Settings.jsx`
     (backed by `lib/sosService.js`, persisted via API). Pregnancy's version is
     local-only inside `pregnancy.trustedContacts`. Worth unifying eventually.
   - The panic button on this screen is separate from the global `SOSButton`
     component. Not clear if that's intentional (pregnancy-specific trigger)
     or accidental duplication — decide before touching it.

## 3a. Home screen — Apple-style daily mood check-in card

Researched Apple Health's "State of Mind" feature (iOS 17+) specifically
before designing this, since the ask was to match its interaction pattern
closely, not just build "a mood picker."

### The actual Apple mechanic (confirmed via research, not assumed)
1. A **drag slider**, not taps — spans Very Unpleasant → Unpleasant →
   Slightly Unpleasant → Neutral → Slightly Pleasant → Pleasant → Very
   Pleasant. Purple at the unpleasant end, blue at neutral, orange/yellow at
   pleasant — the background color and a soft blob shape shift live as you
   drag, not just on release.
2. After release, a **word-grid picker** scoped to whichever valence band was
   landed on (e.g. "Very Pleasant" → *Amazed, Peaceful, Joyful, Calm*; "Very
   Unpleasant" → *Angry, Sad, Drained, Stressed*).

That two-step shape — drag-to-valence, then pick-a-word — is what makes it
recognizably "Apple," more than the specific colors or blob asset.

### How it maps onto Amruni
- **Card location: Home screen**, not the Track tab. Appears once per day
  when `pregnancyMode` is on and today has no entry yet in
  `pregnancy.loggedDays[today]`.
- **Step 1 — slider.** Drag interaction, position mapped live to a color
  gradient via Framer Motion (`useMotionValue` + `useTransform` — no new
  dependency needed, already in the stack). 7-point valence scale, same as
  Apple's.
- **Step 2 — word grid.** Pregnancy-flavored adjective sets per valence band
  (can reuse Apple's categories as a starting vocabulary, adjusted for
  pregnancy context — e.g. add "Nauseous," "Exhausted," "Glowing," "Anxious
  about baby" alongside the general emotional words).
- **Design judgment call, not a technical constraint:** don't clone Apple's
  exact morphing blob shape/asset. The app already has its own organic-shape
  language from the Bloom animation (`PregnancyBloom.tsx`'s camellia/petal
  motif) — reuse that visual identity for the color-shifting shape instead of
  Apple's blob, so it reads as Amruni's own take on the interaction, not a
  reskinned iOS screen. The *slider mechanic and two-step flow* should match
  Apple closely; the *visual asset* should not.
- **Ephemeral card behavior:** once submitted, the card animates out
  immediately (same `AnimatePresence` pattern already used for the Bloom in
  `Settings.jsx`) and does not reappear until the next calendar day. This is
  the "comes and goes once it's done" behavior that was asked for.
- **Feeds into:** `dispatch({ type: 'LOG_PREGNANCY_DAY', date: today, data: {
  mood: <word>, valence: <-3..+3>, symptoms: [] } })` — same reducer action
  described in section 4, just written from Home instead of Track. The Track
  screen's summary card (section 2, item 3) reads back from the same
  `loggedDays` entry and adds the physical symptom chips on top.

Sources: [Log your state of mind in Health on iPhone – Apple Support](https://support.apple.com/guide/iphone/log-your-state-of-mind-iph6a6decb13/ios), [iOS 17: How to Track Your Mood With Apple Health – MacRumors](https://www.macrumors.com/how-to/track-mood-with-apple-health/), [The Science Behind Apple's 'State Of Mind' Feature – Forbes](https://www.forbes.com/sites/traversmark/2023/09/18/the-science-behind-apples-state-of-mind-feature-explained-by-a-psychologist/)

## 3. Weight tracker — design researched against Flo + HealthifyMe

**Take from Flo** (pregnancy-specific weight tracking):
- One-time pre-pregnancy weight + height input → BMI-derived **personalized
  healthy gain corridor** for the rest of the pregnancy, not a flat number for
  everyone.
- Graph = **shaded target band + actual weight line**, plotted against
  week/trimester — not a bare weight-over-time chart.
- **Weekly cadence**, tied into the same weekly milestone content that already
  exists — don't invent a new habit loop, reuse the one that's already there.
- **No diet-culture framing.** No calorie targets, no "goal weight," no
  streaks/scoring. Gaining weight is the healthy outcome here.

**Take from HealthifyMe** (general fitness weight tracking):
- **Trend-smoothing** — show a rolling average alongside raw entries so one
  heavy-meal day or water retention doesn't read as alarming.

**Explicitly do NOT copy from HealthifyMe:** calorie-target / weight-loss
coaching voice. Wrong medical framing for pregnancy — would be actively
harmful, not just a style mismatch.

**Reference data — IOM/ACOG total gestational weight gain by pre-pregnancy
BMI** (use to build the shaded band; distribute roughly across trimesters,
weighted more toward 2nd/3rd):
| Pre-pregnancy BMI category | BMI range | Total recommended gain |
|---|---|---|
| Underweight | < 18.5 | 12.5–18 kg |
| Normal weight | 18.5–24.9 | 11.5–16 kg |
| Overweight | 25–29.9 | 7–11.5 kg |
| Obese | ≥ 30 | 5–9 kg |

Sources: [Flo pregnancy app review](https://shunchild.com/article/is-flo-a-good-pregnancy-app), [HealthifyMe Smart Scale](https://store.healthifyme.com/en-us/products/smart-scale)

## 4. State model changes needed

### Frontend — `amruni-app/src/context/AppContext.jsx`

Current shape (line ~14):
```js
pregnancy: { weeksPregnant: 16, dueDate: null, trustedContacts: [] },
```

Change to (weeks/trimester become derived, not stored — a stored integer goes
stale the moment it's saved; storing the anchor date and computing from it is
correct, same pattern `cycle.lastPeriodStart` already uses):
```js
pregnancy: {
  lastPeriodStart: null,   // LMP anchor, same concept as cycle's field
  dueDateOverride: null,   // doctor-given due date; wins over LMP calc if set
  trustedContacts: [],
  loggedDays: {},          // { 'YYYY-MM-DD': { mood, valence, symptoms: [] } }
                           // mood = word from section 3a's picker (e.g. "Peaceful")
                           // valence = -3..+3 from the slider; symptoms = chip picker (section 2, item 3)
  weightLogs: [],          // [{ date, weightKg }]
  kickCounts: {},          // { 'YYYY-MM-DD': count }
},
```

New reducer case, mirrors existing `LOG_CYCLE_DAY` (around line 50):
```js
case 'LOG_PREGNANCY_DAY':
  return {
    ...state,
    pregnancy: {
      ...state.pregnancy,
      loggedDays: { ...state.pregnancy.loggedDays, [action.date]: action.data },
    },
  };
```

New derived-data hook, sibling to the existing `useCycleData(state)` (around
line 185):
```js
export function usePregnancyData(state) {
  const { lastPeriodStart, dueDateOverride } = state.pregnancy;
  if (!lastPeriodStart && !dueDateOverride) return { known: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lmp = lastPeriodStart
    ? new Date(lastPeriodStart)
    : new Date(new Date(dueDateOverride).getTime() - 280 * 86400000);
  const dueDate = dueDateOverride
    ? new Date(dueDateOverride)
    : new Date(lmp.getTime() + 280 * 86400000);
  const days = Math.floor((today - lmp) / 86400000);
  const weeks = Math.max(0, Math.floor(days / 7));
  const daysToGo = Math.max(0, Math.ceil((dueDate - today) / 86400000));
  const trimester = weeks <= 12 ? 1 : weeks <= 27 ? 2 : 3;
  return { known: true, weeks, dueDate, daysToGo, trimester };
}
```

**Migration note:** old `localStorage` state has a lingering `weeksPregnant`
field — harmless, it'll just sit unused (`AppProvider`'s init merge is
`{ ...init, ...parsed }`). No migration hack needed per this codebase's
conventions (no backwards-compat shims).

### Frontend — files that read the old `weeksPregnant` and need updating

- `amruni-app/src/screens/Home.jsx` — pregnancy banner currently destructures
  `const { weeksPregnant } = state.pregnancy;`. Switch to
  `usePregnancyData(state)`, and show a **"Set your due date"** CTA (→
  navigates to `/track`) when `!known`.
- `amruni-app/src/screens/Pregnancy.jsx` — currently `const weeks =
  state.pregnancy.weeksPregnant || 16;`. Switch to `usePregnancyData(state)`;
  when `!known`, render the setup card instead of the week ring.

### Backend — `server/app/db.py`

Current schema (confirmed by reading the file, lines 117-122):
```sql
CREATE TABLE IF NOT EXISTS pregnancy_state (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weeks_pregnant   INTEGER NOT NULL DEFAULT 16,
  due_date         TEXT,
  trusted_contacts TEXT NOT NULL DEFAULT '[]'
);
```
This has **no columns for mood/symptom logs, weight logs, or kick counts** —
they have nowhere to persist yet. Needs:
- `pregnancy_state`: replace `weeks_pregnant` with `last_period_start TEXT` and
  add `due_date_override TEXT` (keep `due_date` name or rename — pick one and
  update `routes_me.py` to match).
- New `pregnancy_logs` table, mirroring `cycle_logs` (lines 109-115):
  ```sql
  CREATE TABLE IF NOT EXISTS pregnancy_logs (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date     TEXT NOT NULL,
    mood     TEXT,             -- word picked in the section 3a Home card, e.g. "Peaceful"
    valence  INTEGER,           -- -3..+3 from the section 3a slider
    symptoms TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (user_id, date)
  );
  ```
- New table (or JSON column, consistent with how `trusted_contacts` is stored
  as a JSON TEXT blob today) for `weightLogs` — a list of `{date, weightKg}`.
  A real table is more consistent with `cycle_logs`' pattern if weight entries
  need per-date querying; a JSON blob column is simpler if not.
- Similarly for `kickCounts` — likely a JSON blob column
  (`{ 'YYYY-MM-DD': count }`) is sufficient; no need for a full table given the
  low cardinality (one row per day, one number).

### Backend — `server/app/routes_me.py`

- `me_payload()` (lines ~13-40): update the `pregnancy` dict to read the new
  columns/tables instead of `weeks_pregnant`.
- `PregnancySlice` Pydantic model (currently `weeksPregnant: int = 16`, `due
  Date: str | None`, `trustedContacts: list = []`): update fields to match the
  new shape (`lastPeriodStart`, `dueDateOverride`, `loggedDays: dict[str,
  dict] = {}`, `weightLogs: list = []`, `kickCounts: dict[str, int] = {}`).
- `put_state()` (the `/me/state` bulk sync route): update the `INSERT INTO
  pregnancy_state ...` statement for the new columns, and add a loop over
  `body.pregnancy.loggedDays` that upserts into `pregnancy_logs`, mirroring the
  existing loop over `body.cycle.loggedDays` → `cycle_logs` a few lines above
  it in the same function.

## 5. Build order (matches what was agreed in planning)

1. **P0 — due date/stage input.** Blocking; nothing else is trustworthy
   without it. Backend schema change + `usePregnancyData` hook +
   `Home.jsx`/`Pregnancy.jsx` migration all land together, since they're one
   coupled change.
2. Mood + symptom logging — two parts: the Apple-style slider + word-picker
   card on **Home** (section 3a), and the physical symptom chips + today's
   summary on **Track** (section 2, item 3). Both write to the same
   `pregnancy.loggedDays` entry; reuses the `cycle_logs` persistence pattern
   almost exactly.
3. Milestone-linked doctor visits (reuses existing booking flow + specialty
   filter already in `Home.jsx`).
4. Weight/vitals tracking (new — see section 3 for full design).
5. Kick counter (simplest of the four, self-contained).

Explicitly deferred, not in this batch: real share-link generation, unifying
pregnancy's trusted-contacts list with the SOS contacts list, deciding on the
duplicate panic button vs. global SOS button.
