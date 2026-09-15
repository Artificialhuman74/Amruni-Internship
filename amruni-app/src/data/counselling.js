/**
 * Samadhana Center counselling intake — the paper case sheet, digitised.
 *
 * Two halves, exactly as the printed form has them.
 *
 * The first is a case record: what brings her, how it started, what is
 * pressing on her, her family, and whether she has sought help before. The
 * paper form also carries the counsellor's own boxes — file number, diagnosis,
 * medicine prescribed. Those are deliberately NOT here. They are the
 * practitioner's clinical record, they are written after the conversation
 * rather than before it, and this app already has a table for them
 * (`consultation_records`). Putting a "What is the problem/Diagnosis?" field
 * in front of the woman filling this in would be asking her to diagnose
 * herself, which is not what the box on the paper means.
 *
 * Likewise absent: name, age, sex, phone, address. She gave those at sign-up
 * and the chart already shows them to the counsellor. A form that asks a woman
 * her own name after she has logged in is a form that was transcribed rather
 * than designed.
 *
 * ── The second half is the SRQ-20, and it is a measuring instrument ──────
 *
 * The twenty yes/no questions are the WHO Self-Reporting Questionnaire, in the
 * Kannada adaptation this centre uses. That matters for three reasons:
 *
 *   · The wording is validated. It is not a list of symptoms someone wrote —
 *     it is a scale with published psychometric properties, and paraphrasing
 *     an item to sound friendlier silently invalidates the score it feeds.
 *     The English here is the printed form's own wording, corrected only for
 *     obvious typographical slips ("discomport", "Distrubed").
 *   · The order is fixed. Items are not reordered or personalised.
 *   · It screens; it does not diagnose. A score is a reason for a conversation
 *     with a counsellor, and every surface that shows one says so.
 *
 * ── Item 17 ──────────────────────────────────────────────────────────────
 *
 * Item 17 asks about suicidal thoughts. It is scored like the others, and it
 * is also treated as a standing flag entirely independent of the total: a
 * woman can answer "no" to nineteen questions and still be the most urgent
 * person to reach today. `srqResult().urgent` is true whenever item 17 is yes,
 * regardless of score, and the screen offers Tele-MANAS on the spot.
 *
 * ── On the Kannada ───────────────────────────────────────────────────────
 *
 * Transcribed from the centre's printed form so the questions read the way
 * the women answering them have already seen them. IT HAS NOT BEEN CHECKED BY
 * A NATIVE READER. Before this is put in front of real clients, someone at the
 * centre should read the twenty items back against the paper — a screening
 * instrument whose wording has drifted in translation measures something other
 * than what it claims to.
 */

/**
 * The twenty items, in the order the instrument fixes.
 *
 * `kn` is the Kannada as printed; `label` is the English as printed. Both are
 * shown, because the form is bilingual and the woman reading it may be
 * comfortable in either.
 */
