import { moodApi } from '../services/moodApi';

/**
 * The words and the reasons.
 *
 * Two jobs. First, enough of both: six words per state was a shortlist, and a
 * woman who cannot find her feeling in it either picks the nearest wrong one —
 * which quietly corrupts every pattern the app later reports back to her — or
 * closes the sheet. Twelve per state, thirty-three reasons, and if none of them
 * fit she can write her own.
 *
 * Second, hers rise. The vocabulary anyone actually uses is a fraction of any
 * list, and it is a different fraction for every woman: one logs "In-laws" most
 * weeks and never "Studies", another the reverse. So the order is her own usage
 * first, the fixed list behind it. Nothing is hidden by this and nothing is
 * suggested she has not already chosen herself — no inference, no scoring, just
 * her own history handed back in the order she made it.
 *
 * The custom entries need no storage of their own. `word` and `factors` have
 * always been free text in the database, so a word she invents is simply a word
 * she has used, and it comes back the same way every other word she uses does.
 */

/** Twelve per state, running cool to warm alongside the bloom. */
export const WORDS = {
  '-3': ['Overwhelmed', 'Exhausted', 'Frightened', 'Alone', 'Hopeless', 'Panicked',
    'Numb', 'Desperate', 'Ashamed', 'Trapped', 'Grieving', 'Furious'],
  '-2': ['Drained', 'Irritable', 'Anxious', 'Achy', 'Worried', 'Restless',
    'Angry', 'Lonely', 'Discouraged', 'Guilty', 'Resentful', 'Stretched thin'],
  '-1': ['Tired', 'Uneasy', 'Sensitive', 'Low', 'Distracted', 'Impatient',
    'Flat', 'Unsettled', 'Self-conscious', 'Homesick', 'Bored', 'Wistful'],
  '0': ['Calm', 'Steady', 'Quiet', 'Reflective', 'Unsure', 'Waiting',
    'Even', 'Patient', 'Detached', 'Ordinary', 'Watchful', 'In between'],
  '1': ['Content', 'Hopeful', 'Relieved', 'Comfortable', 'Grateful', 'Rested',
    'Settled', 'Encouraged', 'Curious', 'Light', 'Cared for', 'Capable'],
  '2': ['Peaceful', 'Joyful', 'Connected', 'Energised', 'Warm', 'Confident',
    'Proud', 'Affectionate', 'Playful', 'Focused', 'Generous', 'Safe'],
  '3': ['Radiant', 'Elated', 'Amazed', 'Overjoyed', 'Powerful', 'Free',
    'Alive', 'Blessed', 'Fearless', 'In love', 'Unstoppable', 'Complete'],
};

// Pregnancy replaces a few words rather than the whole vocabulary — the fear
// has a specific object then, and naming it is most of the relief.
export const PREGNANCY_WORDS = {
  '-3': ['Frightened for the baby', 'Overwhelmed', 'Exhausted', 'Nauseous', 'Alone', 'Panicked',
    'Numb', 'Desperate', 'Ashamed', 'Trapped', 'Grieving', 'Furious'],
  '-2': ['Uncomfortable', 'Drained', 'Anxious', 'Achy', 'Worried', 'Restless',
    'Angry', 'Lonely', 'Discouraged', 'Guilty', 'Resentful', 'Stretched thin'],
  '2': ['Peaceful', 'Joyful', 'Connected', 'Energised', 'Glowing', 'Confident',
    'Proud', 'Affectionate', 'Playful', 'Focused', 'Generous', 'Safe'],
  '3': ['Radiant', 'Elated', 'Blessed', 'Amazed', 'Overjoyed', 'Powerful',
    'Alive', 'Free', 'Fearless', 'In love', 'Unstoppable', 'Complete'],
};

/**
 * Grouped, and labelled now that there are thirty-three of them.
 *
 * "In-laws", "Chores" and "Faith" are not padding. They are among the largest
 * standing forces on the mood of the women this is built for, and a factor list
 * that offers "Hobbies" but not the household she lives in is a list written
 * for somewhere else.
 */
