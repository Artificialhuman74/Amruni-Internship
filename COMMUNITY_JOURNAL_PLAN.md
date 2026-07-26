# Private journal + community (Flo "Secret Chats" style) — plan

Handoff doc for implementation, not built yet. Researched Flo's actual
community feature before writing this (it's called **Secret Chats**, not a
generic "Flo chat") so the plan is grounded in what the real product does,
not a guess. This feature is **app-wide, not pregnancy-scoped** — tags like
"menstruation" and "sex and pleasure" apply across all life stages, so it
does not live inside pregnancy mode or the Track tab.

Checked the codebase first: no existing journal/community/thread/poll code
anywhere. `state.settings.anonymousMode` exists today but is scoped narrowly
to hiding identity from mental-health counsellors (`MentalHealth.jsx`) — a
related but distinct concept from community anonymity, described below.

## 1. What Flo actually does (researched, not assumed)

Flo's community is called **Secret Chats**:
- **Anonymous by design, not by toggle.** Every member posts under an
  app-generated avatar/handle, never their real name — this isn't an optional
  setting inside Secret Chats, it's the default identity model for the whole
  space. A separate, broader "Anonymous Mode" also exists at the app level
  (hides your name/email from Flo entirely) — that's a bigger, account-wide
  privacy switch, distinct from per-post anonymity.
- **Posts are organized into Categories.** The feed is personalized by which
  categories a member has liked/followed, what other members engaged with,
  and the member's **age and goal** — both of which Amruni already captures at
  onboarding (`lifeStage`, `goal` in `state.user`), so this personalization is
  reusable data, not new onboarding.
- **Confirmed: polls exist.** Flo's own materials describe "1,000+ threads,
  polls, and questions" inside Secret Chats — a post can be a poll, not just
  text.
- **Pre-moderation.** Flo pre-moderates topics and comments before they go
  live — this is treated as core to the feature, not an add-on, given the
  subject matter (sex, mental health, PMS, etc.).
- **Real topics covered**, per Flo's own materials: PMS, menstruation FAQs,
  sex, PCOS, pregnancy symptoms, perimenopause, parenting — doctors/experts
  also answer member questions in-thread.

**One honest correction to the original ask:** Flo does not have a distinct,
marketed "private journal" feature. Its closest equivalent is ordinary
symptom/mood logging inside the tracker (what pregnancy mode's `loggedDays`
already does). The private-journal-that-can-be-shared-as-a-community-post
idea is a genuinely new combination, not something to copy from Flo 1:1 — it's
a good idea on its own merits, just worth knowing it's not a "make it exactly
like Flo" ask for this specific part.

Sources: [Secret Chats – Flo](https://flo.health/product-tour/secret-chats), [What is Flo Secret Chats? – Flo Help](https://help.flo.health/hc/en-us/articles/360052675971-What-is-Flo-Secret-Chats), [Secret Chats Rules](https://flo.health/secret-chats-rules)

## 2. Private journal

- Personal, never public by default. Free-text entries, optionally tagged
  with the same tag taxonomy the community uses (section 4), so an entry is
  "share-ready" without re-tagging at share time.
- Available regardless of life stage or pregnancy mode — general reproductive
  + mental + personal health journal, not gated to Track.
- Each entry: date, text, tags, and a `sharedAsPostId` reference (null until
  shared). Sharing doesn't delete or fork the entry — it publishes a copy as a
  community post and links back, so editing the journal later doesn't silently
  rewrite something already public.
- **Share flow:** tapping "Share to community" on an entry opens a short
  confirmation step — same posting-identity choice as any new post (section
  3) — before anything goes public. Never auto-publish.

## 3. Community — layout and posting identity

**Threads, X-style**, per the ask: a root post, flat replies underneath
(reverse-chronological), reply/like counts, infinite-scroll feed. Recommend
**not** attempting Reddit-style deep visual nesting (reply-to-a-reply-to-a-
reply with indentation) for a first build — X's flatter model (replies attach
to the root, with a lightweight "replying to [handle]" reference for deeper
chains) is both closer to the literal ask and a meaningfully smaller UI/data
lift than true nested threading.

