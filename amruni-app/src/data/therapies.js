/**
 * The traditional and complementary care tracks: Ayurveda, Reiki, Yoga.
 *
 * One rule governs everything in this file: each therapy states what it is
 * evidently good for and what it is not, in its own entry, in plain words.
 *
 * That is not caution for its own sake. Amruni's authority comes from being
 * accurate — a page that promises reiki will treat an illness costs the app
 * every other clinical claim it makes, to the woman who later finds out. So
 * `evidence` is a required field here, it is rendered on the therapy's page
 * rather than buried in a footnote, and the copy for reiki says plainly that
 * it is a relaxation practice with no demonstrated effect on disease.
 *
 * `links` are references, not affiliates. Government and institutional
 * sources only — the Ministry of Ayush and its councils — so a woman checking
 * up on us lands somewhere that outranks us.
 */

export const THERAPIES = [
  {
    id: 'ayurveda',
    name: 'Ayurveda',
    tagline: 'Constitution-led medicine',
    icon: 'leaf',
    color: 'var(--clr-sage)',
    soft: 'var(--clr-sage-soft)',
    summary:
      'India’s classical system of medicine. An ayurvedic physician builds a picture of your constitution — your prakriti — and prescribes food, routine and medicines fitted to it rather than to the complaint alone.',
    session:
      'A first consultation runs 30–45 minutes and covers your digestion, sleep, cycle and daily routine before it reaches your complaint. You leave with dietary guidance and, usually, a herbal preparation.',
    helpsWith: [
      'Digestive complaints and bloating',
      'Irregular cycles and PCOS support',
      'Sleep and stress',
      'Post-partum recovery',
      'Joint and back pain',
    ],
    evidence: {
      level: 'recognised',
      note: 'A recognised system of medicine in India, regulated by the Ministry of Ayush, with registered practitioners holding a BAMS degree. Evidence varies widely by preparation and condition.',
    },
    caution:
      'Tell your ayurvedic physician about every allopathic medicine you take. Some herbal preparations interact with blood thinners, thyroid medication and diabetes drugs. Certain formulations are not safe in pregnancy.',
    intakeForm: 'ayurveda',
    specialty: 'Ayurveda',
    links: [
      { label: 'Ministry of Ayush', href: 'https://ayush.gov.in/' },
      { label: 'Central Council for Research in Ayurvedic Sciences', href: 'https://ccras.nic.in/' },
      { label: 'National Commission for Indian System of Medicine', href: 'https://ncismindia.org/' },
    ],
  },
  {
    id: 'yoga',
    name: 'Yoga',
    tagline: 'Breath, movement, stillness',
    icon: 'sprout',
    color: 'var(--clr-fertile)',
    soft: 'var(--clr-fertile-soft)',
    summary:
      'Asana, pranayama and relaxation, taught for what your body needs now — a woman in her third trimester and a woman in perimenopause are not given the same practice.',
    session:
      'Sessions run 40–60 minutes, live over video with a qualified instructor who can see and correct you. Recorded practices are for days you cannot make the time.',
    helpsWith: [
      'Lower back and pelvic pain',
      'Sleep quality',
      'Anxiety and low mood',
      'Blood pressure',
      'Strength and balance through menopause',
    ],
    evidence: {
      level: 'evidenced',
      note: 'Among the better-evidenced practices here. Randomised trials support yoga for low back pain, sleep quality, blood pressure and symptoms of anxiety and depression.',
    },
    caution:
      'Tell your instructor if you are pregnant, recently post-partum, have high blood pressure, glaucoma, or a disc or joint problem. Several common postures need modifying or leaving out.',
    intakeForm: null,
    specialty: 'Yoga',
    tracks: [
      { id: 'prenatal', label: 'Prenatal', desc: 'Trimester-safe practice, cleared with your obstetrician' },
      { id: 'postnatal', label: 'Post-partum', desc: 'Core and pelvic floor, from six weeks after birth' },
      { id: 'cycle', label: 'Cycle-synced', desc: 'Practice that changes with your phase' },
      { id: 'pcos', label: 'PCOS', desc: 'Insulin-sensitivity and hormonal balance focus' },
      { id: 'menopause', label: 'Menopause', desc: 'Bone loading, balance, sleep and hot flushes' },
      { id: 'gentle', label: 'Gentle & elderly', desc: 'Chair-supported, joint-safe' },
    ],
    links: [
      { label: 'Morarji Desai National Institute of Yoga', href: 'https://yogamdniy.nic.in/' },
      { label: 'Ministry of Ayush — Yoga', href: 'https://ayush.gov.in/' },
      { label: 'Yoga Certification Board', href: 'https://yogacertificationboard.nic.in/' },
    ],
  },
  {
    id: 'reiki',
    name: 'Reiki',
    tagline: 'A relaxation practice',
    icon: 'wellness',
    color: 'var(--clr-mauve)',
    soft: 'var(--clr-mauve-soft)',
    summary:
      'A hands-on or distance practice in which a practitioner works through a sequence of positions while you rest. People commonly describe it as deeply calming.',
    session:
      'A session runs 30–50 minutes. You stay fully clothed and lying down. Distance sessions are conducted over a call at an agreed time.',
    helpsWith: [
      'Relaxation and a sense of calm',
      'Sleeping before a difficult day',
      'Feeling looked after during a hard stretch',
    ],
    // The honest entry. Written this way on purpose — see the file header.
    evidence: {
      level: 'complementary',
      note: 'Offered as a relaxation practice only. Controlled trials have not shown reiki to affect the course of any disease, and Amruni does not present it as treatment. Many women find it genuinely calming, and that is the claim being made here.',
    },
    caution:
      'Never in place of medical treatment. If a practitioner tells you to stop a prescribed medicine, that is a reason to leave the session and tell us.',
    intakeForm: null,
    specialty: 'Reiki',
    links: [],
  },
];

export const THERAPY_BY_ID = Object.fromEntries(THERAPIES.map((t) => [t.id, t]));

/** Evidence badge wording and colour, shared by the hub and the detail page. */
export const EVIDENCE_BADGE = {
  evidenced: { label: 'Trial-supported', color: 'var(--clr-success)', soft: 'var(--clr-success-soft)' },
  recognised: { label: 'Recognised system', color: 'var(--clr-sage)', soft: 'var(--clr-sage-soft)' },
  complementary: { label: 'Complementary — not treatment', color: 'var(--clr-ink-muted)', soft: 'var(--clr-surface-2)' },
};
