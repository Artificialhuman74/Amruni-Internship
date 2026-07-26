/**
 * Pre-existing conditions she can declare about herself.
 *
 * Two jobs, and they pull in different directions:
 *
 *   · A doctor opening her chart needs terms that mean something clinically.
 *   · A sixteen-year-old typing on a phone needs to find "sugar" and land on
 *     diabetes, or "period pain" and land on endometriosis.
 *
 * So every entry carries `find` — the words people actually use, including
 * common Indian-English usage ("sugar", "BP", "thyroid problem") and lay names.
 * The label stays clinical; the search meets her where she is.
 *
 * `affectsCycle` marks conditions with an established effect on menstrual
 * regularity. The server widens its prediction window for these rather than
 * claiming a precision the body won't honour (see routes_ml.py).
 *
 * Nothing here is a diagnosis and nothing is required — this is her telling us
 * what she already knows, so we stop asking her to repeat it.
 */

export const CONDITION_GROUPS = [
  {
    id: 'menstrual',
    label: 'Periods & gynaecological',
    items: [
      { id: 'pcos', common: true, label: 'PCOS / PCOD', affectsCycle: true, find: 'polycystic ovary ovarian pcod cysts irregular' },
      { id: 'endometriosis', common: true, label: 'Endometriosis', affectsCycle: true, find: 'endo painful periods pelvic pain' },
      { id: 'fibroids', common: true, label: 'Uterine fibroids', affectsCycle: true, find: 'fibroid myoma heavy bleeding' },
      { id: 'amenorrhea', label: 'Absent or very irregular periods', affectsCycle: true, find: 'amenorrhea no periods missed irregular' },
      { id: 'menorrhagia', label: 'Very heavy periods', affectsCycle: true, find: 'menorrhagia heavy bleeding flooding' },
      { id: 'pmdd', common: true, label: 'PMDD / severe PMS', affectsCycle: true, find: 'pmdd pms premenstrual mood' },
      { id: 'ovarian_cyst', label: 'Ovarian cysts', affectsCycle: true, find: 'cyst ovary' },
      { id: 'infertility', label: 'Fertility difficulties', find: 'infertility trying to conceive ivf' },
      { id: 'endo_uti', label: 'Recurrent UTIs', find: 'uti urine infection burning' },
    ],
  },
  {
    id: 'hormonal',
    label: 'Hormones & metabolism',
    items: [
      { id: 'hypothyroid', common: true, label: 'Hypothyroidism', affectsCycle: true, find: 'thyroid underactive tsh weight gain slow' },
      { id: 'hyperthyroid', label: 'Hyperthyroidism', affectsCycle: true, find: 'thyroid overactive graves' },
      { id: 'diabetes_t1', label: 'Type 1 diabetes', find: 'sugar diabetes insulin' },
      { id: 'diabetes_t2', common: true, label: 'Type 2 diabetes', affectsCycle: true, find: 'sugar diabetes' },
      { id: 'prediabetes', label: 'Pre-diabetes / insulin resistance', affectsCycle: true, find: 'sugar insulin resistance borderline' },
      { id: 'gestational_diabetes', label: 'Gestational diabetes (past pregnancy)', find: 'sugar pregnancy gdm' },
      { id: 'obesity', common: true, label: 'Obesity', affectsCycle: true, find: 'weight bmi overweight' },
      { id: 'underweight', label: 'Being underweight', affectsCycle: true, find: 'weight low thin bmi' },
      { id: 'pcos_hirsutism', label: 'Excess hair growth / hirsutism', find: 'hair facial hirsutism' },
    ],
  },
  {
    id: 'heart',
    label: 'Heart & circulation',
    items: [
      { id: 'hypertension', common: true, label: 'High blood pressure', find: 'bp pressure hypertension' },
      { id: 'hypotension', label: 'Low blood pressure', find: 'bp low pressure dizzy' },
      { id: 'high_cholesterol', label: 'High cholesterol', find: 'cholesterol lipids' },
      { id: 'heart_disease', label: 'Heart disease', find: 'cardiac heart attack angina' },
      { id: 'arrhythmia', label: 'Irregular heartbeat', find: 'palpitations arrhythmia afib' },
      { id: 'clotting', label: 'Blood clots / clotting disorder', find: 'dvt clot thrombosis embolism' },
      { id: 'stroke', label: 'Stroke (past)', find: 'stroke paralysis' },
    ],
  },
  {
    id: 'mental',
    label: 'Mental health',
    items: [
      { id: 'depression', common: true, label: 'Depression', find: 'depression low mood sad' },
      { id: 'anxiety', common: true, label: 'Anxiety', find: 'anxiety panic worry' },
      { id: 'ppd', common: true, label: 'Post-partum depression (past)', find: 'ppd postnatal after delivery' },
      { id: 'bipolar', label: 'Bipolar disorder', find: 'bipolar manic' },
      { id: 'eating_disorder', label: 'Eating disorder', affectsCycle: true, find: 'anorexia bulimia eating' },
      { id: 'ocd', label: 'OCD', find: 'ocd obsessive compulsive' },
      { id: 'ptsd', label: 'PTSD / trauma', find: 'ptsd trauma' },
      { id: 'insomnia', label: 'Chronic sleep problems', find: 'insomnia sleep' },
    ],
  },
  {
    id: 'blood',
    label: 'Blood',
    items: [
      { id: 'anaemia', common: true, label: 'Anaemia', affectsCycle: true, find: 'anemia iron haemoglobin low blood weak' },
      { id: 'thalassemia', label: 'Thalassemia', find: 'thalassemia' },
      { id: 'sickle_cell', label: 'Sickle cell', find: 'sickle' },
      { id: 'bleeding_disorder', label: 'Bleeding disorder', affectsCycle: true, find: 'von willebrand haemophilia bleeding' },
    ],
  },
  {
    id: 'autoimmune',
    label: 'Immune & autoimmune',
    items: [
      { id: 'rheumatoid', label: 'Rheumatoid arthritis', find: 'arthritis joints ra' },
      { id: 'lupus', label: 'Lupus (SLE)', affectsCycle: true, find: 'lupus sle' },
      { id: 'coeliac', label: 'Coeliac disease', find: 'celiac gluten' },
      { id: 'psoriasis', label: 'Psoriasis', find: 'psoriasis skin' },
      { id: 'hiv', label: 'HIV', find: 'hiv' },
    ],
  },
  {
    id: 'respiratory',
    label: 'Breathing',
    items: [
      { id: 'asthma', common: true, label: 'Asthma', find: 'asthma inhaler wheeze breathless' },
      { id: 'copd', label: 'COPD', find: 'copd smoker lungs' },
      { id: 'tb', label: 'Tuberculosis (past or current)', find: 'tb tuberculosis' },
      { id: 'sleep_apnoea', label: 'Sleep apnoea', find: 'apnea snoring' },
    ],
  },
  {
    id: 'digestive',
    label: 'Digestion & liver',
    items: [
      { id: 'ibs', label: 'IBS', find: 'ibs bowel bloating' },
      { id: 'ibd', label: "Crohn's / ulcerative colitis", find: 'crohns colitis ibd' },
      { id: 'gerd', label: 'Acid reflux / GERD', find: 'acidity reflux heartburn gas' },
      { id: 'fatty_liver', label: 'Fatty liver', find: 'liver fatty nafld' },
      { id: 'gallstones', label: 'Gallstones', find: 'gallbladder stones' },
    ],
  },
  {
    id: 'bones',
    label: 'Bones & joints',
    items: [
      { id: 'osteoporosis', label: 'Osteoporosis / low bone density', find: 'bones osteoporosis fracture' },
      { id: 'vitamin_d', label: 'Vitamin D deficiency', find: 'vitamin d deficiency bones' },
      { id: 'back_pain', label: 'Chronic back pain', find: 'back spine slipped disc' },
      { id: 'migraine', common: true, label: 'Migraine', affectsCycle: true, find: 'migraine headache' },
    ],
  },
  {
    id: 'kidney',
    label: 'Kidneys & urinary',
    items: [
      { id: 'ckd', label: 'Kidney disease', find: 'kidney renal ckd' },
      { id: 'kidney_stones', label: 'Kidney stones', find: 'stones kidney' },
    ],
  },
  {
    id: 'cancer',
    label: 'Cancer history',
    items: [
      { id: 'breast_cancer', label: 'Breast cancer', find: 'breast cancer tumour lump' },
      { id: 'cervical_cancer', label: 'Cervical cancer', find: 'cervix cancer hpv' },
      { id: 'ovarian_cancer', label: 'Ovarian cancer', find: 'ovary cancer' },
      { id: 'other_cancer', label: 'Another cancer', find: 'cancer tumour oncology' },
    ],
  },
];