**Posting identity — a design call worth flagging, not deciding silently:**
Flo's real model is *always-anonymous* inside the community (a fixed
app-generated handle, not a per-post choice). The ask described "anonymous
mode" as a feature, which reads more like a **per-post toggle** — post as
yourself or anonymously, chosen each time. That's a reasonable middle ground
and more flexible than Flo's actual model, but it's a different identity
architecture (need a stable-but-anonymous handle per user for when they *do*
choose anonymous, so replies within a thread still read as coming from one
consistent person without revealing who). Recommend confirming which model
before backend work starts, since it changes the data shape:
- **Toggle model (recommended, matches the literal ask):** every post/reply
  carries `isAnonymous: bool`; when true, display the user's stable anon
  handle instead of their real name.
- **Flo's actual model:** community identity is always the anon handle,
  full stop — simpler, but removes the flexibility that was asked for.

**Identity-exposure warning, since the toggle model was chosen.** Whenever a
user flips anonymity **off** (they're about to post/reply as themselves
instead of their anon handle), show a popup warning them before it takes
effect — this is the moment someone could accidentally de-anonymize
themselves in a thread where they'd been posting anonymously.
- **Content:** a feature graphic showing the visual difference — recommend
  building this as a live before/after comparison of two small mock post
  cards (one with the anon handle/avatar, one with the user's real
  name/avatar) rather than a static illustration, so it reflects the actual
  user's real name rather than a generic stock graphic. Reuse the existing
  `BottomSheet` component (`amruni-app/src/components/BottomSheet.jsx`) for
  the popup shell, consistent with every other confirmation sheet in the app.
- **Frequency: exactly twice, ever, per user.** Needs a persisted counter —
  e.g. `settings.identityWarningSeen: number`, synced the same way every other
  settings field already is (`SET_SETTINGS` dispatch → `meApi.syncState`).
  Show the popup when `identityWarningSeen < 2`, increment on each showing,
  never show again once it hits 2.
- **Dev mode: show every time, uncapped**, for QA convenience while building
  and testing it. Frontend already has a live dev/prod check
  (`import.meta.env.DEV`, used today in `main.jsx`) — gate the "ignore the
  counter" behavior behind that, not a separate flag.
- **This dev override must be reverted before production** — logged as the
  first entry in `PRODUCTION_CHECKLIST.md` (new file, see that doc) so it
  isn't forgotten the way a dev convenience easily can be.

**Poll post type:** a post can be `type: 'poll'` — question + 2-4 options,
single-select vote, live vote-count display — same shape as X's native poll
posts and confirmed to exist in Flo's Secret Chats too.

## 4. Tags — grounded in Flo's real categories + the Gen-Z framing asked for

Flo's confirmed real categories (from research): PMS, menstruation, sex,
PCOS, pregnancy, perimenopause, parenting, mental health. The ask specifically
wants Gen-Z-flavored tag names on top of the clinical ones — casual/relatable
phrasing tends to land better with that audience than purely clinical terms.
Shipped taxonomy (source of truth: `TAGS` in `server/app/routes_community.py`;
kept in sync with the label map in `amruni-app/src/components/CommunityPostCard.jsx`):

- **Menstruation** (keep clinical — searchable, not everything needs a
  rebrand)
- **Sex & pleasure** *(restricted: hidden from `adolescent` accounts, see §5)*
- **Taboo topics** *(restricted: hidden from `adolescent` accounts, see §5)* —
  a deliberate home for the stigmatised subjects women rarely get to discuss
  openly (abortion, sexual assault and consent, infertility stigma, virginity
  myths, LGBTQ+ experiences, and so on). The whole point is that these get
  aired without shame; gated to adults by default for the same age-safety
  reason "Sex & pleasure" is, not because the topics themselves are off-limits.