export const SRQ20 = [
  { id: 'srq1', kn: 'ನಿಮಗೆ ಆಗಾಗ್ಗೆ ತಲೆನೋವು ಬರುತ್ತಾ?', label: 'Do you often have headaches?' },
  { id: 'srq2', kn: 'ಹಸಿವು ಕಡಿಮೆ ಆಗಿದೆಯೇ?', label: 'Is your appetite less?' },
  { id: 'srq3', kn: 'ನಿದ್ರೆ ತೊಂದರೆ (ನಿದ್ರೆ ಬರದಿರುವುದು, ಮಧ್ಯೆ ಮಧ್ಯೆ ಎಚ್ಚರವಾಗುವುದು) ಇದೆಯೇ?', label: 'Do you have trouble sleeping — not falling asleep, or waking through the night?' },
  { id: 'srq4', kn: 'ನೀವು ಸ್ವಲ್ಪಕ್ಕೇ ಹೆದರಿಕೊಳ್ಳುತ್ತೀರಾ?', label: 'Are you frightened by small things?' },
  { id: 'srq5', kn: 'ನಿಮ್ಮ ಕೈ–ಕಾಲುಗಳು ನಡುಗುತ್ತವೆಯೇ?', label: 'Do your hands and legs tremble?' },
  { id: 'srq6', kn: 'ನಿಮಗೆ ಗಾಬರಿ, ಏನಾಗುವುದೋ ಎಂಬ ಭಯ, ಚಿಂತೆ ಇದೆಯೇ?', label: 'Do you feel tense or anxious, or worry a great deal?' },
  { id: 'srq7', kn: 'ನಿಮ್ಮ ಜೀರ್ಣಶಕ್ತಿ ಕಡಿಮೆಯಾಗಿದೆಯೇ?', label: 'Is your digestion poor?' },
  { id: 'srq8', kn: 'ಸ್ಪಷ್ಟವಾಗಿ, ಸರಾಗವಾಗಿ ಯೋಚಿಸಲು ನಿಮಗೆ ಕಷ್ಟವಾಗುತ್ತದೆಯೇ?', label: 'Do you find it hard to think clearly and easily?' },
  { id: 'srq9', kn: 'ಮನಸ್ಸಿಗೆ ಬೇಸರ ದುಃಖವಾಗುತ್ತದೆಯೇ?', label: 'Do you feel low or unhappy?' },
  { id: 'srq10', kn: 'ಮಾಮೂಲಿಗಿಂತ ಹೆಚ್ಚಾಗಿ ಕೋಪ ಬರುತ್ತದೆಯೇ?', label: 'Do you get angry more than usual?' },
  { id: 'srq11', kn: 'ನಿತ್ಯದ ಕೆಲಸಗಳನ್ನು ಮಾಡಲು ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ?', label: 'Is your daily work suffering?' },
  { id: 'srq12', kn: 'ಯಾವುದೇ ನಿರ್ಧಾರವನ್ನು ಮಾಡಲು ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ?', label: 'Do you find it difficult to make decisions?' },
  { id: 'srq13', kn: 'ನಿಮ್ಮ ಮನೆಯವರು ನಿಮ್ಮನ್ನು ಸರಿಯಾಗಿ ನೋಡಿಕೊಳ್ಳುತ್ತಿಲ್ಲ ಎನಿಸುತ್ತಿದೆಯೇ?', label: 'Do you feel your family does not care for you properly?' },
  { id: 'srq14', kn: 'ಜೀವನದಲ್ಲಿ ಉಪಯುಕ್ತ ಪಾತ್ರ ವಹಿಸಲು ನಿಮಗೆ ಆಗುತ್ತಿಲ್ಲ ಎನಿಸುತ್ತಿದೆಯೇ?', label: 'Do you feel unable to play a useful part in life?' },
  { id: 'srq15', kn: 'ಎಲ್ಲಾ ವಿಚಾರಗಳಲ್ಲಿ ನೀವು ಆಸಕ್ತಿಯನ್ನು ಕಳೆದುಕೊಂಡಿದ್ದೀರಾ?', label: 'Have you lost interest in things?' },
  { id: 'srq16', kn: 'ನೀವು ಯಾವುದಕ್ಕೂ ಪ್ರಯೋಜನವಿಲ್ಲದವರು, ಬೆಲೆ ಇಲ್ಲದವರು ಎನಿಸುತ್ತಿದೆಯೇ?', label: 'Do you feel that you are useless or worthless?' },
  // Scored like the rest, and flagged on its own. See `srqResult`.
  { id: 'srq17', kn: 'ಆತ್ಮಹತ್ಯೆ ಆಲೋಚನೆ ನಿಮ್ಮ ಮನಸ್ಸಿನಲ್ಲಿದೆಯೇ?', label: 'Has the thought of ending your life been on your mind?', urgent: true },
  { id: 'srq18', kn: 'ಸದಾ ನಿಮಗೆ ಆಯಾಸ ಸುಸ್ತು ಆಗುತ್ತದೆಯೇ?', label: 'Do you feel tired all the time?' },
  { id: 'srq19', kn: 'ಹೊಟ್ಟೆಯಲ್ಲಿ ಏನೋ ಸಂಕಟವಾಗುತ್ತದೆಯೇ?', label: 'Do you have an uncomfortable feeling in your stomach?' },
  { id: 'srq20', kn: 'ನಿಮಗೆ ವಿಪರೀತ ನಿಶ್ಶಕ್ತಿ / ಮೈಕೈ ನೋವು ಇದೆಯೇ?', label: 'Do you have severe weakness, or pain in your limbs or body?' },
];

/** The item whose answer is acted on regardless of the total. */
export const URGENT_ITEM = SRQ20.find((i) => i.urgent).id;

