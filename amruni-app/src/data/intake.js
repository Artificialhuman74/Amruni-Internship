/**
 * Consultation intake forms for the traditional-medicine tracks.
 *
 * Two systems, two genuinely different interviews. A homeopath and an
 * ayurvedic physician are not asking the same questions in different words —
 * they are building different models of the same woman, and a single "general
 * intake" form serving both would be useless to each. So the specs live side
 * by side and share only a renderer.
 *
 * The homeopathic spec follows the classical case-taking order a practitioner
 * expects to read in: complaint → concomitants → past → family → personal →
 * mind. The order is not cosmetic. A repertorisation is worked up in that
 * sequence, and a form that scrambles it makes the practitioner do the
 * reassembly by hand.
 *
 * SECTION 6 IS DIFFERENT FROM EVERY OTHER FORM IN THIS APP. It asks about
 * childhood trauma, abuse, humiliation and bullying, because homeopathic
 * case-taking genuinely rests on it. That does not entitle us to spring it on
 * her between a question about her appetite and one about her sleep. It is
 * gated, skippable without penalty, and it surfaces a helpline when an answer
 * says it should — see `needsSupport` at the bottom of this file.
 */

// ── field kinds ────────────────────────────────────────────────
// text   — one line
// long   — a paragraph
// choice — pick one
// multi  — pick any
// scale  — 0..n with labelled ends
// bool   — yes / no

