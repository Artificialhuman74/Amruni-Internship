import {
  IconCramps, IconBloating, IconHeadache, IconFatigue, IconMind, IconHeart,
  IconAcne, IconBackPain, IconNausea, IconCraving, IconInsomnia, IconAnxiety,
  IconSprout, IconBlossom, IconBaby, IconCamellia, IconHome, IconDroplet,
  IconSparkles, IconCycle,
} from '../icons.jsx';

export const DOCTORS = [];

export const SPECIALTIES = [
  'All', 'Gynaecology', 'Fertility', 'Mental Health', 'Pregnancy', 'Menopause',
  // The traditional-care tracks. Kept at the end of the row rather than mixed
  // in: a woman looking for an obstetrician should not have to scroll past a
  // reiki practitioner to find one.
  'Homeopathy', 'Ayurveda', 'Yoga', 'Reiki',
];

export const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
];

export const PHQ9_OPTIONS = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

export const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it\'s hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
];

export const CYCLE_SYMPTOMS = [
  { id: 'cramps', label: 'Cramps', Icon: IconCramps },
  { id: 'bloating', label: 'Bloating', Icon: IconBloating },
  { id: 'headache', label: 'Headache', Icon: IconHeadache },
  { id: 'fatigue', label: 'Fatigue', Icon: IconFatigue },
  { id: 'mood_swings', label: 'Mood swings', Icon: IconMind },
  { id: 'breast_tender', label: 'Breast tenderness', Icon: IconHeart },
  { id: 'acne', label: 'Acne', Icon: IconAcne },
  { id: 'back_pain', label: 'Back pain', Icon: IconBackPain },
  { id: 'nausea', label: 'Nausea', Icon: IconNausea },
  { id: 'cravings', label: 'Cravings', Icon: IconCraving },
  { id: 'insomnia', label: 'Insomnia', Icon: IconInsomnia },
  { id: 'anxiety', label: 'Anxiety', Icon: IconAnxiety },
];

export const FLOW_LEVELS = [
  { id: 'none', label: 'None', color: 'var(--clr-border)' },
  { id: 'spotting', label: 'Spotting', color: 'var(--clr-brand-muted)' },
  { id: 'light', label: 'Light', color: oklch(0.70, 0.16, 24) },
  { id: 'medium', label: 'Medium', color: 'var(--clr-brand)' },
  { id: 'heavy', label: 'Heavy', color: 'var(--clr-brand-active)' },
];

function oklch(l, c, h) {
  return `oklch(${l} ${c} ${h})`;
}

export const LIFE_STAGES = [
  { id: 'adolescent', label: 'Adolescent', Icon: IconSprout, desc: 'Ages 10–19 · Navigating hormonal changes, PCOS, body image' },
  { id: 'reproductive', label: 'Reproductive Age', Icon: IconBlossom, desc: 'Ages 20–40 · Fertility, cycle health, hobbies and time for yourself' },
  { id: 'postpartum', label: 'Post-partum', Icon: IconBaby, desc: 'After childbirth · PPD support, lactation, recovery' },
  { id: 'menopause', label: 'Menopause', Icon: IconCamellia, desc: 'Perimenopause & beyond · Hormonal balance, bone health' },
  { id: 'elderly', label: 'Elderly Care', Icon: IconHome, desc: 'Set up by a family member · Appointment tracking, care coordination' },
];

export const PHASE_INFO = {
  menstrual: { name: 'Menstrual Phase', desc: 'Rest and gentle movement. Iron-rich foods help.', Icon: IconDroplet, class: 'menstrual' },
  follicular: { name: 'Follicular Phase', desc: 'Energy rising. Great time for new starts.', Icon: IconSprout, class: 'follicular' },
  ovulation: { name: 'Ovulation Window', desc: 'Peak fertility. You may feel your best today.', Icon: IconSparkles, class: 'ovulation' },
  luteal: { name: 'Luteal Phase', desc: 'Wind down. Magnesium and sleep support mood.', Icon: IconCycle, class: 'luteal' },
};