/**
 * Where the instrument's own literature places the line.
 *
 * 7/8 is the threshold most widely used in Indian validation studies of the
 * SRQ-20, and it is a threshold, not a boundary in nature — it moves with the
 * population and the purpose. It is named here as a constant precisely so that
 * the centre can change it in one place if their own practice differs, rather
 * than finding it hard-coded inside three different screens.
 */
export const SRQ_CUTOFF = 8;

/**
 * Scores an answer set.
 *
 * Returns nulls rather than a guess when too little has been answered. A score
 * of 3 out of 6 answered items is not "low distress" — it is an unfinished
 * questionnaire, and reporting it as a result would understate a woman who
 * stopped halfway because the questions were hard to sit with.
 */
export function srqResult(answers = {}) {
  const answered = SRQ20.filter((i) => typeof answers[i.id] === 'boolean');
  const score = answered.filter((i) => answers[i.id] === true).length;
  const urgent = answers[URGENT_ITEM] === true;
  const complete = answered.length === SRQ20.length;

  // Below three-quarters answered, a total says more about what she skipped
  // than about how she is.
  const scoreable = answered.length >= 15;

  return {
    score: scoreable ? score : null,
    answered: answered.length,
    total: SRQ20.length,
    complete,
    scoreable,
    urgent,
    /** Yes-answers grouped for the counsellor, in instrument order. */
    endorsed: answered.filter((i) => answers[i.id] === true).map((i) => i.id),
    band: !scoreable ? null : score >= SRQ_CUTOFF ? 'high' : score >= 5 ? 'moderate' : 'low',
  };
}

/**
 * How a score is described to the woman who just gave it.
 *
 * Carefully not a diagnosis, and carefully not a reassurance either. "You are
 * fine" is not ours to say from twenty questions, and neither is the opposite.
 * Each of these points at the same next step — talk to the counsellor — and
 * differs only in how much it leans on it.
 */
export const SRQ_BANDS = {
  low: {
    title: 'Fewer of these are troubling you right now',
    body: 'That is worth knowing, and it does not make what brought you here any less real. Bring this to your counsellor — the conversation is the part that helps.',
  },
  moderate: {
    title: 'Several of these are troubling you',
    body: 'Enough that it is worth saying out loud to someone trained to listen. This is common, it is treatable, and a counsellor is the right person to take it to.',
  },
  high: {
    title: 'A good many of these are troubling you',
    body: 'This is the point at which counsellors want to hear from you rather than wait. It is not a diagnosis and it does not tell you what is wrong — it says the load you are carrying is heavy enough to be worth proper attention, soon.',
  },
};