// ── Homeopathy ─────────────────────────────────────────────────
export const HOMEOPATHY = {
  id: 'homeopathy',
  label: 'Homeopathic case-taking',
  short: 'Homeopathy',
  specialty: 'Homeopathy',
  minutes: 12,
  intro:
    'A homeopath prescribes on the whole picture, not the complaint alone — which is why this asks about your sleep and your temperament as well as your symptoms.',
  sections: [
    {
      id: 'complaint',
      title: 'What brings you here',
      note: 'Your own words are more useful here than medical ones.',
      fields: [
        {
          id: 'complaint',
          kind: 'long',
          label: 'What is troubling you most right now?',
          placeholder: 'Describe it the way you would to someone you trust.',
          required: true,
        },
        {
          id: 'onset',
          kind: 'choice',
          label: 'How did it begin?',
          options: [
            'Suddenly',
            'Gradually',
            'After an illness',
            'After a shock, loss or stressful event',
            'After childbirth',
            "I'm not sure",
          ],
        },
        {
          id: 'duration',
          kind: 'choice',
          label: 'How long have you had it?',
          options: [
            'Less than a week',
            'One to four weeks',
            'One to six months',
            'Six months to two years',
            'More than two years',
          ],
          required: true,
        },
        {
          id: 'progress',
          kind: 'choice',
          label: 'Which way is it going?',
          options: ['Getting worse', 'Staying about the same', 'Slowly improving', 'Comes and goes'],
        },
        {
          id: 'aggravation',
          kind: 'long',
          label: 'What makes it worse?',
          placeholder: 'Time of day, weather, food, movement, rest, before or during your period…',
          hint: 'Modalities — what worsens and what relieves — often decide the prescription.',
        },
        {
          id: 'amelioration',
          kind: 'long',
          label: 'What makes it better?',
          placeholder: 'Warmth, cold, pressure, open air, lying down, eating…',
        },
      ],
    },
    {
      id: 'associated',
      title: 'What comes with it',
      note: 'Symptoms that travel together tell a practitioner more than either does alone.',
      fields: [
        {
          id: 'concomitant',
          kind: 'long',
          label: 'What else shows up when this is at its worst?',
          placeholder: 'Headache with the nausea, weeping with the anger, chills before the pain…',
        },
        {
          id: 'alternating',
          kind: 'long',
          label: 'Does anything take its place when this settles down?',
          placeholder: 'Some complaints trade off — skin clears and the breathing tightens, for instance.',
        },
      ],
    },
    {
      id: 'past',
      title: 'Your medical past',
      note: 'Childhood illnesses count, however long ago.',
      fields: [
        {
          id: 'pastIllness',
          kind: 'multi',
          label: 'Have you had any of these?',
          options: [
            'Mumps',
            'Measles',
            'Chickenpox',
            'Jaundice',
            'Typhoid',
            'Hepatitis',
            'Tuberculosis',
            'Hernia',
            'Thyroid disorder',
            'Anaemia',
            'A surgery',
            'None of these',
          ],
          exclusive: 'None of these',
        },
        {
          id: 'pastNotes',
          kind: 'long',
          label: 'Anything else in your medical history?',
          placeholder: 'Accidents, long treatments, hospital stays, a vaccination that did not sit well…',
          optional: true,
        },
      ],
    },
    {
      id: 'family',
      title: 'Your family',
      note: 'Blood relatives only — parents, grandparents, brothers and sisters.',
      fields: [
        {
          id: 'familyHistory',
          kind: 'multi',
          label: 'Does any of this run in your family?',
          options: [
            'Diabetes',
            'High blood pressure',
            'Cancer',
            'Tuberculosis',
            'Asthma or allergy',
            'Heart disease',
            'Thyroid disorder',
            'Mental illness',
            'Nothing I know of',
          ],
          exclusive: 'Nothing I know of',
        },
        {
          id: 'familyNotes',
          kind: 'long',
          label: 'Who, and what?',
          placeholder: 'My mother has thyroid, my father’s side has diabetes…',
          optional: true,
        },
      ],
    },
    {
      id: 'personal',
      title: 'Your daily self',
      note: 'None of this is a test. There are no better or worse answers here.',
      fields: [
        {
          id: 'diet',
          kind: 'choice',
          label: 'What do you eat?',
          options: ['Vegetarian', 'Non-vegetarian', 'Eggetarian', 'Vegan', 'Jain'],
        },
        {
          id: 'appetite',
          kind: 'choice',
          label: 'Your appetite',
          options: ['Increased', 'Normal', 'Reduced', 'Changes a lot'],
        },
        {
          id: 'thirst',
          kind: 'choice',
          label: 'Your thirst',
          options: [
            'Small sips, often',
            'Large quantities, less often',
            'Very little — I forget to drink',
            'Normal',
          ],
          hint: 'The pattern matters more than the amount.',
        },
        {
          id: 'urine',
          kind: 'choice',
          label: 'Colour of your urine, usually',
          options: ['Clear or pale', 'Yellow', 'Dark yellow or brown', 'Cloudy'],
        },
        {
          id: 'urineBurning',
          kind: 'bool',
          label: 'Any burning or discomfort passing it?',
        },
        {
          id: 'bowels',
          kind: 'choice',
          label: 'Your bowels',
          options: [
            'Soft and regular',
            'Hard or difficult',
            'Loose',
            'Alternating between the two',
            'Irregular — no pattern',
          ],
        },
        {
          id: 'desires',
          kind: 'multi',
          label: 'What do you crave?',
          options: ['Sweet', 'Salty', 'Spicy', 'Sour', 'Bitter', 'Cold drinks', 'Warm food', 'Fried or fatty'],
        },
        {
          id: 'aversions',
          kind: 'multi',
          label: 'What can you not stand?',
          options: ['Milk', 'Sweets', 'Fatty food', 'Meat', 'Onion or garlic', 'Nothing in particular'],
          exclusive: 'Nothing in particular',
        },
        {
          id: 'thermal',
          kind: 'choice',
          label: 'Heat and cold',
          options: [
            'Chilly — I feel cold before others do',
            'Hot — I feel heat before others do',
            'Neither, particularly',
          ],
          hint: 'Think of a fan or a blanket: who reaches for it first, you or the room?',
        },
        {
          id: 'sweat',
          kind: 'choice',
          label: 'How much do you sweat?',
          options: ['A great deal', 'Normally', 'Very little'],
        },
        {
          id: 'sleep',
          kind: 'choice',
          label: 'Your sleep',
          options: [
            'Deep and refreshing',
            'Light — I wake often',
            'Hard to fall asleep',
            'I wake early and cannot go back',
            'I sleep more than I would like',
          ],
        },
        {
          id: 'menstrual',
          kind: 'choice',
          label: 'Your periods',
          options: [
            'Regular and manageable',
            'Regular but painful',
            'Irregular',
            'Heavy',
            'Scanty',
            'Stopped — menopause',
            'Not applicable',
          ],
        },
        {
          id: 'menstrualNotes',
          kind: 'long',
          label: 'Anything about your cycle a practitioner should know?',
          placeholder: 'Clots, mood before it starts, pain that travels, spotting between…',
          optional: true,
        },
      ],
    },
    {
      id: 'mind',
      title: 'How you are in yourself',
      note: 'The section a homeopath weighs most heavily. Answer what you want to; every question here can be left alone.',
      sensitive: true,
      fields: [
        {
          id: 'disposition',
          kind: 'choice',
          label: 'Left to yourself, are you more inward or more outward?',
          options: ['More inward', 'More outward', 'Depends entirely on who I am with'],
        },
        {
          id: 'expression',
          kind: 'choice',
          label: 'When something upsets you',
          options: [
            'I keep it to myself',
            'I talk it through with someone',
            'Some of both, depending',
          ],
        },
        {
          id: 'consolation',
          kind: 'choice',
          label: 'When someone comforts you while you are upset, it',
          options: ['Helps', 'Makes it worse', 'Makes no difference'],
          hint: 'A small question that carries real weight in a homeopathic case.',
        },
        {
          id: 'weeping',
          kind: 'choice',
          label: 'Crying comes',
          options: [
            'Easily',
            'Rarely',
            'Only when I am alone',
            'Not at all, even when I want it to',
          ],
        },
        {
          id: 'fears',
          kind: 'multi',
          label: 'Do any of these sit with you?',
          options: [
            'Being alone',
            'Crowds',
            'The dark',
            'Illness or dying',
            'Failing',
            'Something happening to my family',
            'Heights',
            'Nothing strongly',
          ],
          exclusive: 'Nothing strongly',
        },
        {
          id: 'anger',
          kind: 'choice',
          label: 'Your anger',
          options: [
            'Flares and passes quickly',
            'Builds slowly and stays',
            'I swallow it',
            'It comes out as tears',
            'I rarely feel it',
          ],
        },
      ],
    },
    // Held apart from the rest of `mind` on purpose: this is the only place in
    // Amruni that asks a woman about abuse, and it is entered deliberately or
    // not at all. See IntakeForm's consent gate.
    {
      id: 'history',
      title: 'Things that were hard',
      note: 'Optional, always. Skipping this does not weaken your consultation.',
      sensitive: true,
      gated: true,
      gate: {
        title: 'This part asks about difficult experiences',
        body:
          'A homeopath asks about these because grief, fright and humiliation are treated as causes in this system, not as background. It is still yours to decline. Nothing here is required, you can leave any question blank, and you can close this section and submit the rest.',
        who: 'Read only by the practitioner you consult. Never shown in the community, never used for recommendations.',
        enter: 'I’ll answer these',
        skip: 'Skip this section',
      },
      fields: [
        {
          id: 'hardExperiences',
          kind: 'multi',
          label: 'Has anything here been part of your life?',
          options: [
            'Something frightening or unsafe in childhood',
            'Losing someone close to me',
            'Abuse or violence',
            'Being humiliated or insulted in front of others',
            'Being ragged or bullied',
            'Discrimination at work or in study',
            'Something at home I have not spoken about',
            'Prefer not to answer',
          ],
          exclusive: 'Prefer not to answer',
          optional: true,
        },
        {
          id: 'hardNotes',
          kind: 'long',
          label: 'Anything you want your practitioner to know before you meet',
          placeholder: 'As much or as little as you like.',
          optional: true,
        },
        {
          id: 'stillAffects',
          kind: 'scale',
          label: 'How much does it still reach you today?',
          min: 0,
          max: 4,
          ends: ['Not at all', 'A great deal'],
          optional: true,
        },
      ],
    },
  ],
};