/** Flat lookup, built once. */
export const ALL_CONDITIONS = CONDITION_GROUPS.flatMap((g) =>
  g.items.map((c) => ({ ...c, group: g.id, groupLabel: g.label })),
);

const BY_ID = new Map(ALL_CONDITIONS.map((c) => [c.id, c]));

export function conditionLabel(id) {
  return BY_ID.get(id)?.label ?? id;
}

/** Conditions with an established effect on cycle regularity. */
export const CYCLE_AFFECTING = ALL_CONDITIONS.filter((c) => c.affectsCycle).map((c) => c.id);

/**
 * Search across label, group and the lay synonyms. Ranked so a label match
 * beats a synonym match — typing "thyroid" should put the two thyroid entries
 * above everything that merely mentions it.
 */
export function searchConditions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;                       // null = "show the browsable groups"
  const terms = q.split(/\s+/);
  const scored = [];
  for (const c of ALL_CONDITIONS) {
    const label = c.label.toLowerCase();
    const hay = `${label} ${c.groupLabel.toLowerCase()} ${c.find}`;
    if (!terms.every((t) => hay.includes(t))) continue;
    scored.push({
      c,
      score: label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2,
    });
  }
  // Ties break toward prevalence, then alphabetically. Without this, typing
  // "sugar" put "Gestational diabetes (past pregnancy)" above type 2 purely
  // because G sorts before T — the rarer answer first, for no reason.
  return scored
    .sort((a, b) =>
      a.score - b.score
      || Number(Boolean(b.c.common)) - Number(Boolean(a.c.common))
      || a.c.label.localeCompare(b.c.label))
    .map((s) => s.c);
}
