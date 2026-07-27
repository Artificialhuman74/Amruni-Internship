/**
 * Validated mental-health screening instruments.
 *
 * These are not questionnaires we invented, and their wording is not ours to
 * improve — the scoring bands only mean anything if the items are asked as
 * published. Copy elsewhere in the app is warm; here it is verbatim.
 *
 * EPDS is the reason this file exists. Post-partum is one of the product's
 * named user groups, Home tells her PPD affects one mother in seven, and the
 * app was routing her to PHQ-9 — a general depression screen whose somatic
 * items (sleep, appetite, fatigue) are answered "yes" by almost every woman
 * with a newborn, which inflates her score for reasons that have nothing to do
 * with depression. EPDS was designed to avoid exactly that.
 */

// ── PHQ-9 · depression ─────────────────────────────────────────
export const PHQ9 = {
  id: 'phq9',
  label: 'Depression check',
  short: 'PHQ-9',
  intro: 'Over the last 2 weeks, how often have you been bothered by any of the following?',
  // The item asking about self-harm. Any non-zero answer is acted on
  // regardless of the total — see RISK_ITEM below.
  riskItem: 8,
  sharedOptions: [
    { label: 'Not at all', value: 0 },
    { label: 'Several days', value: 1 },
    { label: 'More than half the days', value: 2 },
    { label: 'Nearly every day', value: 3 },
  ],
  questions: [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead, or of hurting yourself in some way',
  ],
  bands: [
    { max: 4, level: 'Minimal', cls: 'minimal', msg: 'Your responses suggest minimal symptoms right now. Keep checking in with yourself.' },
    { max: 9, level: 'Mild', cls: 'mild', msg: 'Mild symptoms. Talking to someone you trust, or a counsellor, can help.' },
    { max: 14, level: 'Moderate', cls: 'moderate', msg: 'Moderate symptoms. This is worth talking through with a professional.' },
    { max: 19, level: 'Moderately severe', cls: 'severe', msg: 'Moderately severe symptoms. Please consider speaking to a doctor soon.' },
    { max: 27, level: 'Severe', cls: 'severe', msg: 'Severe symptoms. Please speak to a doctor — you deserve support with this.' },
  ],
};

// ── GAD-7 · anxiety ────────────────────────────────────────────
export const GAD7 = {
  id: 'gad7',
  label: 'Anxiety check',
  short: 'GAD-7',
  intro: 'Over the last 2 weeks, how often have you been bothered by the following?',
  riskItem: null,
  sharedOptions: PHQ9.sharedOptions,
  questions: [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    "Being so restless that it's hard to sit still",
    'Becoming easily annoyed or irritable',
    'Feeling afraid as if something awful might happen',
  ],
  bands: [
    { max: 4, level: 'Minimal', cls: 'minimal', msg: 'Minimal anxiety right now.' },
    { max: 9, level: 'Mild', cls: 'mild', msg: 'Mild anxiety. Breathing exercises and regular sleep make a real difference.' },
    { max: 14, level: 'Moderate', cls: 'moderate', msg: 'Moderate anxiety. Talking to a professional could really help.' },
    { max: 21, level: 'Severe', cls: 'severe', msg: 'Severe anxiety. Please consider speaking to a doctor.' },
  ],
};

// ── EPDS · post-natal depression ───────────────────────────────
// Ten items, each with its own wording, and half of them reverse-scored. The
// per-item options are the whole point of the instrument: it asks how she has
// felt *in the past seven days* in language that doesn't mistake new-baby
// exhaustion for depression.
export const EPDS = {
  id: 'epds',
  label: 'Post-natal check',
  short: 'EPDS',
  intro: 'In the past 7 days — not just today — please choose the answer that comes closest to how you have felt.',
  riskItem: 9,
  sharedOptions: null,
  questions: [
    'I have been able to laugh and see the funny side of things',
    'I have looked forward with enjoyment to things',
    'I have blamed myself unnecessarily when things went wrong',
    'I have been anxious or worried for no good reason',
    'I have felt scared or panicky for no very good reason',
    'Things have been getting on top of me',
    'I have been so unhappy that I have had difficulty sleeping',
    'I have felt sad or miserable',
    'I have been so unhappy that I have been crying',
    'The thought of harming myself has occurred to me',
  ],
  // Options in display order, each carrying its own score — several items run
  // 3→0 rather than 0→3, which is why this can't share one option list.
  options: [
    [['As much as I always could', 0], ['Not quite so much now', 1], ['Definitely not so much now', 2], ['Not at all', 3]],
    [['As much as I ever did', 0], ['Rather less than I used to', 1], ['Definitely less than I used to', 2], ['Hardly at all', 3]],
    [['Yes, most of the time', 3], ['Yes, some of the time', 2], ['Not very often', 1], ['No, never', 0]],
    [['No, not at all', 0], ['Hardly ever', 1], ['Yes, sometimes', 2], ['Yes, very often', 3]],
    [['Yes, quite a lot', 3], ['Yes, sometimes', 2], ['No, not much', 1], ['No, not at all', 0]],
    [["Yes, most of the time I haven't been able to cope at all", 3], ["Yes, sometimes I haven't been coping as well as usual", 2], ['No, most of the time I have coped quite well', 1], ['No, I have been coping as well as ever', 0]],
    [['Yes, most of the time', 3], ['Yes, sometimes', 2], ['Not very often', 1], ['No, not at all', 0]],
    [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Not very often', 1], ['No, not at all', 0]],
    [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Only occasionally', 1], ['No, never', 0]],
    [['Yes, quite often', 3], ['Sometimes', 2], ['Hardly ever', 1], ['Never', 0]],
  ],
  bands: [
    { max: 8, level: 'Low', cls: 'minimal', msg: 'Your answers suggest you are coping well at the moment. Check in again if that changes.' },
    { max: 12, level: 'Possible', cls: 'mild', msg: 'Your answers suggest you may be struggling more than you have said out loud. This is very common after birth, and it is treatable.' },
    { max: 30, level: 'Likely', cls: 'severe', msg: 'Your answers suggest post-natal depression is likely. This is an illness, not a failing, and it responds well to support. Please talk to a doctor.' },
  ],
};

export const TOOLS = { phq9: PHQ9, gad7: GAD7, epds: EPDS };

/** Options for a given question — shared scale, or the item's own. */
export function optionsFor(tool, index) {
  if (tool.sharedOptions) return tool.sharedOptions;
  return tool.options[index].map(([label, value]) => ({ label, value }));
}

export function bandFor(tool, score) {
  return tool.bands.find((b) => score <= b.max) ?? tool.bands[tool.bands.length - 1];
}

/**
 * Whether she answered anything other than "never" to the self-harm item.
 *
 * Handled separately from the score on purpose. Both PHQ-9 and EPDS can total
 * into a "mild" band while that one item is non-zero, and a screen that
 * responds to such an answer with "mild symptoms — try a walk" is worse than
 * not asking. Any non-zero answer surfaces help immediately, whatever the sum.
 */
export function hasRiskFlag(tool, answers) {
  if (tool.riskItem == null) return false;
  return (answers[tool.riskItem] ?? 0) > 0;
}