// ── Ayurveda ───────────────────────────────────────────────────
// Built around prakriti assessment: the constitutional questions carry dosha
// weights and are scored on submit (see `scorePrakriti`). Everything else —
// agni, koshta, dinacharya, artava — is the standard intake an ayurvedic
// physician takes before prescribing.
export const AYURVEDA = {
  id: 'ayurveda',
  label: 'Ayurvedic consultation form',
  short: 'Ayurveda',
  specialty: 'Ayurveda',
  minutes: 10,
  intro:
    'Ayurveda treats the person before the complaint. These questions build your prakriti — your constitution — which is what the prescription is fitted to.',
  sections: [
    {
      id: 'concern',
      title: 'What brings you here',
      fields: [
        {
          id: 'concern',
          kind: 'long',
          label: 'What would you like help with?',
          placeholder: 'In your own words.',
          required: true,
        },
        {
          id: 'duration',
          kind: 'choice',
          label: 'How long has it been there?',
          options: [
            'Less than a month',
            'One to six months',
            'Six months to two years',
            'More than two years',
          ],
          required: true,
        },
        {
          id: 'treatedBefore',
          kind: 'bool',
          label: 'Have you been treated for this before?',
        },
        {
          id: 'currentMedicines',
          kind: 'long',
          label: 'Anything you are taking now',
          placeholder: 'Allopathic, ayurvedic, supplements — all of it, so nothing clashes.',
          hint: 'Ayurvedic and allopathic medicines can interact. This is the question that prevents it.',
        },
      ],
    },
    {
      id: 'prakriti',
      title: 'Your constitution',
      note: 'Answer for how you have been most of your life, not how you are this week.',
      fields: [
        {
          id: 'frame',
          kind: 'choice',
          label: 'Your build',
          options: [
            { label: 'Thin, hard to gain weight', dosha: 'vata' },
            { label: 'Medium, well proportioned', dosha: 'pitta' },
            { label: 'Solid, gains weight easily', dosha: 'kapha' },
          ],
        },
        {
          id: 'skin',
          kind: 'choice',
          label: 'Your skin',
          options: [
            { label: 'Dry, rough, cool', dosha: 'vata' },
            { label: 'Warm, reddish, prone to rashes', dosha: 'pitta' },
            { label: 'Soft, oily, cool and thick', dosha: 'kapha' },
          ],
        },
        {
          id: 'hair',
          kind: 'choice',
          label: 'Your hair',
          options: [
            { label: 'Dry, thin, frizzy', dosha: 'vata' },
            { label: 'Fine, early greying or thinning', dosha: 'pitta' },
            { label: 'Thick, heavy, oily', dosha: 'kapha' },
          ],
        },
        {
          id: 'appetite',
          kind: 'choice',
          label: 'Your appetite',
          options: [
            { label: 'Irregular — sometimes ravenous, sometimes none', dosha: 'vata' },
            { label: 'Sharp — I get irritable if a meal is late', dosha: 'pitta' },
            { label: 'Steady and mild — I can skip a meal easily', dosha: 'kapha' },
          ],
        },
        {
          id: 'temperature',
          kind: 'choice',
          label: 'Weather you cannot bear',
          options: [
            { label: 'Cold and wind', dosha: 'vata' },
            { label: 'Heat and sun', dosha: 'pitta' },
            { label: 'Damp and cloudy', dosha: 'kapha' },
          ],
        },
        {
          id: 'sleepQuality',
          kind: 'choice',
          label: 'Your sleep',
          options: [
            { label: 'Light, broken, an active mind at night', dosha: 'vata' },
            { label: 'Moderate but sound, I wake alert', dosha: 'pitta' },
            { label: 'Deep and long, hard to get up', dosha: 'kapha' },
          ],
        },
        {
          id: 'temperament',
          kind: 'choice',
          label: 'Under pressure you become',
          options: [
            { label: 'Anxious, scattered, worried', dosha: 'vata' },
            { label: 'Irritable, sharp, critical', dosha: 'pitta' },
            { label: 'Withdrawn, heavy, slow to move', dosha: 'kapha' },
          ],
        },
        {
          id: 'memory',
          kind: 'choice',
          label: 'Your memory',
          options: [
            { label: 'Quick to learn, quick to forget', dosha: 'vata' },
            { label: 'Sharp and accurate', dosha: 'pitta' },
            { label: 'Slow to learn, but it stays', dosha: 'kapha' },
          ],
        },
      ],
    },
    {
      id: 'agni',
      title: 'Digestion',
      note: 'Agni and koshta — how you digest, and how you eliminate.',
      fields: [
        {
          id: 'digestion',
          kind: 'choice',
          label: 'After a full meal you feel',
          options: [
            'Bloated or gassy',
            'Heartburn or acidity',
            'Heavy and sleepy',
            'Comfortable',
          ],
        },
        {
          id: 'koshta',
          kind: 'choice',
          label: 'Your bowel movement',
          options: [
            'Dry and hard, sometimes skips a day',
            'Loose, more than once a day',
            'Regular, formed, once a day',
            'Sticky, incomplete, sluggish',
          ],
        },
        {
          id: 'water',
          kind: 'choice',
          label: 'Water in a day',
          options: ['Less than 1 litre', '1–2 litres', '2–3 litres', 'More than 3 litres'],
        },
        {
          id: 'tastes',
          kind: 'multi',
          label: 'Tastes you reach for',
          options: ['Sweet', 'Sour', 'Salty', 'Pungent — chilli, ginger', 'Bitter', 'Astringent'],
          hint: 'The six rasas. What you are drawn to says something about what you are short of.',
        },
      ],
    },
    {
      id: 'dinacharya',
      title: 'Your daily rhythm',
      note: 'Dinacharya. In Ayurveda, when you do something matters as much as what.',
      fields: [
        {
          id: 'wakeTime',
          kind: 'choice',
          label: 'You usually wake',
          options: ['Before 6 am', '6–8 am', '8–10 am', 'After 10 am', 'No fixed time'],
        },
        {
          id: 'sleepTime',
          kind: 'choice',
          label: 'You usually sleep',
          options: ['Before 10 pm', '10 pm–midnight', 'After midnight', 'No fixed time'],
        },
        {
          id: 'mealRegularity',
          kind: 'choice',
          label: 'Your meals',
          options: [
            'At roughly the same times each day',
            'Whenever I get a chance',
            'I skip meals often',
          ],
        },
        {
          id: 'movement',
          kind: 'choice',
          label: 'Movement or exercise',
          options: ['Daily', 'A few times a week', 'Rarely', 'Not at all'],
        },
        {
          id: 'stressLevel',
          kind: 'scale',
          label: 'Your stress, most days',
          min: 0,
          max: 4,
          ends: ['Settled', 'Overwhelming'],
        },
      ],
    },
    {
      id: 'artava',
      title: 'Cycle and reproductive health',
      note: 'Artava. Leave anything that does not apply.',
      fields: [
        {
          id: 'cycleRegularity',
          kind: 'choice',
          label: 'Your cycle',
          options: [
            'Regular, 26–32 days',
            'Irregular',
            'Very long gaps',
            'Stopped — menopause',
            'Not applicable',
          ],
        },
        {
          id: 'flow',
          kind: 'choice',
          label: 'Your flow',
          options: ['Light', 'Moderate', 'Heavy', 'Varies each month', 'Not applicable'],
        },
        {
          id: 'cyclePain',
          kind: 'scale',
          label: 'Period pain',
          min: 0,
          max: 4,
          ends: ['None', 'Severe'],
        },
        {
          id: 'gynaeNotes',
          kind: 'long',
          label: 'Anything else about your reproductive health',
          placeholder: 'PCOS, fibroids, discharge, fertility treatment, pregnancies…',
          optional: true,
        },
      ],
    },
  ],
};

