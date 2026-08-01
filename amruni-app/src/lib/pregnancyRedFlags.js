/**
 * The symptoms that are not just symptoms.
 *
 * The day-log asks how her body feels and takes any answer the same way: a
 * chip goes dark, a row is written, nothing else happens. That is right for
 * heartburn and wrong for bleeding. A handful of things a pregnant woman can
 * notice are the recognised warning signs of pre-eclampsia, placental abruption,
 * ruptured membranes and infection, and the whole clinical value of knowing them
 * is that they are acted on the same day rather than logged and scrolled past.
 *
 * Two rules held this design:
 *
 *   · **Nothing is blocked and nothing is diagnosed.** She can log whatever she
 *     likes. What appears afterwards says what the sign can mean and who to
 *     call — it does not tell her what is wrong with her, because it does not
 *     know, and a phone that announces pre-eclampsia to a frightened woman at
 *     11pm has done harm whether or not it was right.
 *   · **It must stay quiet the rest of the time.** A product whose own brief
 *     says never expose fragility cannot flash red at every headache. The
 *     everyday list is untouched; these sit apart, named plainly, and each one
 *     speaks once a day rather than on every toggle.
 *
 * Sources: NICE NG201 (antenatal care) and CG107 (hypertension in pregnancy),
 * WHO maternal danger signs, ACOG urgent maternal warning signs.
 */

/**
 * `now` — go to a hospital, do not wait for a call back.
 * `today` — ring her midwife or doctor today; most of these turn out fine, and
 *           the ones that do not need hours rather than days.
 */
export const RED_FLAGS = [
  {
    id: 'bleeding',
    label: 'Bleeding',
    urgency: 'now',
    meaning: 'Any bleeding in pregnancy is checked, not waited on. Most causes are not dangerous, and the ones that are — the placenta separating, or lying low — are treated by how quickly they are seen.',
  },
  {
    id: 'severe-abdominal-pain',
    label: 'Severe stomach pain',
    urgency: 'now',
    meaning: 'Pain that is constant, severe, or does not ease when you rest is different from the stretching and cramping of a normal pregnancy.',
  },
  {
    id: 'fits',
    label: 'A fit or blackout',
    urgency: 'now',
    meaning: 'A convulsion or losing consciousness in pregnancy is an emergency. Call an ambulance rather than arranging your own transport.',
  },
  {
    id: 'waters',
    label: 'Fluid leaking',
    urgency: 'now',
    meaning: 'A gush or a steady trickle can mean your waters have broken. Before 37 weeks that needs to be seen straight away, and after it, still today.',
  },
  {
    id: 'headache-vision',
    label: 'Bad headache with blurred vision',
    urgency: 'now',
    meaning: 'A severe headache with flashing lights, blurring or spots is the combination that matters — together they are the classic warning of pre-eclampsia.',
  },
  {
    id: 'sudden-swelling',
    label: 'Sudden swelling of face or hands',
    urgency: 'today',
    meaning: 'Swollen ankles are ordinary. Swelling that arrives suddenly, or in your face, hands or around your eyes, is the kind that gets your blood pressure checked.',
  },
  {
    id: 'no-movement',
    label: 'Baby moving less than usual',
    urgency: 'now',
    from: 24,
    meaning: 'There is no normal number of kicks — only your baby’s own pattern. A change from it is checked the same day, every time, and you should never feel you are making a fuss.',
  },
  {
    id: 'fever',
    label: 'Fever or chills',
    urgency: 'today',
    meaning: 'A temperature in pregnancy is worth a call, because an infection is treated more easily early than late.',
  },
  {
    id: 'cant-keep-fluids',
    label: 'Cannot keep fluids down',
    urgency: 'today',
    meaning: 'Vomiting that stops you drinking anything for a day risks dehydration, and it is treatable — you do not have to endure it.',
  },
  {
    id: 'burning-urine',
    label: 'Burning when passing urine',
    urgency: 'today',
    meaning: 'A urine infection in pregnancy is common, easily treated, and worth catching — untreated it can bring labour on early.',
  },
  {
    id: 'chest-pain',
    label: 'Chest pain or breathless at rest',
    urgency: 'now',
    meaning: 'Being short of breath on the stairs is ordinary. Being short of breath sitting still, or having chest pain, is not.',
  },
];

const BY_ID = Object.fromEntries(RED_FLAGS.map((f) => [f.id, f]));

/** Those that apply at this stage. Fetal movement has no meaning before ~24 weeks. */
export function flagsFor(weeks) {
  return RED_FLAGS.filter((f) => f.from == null || (weeks != null && weeks >= f.from));
}

export function redFlag(id) {
  return BY_ID[id] ?? null;
}

export function isRedFlag(label) {
  return RED_FLAGS.some((f) => f.label === label);
}

/** What the sheet says at the top, per tier. */
export const URGENCY_COPY = {
  now: {
    title: 'This one is worth acting on now',
    body: 'Go to your maternity unit or call for an ambulance. It is very often nothing — being checked is how that gets established.',
  },
  today: {
    title: 'Worth a call today',
    body: 'Ring your midwife or doctor today rather than waiting for your next appointment. Most of these turn out fine.',
  },
};