export const FACTOR_GROUPS = [
  { label: 'Your body', items: ['Sleep', 'Energy', 'Pain', 'Health', 'Appetite', 'Hormones', 'Cycle', 'Exercise', 'Skin', 'Weight'] },
  { label: 'People', items: ['Partner', 'Family', 'In-laws', 'Children', 'Friends', 'Being alone', 'Community'] },
  { label: 'Daily life', items: ['Work', 'Studies', 'Money', 'Chores', 'Commute', 'Travel', 'Appointments', 'Weather', 'News'] },
  { label: 'You', items: ['Time for myself', 'Rest', 'Faith', 'How I look', 'An achievement', 'A decision', 'Plans ahead'] },
];

export const PREGNANCY_FACTOR_GROUPS = [
  { label: 'Your body', items: ['Sleep', 'Energy', 'Nausea', 'Pain', 'Body changes', 'Baby movement', 'Appetite', 'Heartburn', 'Breathlessness'] },
  { label: 'People', items: ['Baby', 'Partner', 'Family', 'In-laws', 'Children', 'Friends', 'Being alone'] },
  { label: 'Daily life', items: ['Work', 'Money', 'Chores', 'Commute', 'Travel', 'Appointments', 'Weather', 'News'] },
  { label: 'You', items: ['Time for myself', 'Rest', 'Faith', 'How I look', 'The birth', 'A decision', 'Plans ahead'] },
];

/**
 * Her usage, fetched once a session.
 *
 * A module-level promise rather than a hook: the sheet is opened from three
 * different screens and the answer is the same for all of them, so the second
 * and third openings should not pay for it again. A failure here is silent by
 * design — the full lists still render in their fixed order, which is exactly
 * what a first-time user sees anyway.
 */
let usagePromise = null;

export function loadUsage() {
  if (!usagePromise) {
    usagePromise = moodApi.vocabulary().catch(() => ({ words: {}, factors: {} }));
  }
  return usagePromise;
}

/** Call after a log is saved, so the next open reflects the word she just used. */
export function refreshMoodVocabulary() {
  usagePromise = null;
}

export const CUSTOM_MAX_LENGTH = 24;

/** Trimmed, length-capped, and never a duplicate of something already offered. */
export function cleanCustom(raw) {
  const value = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!value) return null;
  return value.slice(0, CUSTOM_MAX_LENGTH);
}

function byCountDesc(usage) {
  return (a, b) => (usage[b] || 0) - (usage[a] || 0);
}

/**
 * Her words for this state first, then the rest of the list in its fixed order.
 *
 * Only the handful she has actually used moves, and it moves to one predictable
 * place — the front. A list that re-sorted itself wholesale on every log would
 * personalise her out of ever learning where anything is.
 */
export function orderedWords(band, { pregnancyMode = false, usage = {} } = {}) {
  const key = String(band);
  const canonical = (pregnancyMode && PREGNANCY_WORDS[key]) || WORDS[key] || [];
  const counts = usage[key] || {};

  const used = Object.keys(counts).filter((w) => counts[w] > 0).sort(byCountDesc(counts));
  const seen = new Set(used);
  return [...used, ...canonical.filter((w) => !seen.has(w))];
}

/**
 * The same, per group — and anything she has written herself gathered into a
 * group of its own at the end, since a custom reason belongs to no list but hers.
 */
export function orderedFactorGroups({ pregnancyMode = false, usage = {}, extra = [] } = {}) {
  const groups = pregnancyMode ? PREGNANCY_FACTOR_GROUPS : FACTOR_GROUPS;
  const known = new Set(groups.flatMap((g) => g.items));

  const ordered = groups.map((g) => {
    const used = g.items.filter((f) => usage[f] > 0).sort(byCountDesc(usage));
    const seen = new Set(used);
    return { label: g.label, items: [...used, ...g.items.filter((f) => !seen.has(f))] };
  });

  const mine = [
    ...Object.keys(usage).filter((f) => !known.has(f) && usage[f] > 0).sort(byCountDesc(usage)),
    ...extra.filter((f) => !known.has(f) && !usage[f]),
  ];
  return mine.length ? [...ordered, { label: 'Yours', items: [...new Set(mine)] }] : ordered;
}
