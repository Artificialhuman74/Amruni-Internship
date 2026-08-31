/**
 * Presentation mode.
 *
 * One switch. Flip PRESENTATION_MODE to false and every rename below reverts
 * in the same commit — nothing else in the app has to change, because this is
 * a naming layer and not a feature flag.
 *
 * What it renames, and why it is only a rename: the community's "Sex &
 * pleasure" space becomes "Hobbies". The tag *id* stays `sex-pleasure`
 * everywhere — in the database, on every post already written, in the rule
 * that keeps the space off adolescent accounts. Renaming the id would orphan
 * every post filed under it and quietly drop a safeguard, so nothing here
 * touches identity. Only the words on screen.
 *
 * The framing is the client's, and it is a real one rather than a euphemism:
 * a woman with something of her own to pursue is doing something for her
 * mental health, and the space is worth having under that name on its own
 * terms. It is written that way throughout, so nothing reads as a topic in
 * disguise.
 */

export const PRESENTATION_MODE = true;

/**
 * Display names only. Keyed by the id that stays constant underneath.
 */
const RENAMES = {
  'sex-pleasure': {
    label: 'Hobbies',
    short: 'Hobbies',
    blurb: 'What you make time for that is yours alone',
  },
};

/** The label to show for a tag, given whatever the server called it. */
export function tagLabel(id, fallback = '') {
  if (PRESENTATION_MODE && RENAMES[id]) return RENAMES[id].label;
  return fallback || id;
}

/** A one-line description, where a surface has room for one. */
export function tagBlurb(id, fallback = '') {
  if (PRESENTATION_MODE && RENAMES[id]) return RENAMES[id].blurb;
  return fallback;
}

/**
 * For prose that mentions the same subject outside a tag list — a life-stage
 * description, an onboarding line. Substitution is on whole words so it can
 * never chew through an unrelated one.
 */
const PHRASES = [
  [/\bsexual wellness\b/gi, 'hobbies and time for yourself'],
  [/\bsexual health\b/gi, 'hobbies and wellbeing'],
  [/\bSex & pleasure\b/g, 'Hobbies'],
];

export function present(text) {
  if (!PRESENTATION_MODE || !text) return text;
  return PHRASES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}