/** ── The case record ──────────────────────────────────────────── */
export const COUNSELLING = {
  id: 'counselling',
  label: 'Counselling intake',
  short: 'Counselling',
  specialty: 'Mental Health',
  minutes: 10,
  intro:
    'This is the case sheet your counsellor works from, so the first conversation can start with you rather than with paperwork. Nothing here is shared with anyone but the counsellor you see.',
  sections: [
    {
      id: 'background',
      title: 'A little about your days',
      note: 'Your name, age and phone are already on your record — no need to write them again.',
      fields: [
        {
          id: 'education',
          kind: 'text',
          label: 'Education',
          sub: 'ವಿದ್ಯಾಭ್ಯಾಸ',
          placeholder: 'Up to which class or degree',
          optional: true,
        },
        {
          id: 'occupation',
          kind: 'text',
          label: 'Occupation',
          sub: 'ಉದ್ಯೋಗ',
          placeholder: 'Including work at home, if that is your day',
          optional: true,
        },
      ],
    },
    {
      id: 'problem',
      title: 'What brings you here',
      note: 'In your own words. There is no wrong way to say it.',
      fields: [
        {
          id: 'problem',
          kind: 'long',
          label: 'What is troubling you?',
          sub: 'ಸಮಸ್ಯೆಗಳು',
          placeholder: 'Say it the way you would to someone you trust.',
          required: true,
        },
        {
          id: 'duration',
          kind: 'choice',
          label: 'How long has it been this way?',
          sub: 'ಎಷ್ಟು ದಿವಸಗಳಿಂದ?',
          options: [
            'Less than a week',
            'A few weeks',
            'One to six months',
            'Six months to two years',
            'More than two years',
            'As long as I can remember',
          ],
          required: true,
        },
        {
          id: 'onset',
          kind: 'long',
          label: 'How did it start? Was there an event, or a strain?',
          sub: 'ಹೇಗೆ ಶುರುವಾಯಿತು? ಏನಾದರೂ ಘಟನೆ?',
          placeholder: 'Something that happened, something that changed, or nothing you can point to — all of those are real answers.',
          optional: true,
        },
      ],
    },
    {
      id: 'stress',
      title: 'What is pressing on you',
      fields: [
        {
          id: 'stressFactors',
          kind: 'multi',
          label: 'What weighs on your mind most?',
          sub: 'ಮಾನಸಿಕ ಒತ್ತಡದ ವಿಚಾರಗಳು / ಚಿಂತೆ',
          hint: 'Pick as many as are true.',
          options: [
            'Money', 'Work', 'Studies', 'Marriage', 'In-laws', 'Husband or partner',
            'Children', 'Parents', 'Health — mine', 'Health — someone at home',
            'Housework', 'Loneliness', 'A loss', 'Safety at home', 'The future',
            'Nothing I can name',
          ],
          exclusive: 'Nothing I can name',
        },
        {
          id: 'stressNote',
          kind: 'long',
          label: 'Anything you would rather write than tick?',
          placeholder: 'Only if you want to.',
          optional: true,
        },
      ],
    },
    {
      id: 'physical',
      title: 'Your body',
      note: 'Counsellors ask because the body carries a great deal of this, and because a thyroid problem and low mood can look alike from the outside.',
      fields: [
        {
          id: 'physicalIllness',
          kind: 'bool',
          label: 'Do you have any physical illness?',
          sub: 'ಶಾರೀರಿಕ ಕಾಯಿಲೆ ಇದೆಯೇ?',
        },
        {
          id: 'physicalWhat',
          kind: 'text',
          label: 'If yes, what?',
          placeholder: 'Thyroid, blood pressure, diabetes, anaemia…',
          optional: true,
        },
      ],
    },
    {
      id: 'family',
      title: 'Your family',
      note: 'Who is around you, and what home is like day to day.',
      fields: [
        {
          id: 'familyDetails',
          kind: 'long',
          label: 'Tell us about the people you live with',
          sub: 'ಕುಟುಂಬದ ವಿವರಗಳು',
          placeholder: 'Who is at home, what they do, how things are between you.',
          optional: true,
        },
        {
          id: 'familyHistory',
          kind: 'bool',
          label: 'Has anyone in your family had a mental health difficulty?',
          hint: 'Depression, anxiety, an addiction, or anything treated by a psychiatrist. Say no if you do not know.',
          optional: true,
        },
      ],
    },
    {
      id: 'previous',
      title: 'Have you looked for help before?',
      fields: [
        {
          id: 'earlierConsult',
          kind: 'bool',
          label: 'Have you consulted anyone about this before?',
          sub: 'ಈ ಮೊದಲು ಸಲಹೆ ಪಡೆದಿದ್ದೀರಾ?',
        },
        {
          id: 'earlierWhere',
          kind: 'text',
          label: 'If yes — where, and roughly when?',
          sub: 'ಯಾವಾಗ, ಎಲ್ಲಿ?',
          placeholder: 'A hospital, a counsellor, a temple or a healer — all of it counts.',
          optional: true,
        },
        {
          id: 'earlierMedicines',
          kind: 'long',
          label: 'What medicines were you given, if any?',
          sub: 'ಏನು ಔಷಧಿ?',
          hint: 'The name if you have it, the look of the tablet if you do not. Anything you still take is the most useful part.',
          placeholder: 'It is fine not to remember.',
          optional: true,
        },
      ],
    },
    {
      id: 'srq',
      title: 'Twenty short questions',
      note: 'ಗಮನವಿಟ್ಟು ಓದಿ, ನಂತರ ಹೌದು ಅಥವಾ ಇಲ್ಲ ಗುರುತು ಹಾಕಿ · Read each one, then answer yes or no. Think of the last month.',
      /** Kept out of localStorage — see `sensitive` in useIntakeForm. */
      sensitive: true,
      fields: SRQ20.map((item) => ({
        id: item.id,
        kind: 'bool',
        label: item.label,
        sub: item.kn,
      })),
    },
  ],
};