export const FORMS = { homeopathy: HOMEOPATHY, ayurveda: AYURVEDA };

export const FORM_LIST = [HOMEOPATHY, AYURVEDA];

/** Every field in a form, flattened — used for progress and validation. */
export function allFields(form) {
  return form.sections.flatMap((s) => s.fields.map((f) => ({ ...f, sectionId: s.id })));
}

/** An option's stored value, whether it was written as a string or an object. */
export function optionValue(opt) {
  return typeof opt === 'string' ? opt : opt.label;
}

/**
 * Answered-ness of one field. A `bool` false and a scale 0 are answers; an
 * empty string and an empty array are not.
 */
export function isAnswered(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/** Required fields still empty, by section — what blocks submission. */
export function missingRequired(form, answers, skipped = []) {
  return allFields(form).filter(
    (f) =>
      f.required &&
      !skipped.includes(f.sectionId) &&
      !isAnswered(answers[f.id]),
  );
}

/** 0–1 completion across everything not marked optional and not skipped. */
export function completion(form, answers, skipped = []) {
  const counted = allFields(form).filter((f) => !f.optional && !skipped.includes(f.sectionId));
  if (!counted.length) return 1;
  const done = counted.filter((f) => isAnswered(answers[f.id])).length;
  return done / counted.length;
}

/**
 * Dosha tally from the constitutional questions.
 *
 * Deliberately reported as a spread rather than a single label: nearly nobody
 * is one dosha, and a form that announces "you are Pitta" from eight questions
 * is claiming a precision it does not have. The practitioner confirms it in
 * consultation — this is a starting sketch, and the UI says so.
 */
export function scorePrakriti(answers) {
  const tally = { vata: 0, pitta: 0, kapha: 0 };
  const section = AYURVEDA.sections.find((s) => s.id === 'prakriti');
  let answered = 0;

  for (const field of section.fields) {
    const chosen = answers[field.id];
    if (!chosen) continue;
    const opt = field.options.find((o) => optionValue(o) === chosen);
    if (opt?.dosha) {
      tally[opt.dosha] += 1;
      answered += 1;
    }
  }
  if (!answered) return null;

  const percent = Object.fromEntries(
    Object.entries(tally).map(([k, v]) => [k, Math.round((v / answered) * 100)]),
  );
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const [second, secondScore] = ranked[1];
  // Within one answer of each other reads as dual — which is the common case.
  const dual = topScore - secondScore <= 1 && secondScore > 0;

  return {
    tally,
    percent,
    dominant: top,
    secondary: dual ? second : null,
    label: dual ? `${DOSHA[top].name}–${DOSHA[second].name}` : DOSHA[top].name,
    answered,
    total: section.fields.length,
  };
}

export const DOSHA = {
  vata: {
    name: 'Vata',
    element: 'Air and space',
    trait: 'Movement, quickness, change',
    color: 'var(--clr-sky)',
    soft: 'var(--clr-sky-soft)',
    note: 'Warmth, routine and regular meals steady a vata constitution.',
  },
  pitta: {
    name: 'Pitta',
    element: 'Fire and water',
    trait: 'Heat, sharpness, drive',
    color: 'var(--clr-brand)',
    soft: 'var(--clr-brand-soft)',
    note: 'Cooling foods, rest and not skipping meals settle a pitta constitution.',
  },
  kapha: {
    name: 'Kapha',
    element: 'Earth and water',
    trait: 'Structure, steadiness, calm',
    color: 'var(--clr-sage)',
    soft: 'var(--clr-sage-soft)',
    note: 'Movement, stimulation and lighter food lift a kapha constitution.',
  },
};

/**
 * Whether her answers to the difficult-experiences section warrant offering
 * the helpline before she leaves the screen.
 *
 * Offered — never forced, and never phrased as an alarm. A woman who has just
 * written down that she was hurt should not have the screen react as though
 * she has done something wrong.
 */
export function needsSupport(answers) {
  const hard = answers.hardExperiences ?? [];
  const heavy = ['Abuse or violence', 'Something frightening or unsafe in childhood'];
  const flagged = hard.some((h) => heavy.includes(h));
  const stillHigh = (answers.stillAffects ?? 0) >= 3;
  return flagged || stillHigh;
}