- **PCOS & hormones**
- **Mental health & feelings**
- **Relationships**
- **Pregnancy & postpartum**
- **Body image & self-care**
- **Random / off-topic** (every community needs an unstructured catch-all —
  Flo's own topic examples include plenty of casual, non-clinical chat)

Exact wording is a copy/brand decision, not an engineering one — refine freely.
The two `restricted` flags are the only load-bearing part (they drive the
age-gating in §5); the labels are cosmetic and safe to reword.

## 5. Content moderation & safety — must be planned for, not bolted on later

This is a community with anonymous posting about sex, mental health, and
sensitive topics, on an app that already has an **`adolescent`** life stage
captured at onboarding (`LIFE_STAGES` in `data/mock.js`, referenced in
`Home.jsx`'s `avatarFor`). That combination needs explicit handling before
launch, not after:
- **Pre-moderation or strong automated filtering** before posts go live —
  Flo treats this as core, not optional, given the subject matter.
- **Reporting + blocking** on every post/reply, minimum viable trust-and-
  safety tooling for anonymous UGC.
- **Age-appropriate content gating** — decide whether certain tags (e.g. "Sex
  & pleasure") are hidden or restricted for accounts with `lifeStage ===
  'adolescent'`, reusing data already captured at onboarding rather than
  asking again. This is a product/legal decision, not something to default
  silently — flagging it here so it's a deliberate choice.

## 6. Where this lives in the app

Checked `AppShell.jsx`: the bottom nav already has **6 tabs** (Home, Consult,
Track, Help, SOS, Profile) in a 430px mobile column — already dense. Adding a
7th persistent tab for Community is worth questioning rather than doing by
default (Flo's own nav dedicates a tab to Secret Chats, but Flo's tab set is
shorter — it doesn't carry Amruni's SOS/Consult tabs).

**Recommended for v1:** build Community as its own routed screen
(`/community`), surfaced via a prominent entry point on **Home** (a card,
similar to how "Recommended Doctors" or the pregnancy banner already work),
not a bottom-nav tab. If usage data later shows it's a primary destination,
promoting it to a nav tab is a small change at that point — starting there
avoids committing to permanent nav real estate before knowing if it's used
enough to justify it.

**Confirmed hard constraints — do not touch these while adding the entry
point:**
- **Home's profile button stays exactly as-is** — the avatar/icon button top
  right of Home (`Home.jsx` line ~99, `onClick={() => navigate('/settings')}`)
  keeps navigating straight to Settings. The Community card is a separate,
  new element on Home; it doesn't replace or repurpose this button.
- **The SOS tab's single-tap behavior stays exactly as-is** — the bottom-nav
  `/sos` tab (`AppShell.jsx`'s `tabs` array) is a normal single-tap navigation
  to `SOSCenter.jsx`, same as any other tab. This is distinct from the
  floating `SOSButton` component (`components/SOSButton.jsx`), which is a
  separate hold-to-activate emergency trigger with its own 500ms-hold + 5s
  countdown logic — neither behavior changes.
- **Everything else about the current nav/Home functionality is unaffected.**
  This section only adds a new card to Home and a new `/community` route;
  it's additive, not a redesign of existing screens.

## 7. Data model sketch (planning-level, not final schema)

```
journalEntries: [{
  id, date, text, tags: [], sharedAsPostId: null | postId
}]

communityPosts: [{
  id, authorId,            // real user id, server-side only — never sent to other clients
  anonHandle,              // stable per-user generated handle, e.g. "Violet192"
  isAnonymous: bool,        // per section 3's toggle model
  tags: [],
  type: 'text' | 'poll',
  text,                    // for text posts
  pollOptions: [{ label, votes }],  // for poll posts
  replyToId: null | postId, // null = root post
  likeCount, replyCount,
  createdAt,
  moderationStatus: 'pending' | 'approved' | 'rejected',  // section 5
}]
```

Whether `communityPosts` and `journalEntries` are separate tables/stores or
one table with a `visibility: 'private' | 'public'` flag is an implementation
call for whoever builds this — either works; the important constraint is that
`sharedAsPostId` links them without deleting or forking the private original.

## 8. Suggested build order

1. Private journal alone (entries, tags, no sharing yet) — smallest
   self-contained piece, no moderation/identity complexity yet.
2. Community feed + threads (text posts only, no polls yet) — resolve the
   anonymous-identity model (section 3) before this starts, since it's a
   foundational data-shape decision, not a cosmetic one.
3. Poll post type.
4. Journal → community share bridge.
5. Moderation/reporting tooling and age-gating (section 5) — should land
   alongside step 2, not after, given the sensitivity of the content; listed
   last here only because it's written last, not because it's lower priority.
