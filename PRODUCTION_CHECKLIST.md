# Production checklist — dev/demo shortcuts that must change before real launch

Running list. Anything built as a deliberate dev-only convenience gets logged
here the moment it's introduced, not discovered later. Newest-relevant-first
is not the ordering — entries are numbered in the order they were identified;
check them off as they're addressed.

## 1. Identity-exposure warning popup — dev override must be removed

**Where:** `amruni-app/src/lib/useIdentityWarning.js`. Built — see
`COMMUNITY_JOURNAL_PLAN.md` section 3.

**The dev shortcut:** the popup that warns a user before they turn off
anonymity is capped at showing **twice, ever, per user** in production
(tracked via `settings.identityWarningSeen`, `cap = 2`). In `useIdentityWarning.js`,
`cap` is `import.meta.env.DEV ? Infinity : 2` — development/QA sees it every
time, uncapped, so the flow can be tested repeatedly without exhausting the
real cap.

**What must happen before production:** confirm the `import.meta.env.DEV`
gate actually excludes production builds (Vite sets this correctly by
default, but verify post-build — same class of mistake as shipping a debug
flag that silently stayed on). Nothing to "turn off" manually since it's
environment-gated by build, not a variable someone has to remember to unset —
but verify it once, since this is exactly the kind of thing that's easy to
assume is fine and never actually check.

**Status:** built. Verify the `DEV` gate against an actual production build
(`npm run build:patient` + `npm run preview` or equivalent) before launch —
open the composer, toggle anonymity off, and confirm the warning caps at 2
occurrences rather than showing every time.

## 2. `EXPOSE_OTP` — backend returns the OTP code in production

**Where:** `server/app/auth.py` (`EXPOSE_OTP` flag), currently set to `true`
on the Railway `amruni-api` production service.

**Why it exists:** there's no SMS gateway wired up yet (`send_sms()` in
`auth.py` just logs to console), so without this flag nobody could log into
the deployed app at all. It makes `request_otp` return `{"devCode": "123456"}`
in the API response so the frontend can show "Dev: use XXXXXX" and log in.

**What must happen before production:** wire up a real SMS gateway (MSG91,
Twilio, AWS SNS — the integration point is `send_sms()` in `auth.py`), then
**unset `EXPOSE_OTP` on Railway** (or set it to `false`). `TEST_OTP_NUMBERS`
can stay for internal QA logins after that, since it's scoped to specific
known numbers rather than exposing every user's code.

**Status:** live in production right now. Must be reverted before public
launch — currently anyone can request an OTP for any phone number and read it
back from the API response, which is fine for an internal/demo phase but not
for real users.

## 3. `ADMIN_PASSWORD=amruni` — weak, guessable admin password

**Where:** Railway `amruni-api` production service, `ADMIN_PASSWORD` env var.

**Why it exists:** quick unblock to get into the admin portal during
development; the code-level default (`server/app/auth.py`) only applies
outside production, so this was set explicitly as a real production value.

**What must happen before production:** replace with a strong, unique
password (or move to a proper admin-identity mechanism — `ADMIN_PHONES`-based
login already exists in `auth.py` as a stronger alternative to a shared
password) before real launch.

**Status:** live in production right now. Low urgency while the app has no
real users yet, but must not ship to a real launch as-is.

## 4. Community moderation — keyword blocklist stands in for real pre-moderation

**Where:** `server/app/routes_community.py`, `moderate_text()` and
`BLOCKED_TERMS`.

**Why it exists:** `COMMUNITY_JOURNAL_PLAN.md` section 5 requires
pre-moderation or strong automated filtering before posts go live, treated as
core given the subject matter (sex, mental health, PMS, anonymous UGC). There
is no moderation queue, human reviewer, or hosted content-safety API wired up
yet, so `moderate_text()` is a small, explicitly-labeled stand-in: a short
hardcoded phrase list catches only the most clearly disallowed content
(self-harm encouragement) and everything else auto-approves. `moderation_status`
(`pending | approved | rejected`) is real and already wired through the schema
and every read path, so swapping in a real moderation backend later is a
function-body change, not a data-model change. Reports also auto-hide a post
after 3 accumulate (`REPORT_AUTO_HIDE_THRESHOLD`), which is a real but blunt
safety net, not a substitute for review.

**What must happen before production:** replace `moderate_text()` with either
a real moderation queue (posts land as `pending` and a human/tool approves
before they're visible — right now everything not keyword-blocked auto-
approves instantly) or a hosted content-safety API call. Expand or replace the
`BLOCKED_TERMS` list with something a trust-and-safety review has actually
signed off on — the current list is illustrative, not a real policy. Revisit
`REPORT_AUTO_HIDE_THRESHOLD = 3`, which is an arbitrary starting number.

**Status:** live in the codebase now (community feature just built). Must not
ship to real users with anonymous UGC about sensitive topics moderated by a
five-phrase blocklist.

## 5. "Replay onboarding" dev shortcut in Settings

**Where:** `amruni-app/src/screens/Settings.jsx`, the "App" settings group.

**The dev shortcut:** a settings row labelled **Replay onboarding · DEV** that
navigates to `/onboarding/privacy`, letting anyone re-enter the first-run flow
(privacy → name → date of birth → goals) on demand. Added so the redesigned
onboarding can be re-tested without wiping the account or clearing storage.

**Why it's gated, not removed:** the whole row is wrapped in
`{import.meta.env.DEV && (…)}`. Vite replaces `import.meta.env.DEV` with the
literal `false` in every production build (`vite build`), so the block is
dead-code-eliminated and the row never renders for real users — the same
environment-gate pattern as item 1.

**What must happen before production:** nothing to unset manually, but **verify
the gate against an actual production build** (`npm run build:patient` +
`npm run preview`) — open Settings → App and confirm the "Replay onboarding"
row is absent. Same class of easy-to-assume-fine mistake as item 1; check it
once. If the gating pattern ever changes, delete the row outright instead.

**Status:** built, `DEV`-gated. Verify absent in a production build before launch.
