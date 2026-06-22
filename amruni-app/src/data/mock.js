export const DOCTORS = [
  { id: 1, name: 'Dr. Priya Nair', specialty: 'Gynaecologist & Obstetrician', rating: 4.9, reviews: 312, nextSlot: 'Today, 3:00 PM', avatar: '👩‍⚕️', exp: '14 yrs', fee: '₹499', lang: ['English', 'Malayalam', 'Hindi'] },
  { id: 2, name: 'Dr. Kavitha Rao', specialty: 'Reproductive Endocrinologist', rating: 4.8, reviews: 198, nextSlot: 'Today, 5:30 PM', avatar: '👩‍⚕️', exp: '11 yrs', fee: '₹699', lang: ['English', 'Kannada', 'Telugu'] },
  { id: 3, name: 'Dr. Anita Sharma', specialty: 'Maternal-Fetal Medicine', rating: 4.9, reviews: 427, nextSlot: 'Tomorrow, 10:00 AM', avatar: '👩‍⚕️', exp: '18 yrs', fee: '₹799', lang: ['English', 'Hindi'] },
  { id: 4, name: 'Dr. Meena Krishnan', specialty: 'Women\'s Mental Health', rating: 4.7, reviews: 156, nextSlot: 'Today, 6:00 PM', avatar: '👩‍⚕️', exp: '9 yrs', fee: '₹599', lang: ['English', 'Tamil', 'Kannada'] },
  { id: 5, name: 'Dr. Rekha Pillai', specialty: 'Homeopathic Gynaecology', rating: 4.6, reviews: 89, nextSlot: 'Tomorrow, 2:00 PM', avatar: '👩‍⚕️', exp: '7 yrs', fee: '₹349', lang: ['English', 'Malayalam'] },
  { id: 6, name: 'Dr. Sunita Gupta', specialty: 'Menopause Specialist', rating: 4.8, reviews: 234, nextSlot: 'Tomorrow, 11:30 AM', avatar: '👩‍⚕️', exp: '16 yrs', fee: '₹649', lang: ['English', 'Hindi', 'Punjabi'] },
];

export const SPECIALTIES = ['All', 'Gynaecology', 'Fertility', 'Mental Health', 'Pregnancy', 'Menopause', 'Homeopathy'];

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
  { id: 'cramps', label: 'Cramps', icon: '🔥' },
  { id: 'bloating', label: 'Bloating', icon: '💨' },
  { id: 'headache', label: 'Headache', icon: '🤕' },
  { id: 'fatigue', label: 'Fatigue', icon: '😴' },
  { id: 'mood_swings', label: 'Mood swings', icon: '🌊' },
  { id: 'breast_tender', label: 'Breast tenderness', icon: '💙' },
  { id: 'acne', label: 'Acne', icon: '✨' },
  { id: 'back_pain', label: 'Back pain', icon: '🦴' },
  { id: 'nausea', label: 'Nausea', icon: '🤢' },
  { id: 'cravings', label: 'Cravings', icon: '🍫' },
  { id: 'insomnia', label: 'Insomnia', icon: '🌙' },
  { id: 'anxiety', label: 'Anxiety', icon: '😰' },
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
  { id: 'adolescent', label: 'Adolescent', icon: '🌱', desc: 'Ages 10–19 · Navigating hormonal changes, PCOS, body image' },
  { id: 'reproductive', label: 'Reproductive Age', icon: '🌸', desc: 'Ages 20–40 · Fertility, cycle health, sexual wellness' },
  { id: 'postpartum', label: 'Post-partum', icon: '🤱', desc: 'After childbirth · PPD support, lactation, recovery' },
  { id: 'menopause', label: 'Menopause', icon: '🌺', desc: 'Perimenopause & beyond · Hormonal balance, bone health' },
  { id: 'elderly', label: 'Elderly Care', icon: '🏡', desc: 'Set up by a family member · Appointment tracking, care coordination' },
];

export const PHASE_INFO = {
  menstrual: { name: 'Menstrual Phase', desc: 'Rest and gentle movement. Iron-rich foods help.', icon: '🔴', class: 'menstrual' },
  follicular: { name: 'Follicular Phase', desc: 'Energy rising. Great time for new starts.', icon: '🌱', class: 'follicular' },
  ovulation: { name: 'Ovulation Window', desc: 'Peak fertility. You may feel your best today.', icon: '✨', class: 'ovulation' },
  luteal: { name: 'Luteal Phase', desc: 'Wind down. Magnesium and sleep support mood.', icon: '🌙', class: 'luteal' },
};
