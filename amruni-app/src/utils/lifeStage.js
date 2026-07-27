import {
  IconCycle, IconSprout, IconPregnant, IconCamellia, IconWellness,
  IconStethoscope, IconWeight, IconSleep, IconGuide, IconHome,
} from '../components/common/Icons.jsx'

/**
 * Life stage is inferred from the woman's age rather than asked outright —
 * one less question, and it can't be set wrong. The goal she picks afterwards
 * refines it (a family caretaker, a pregnancy) where age alone can't.
 */
export function ageFromDob(dob) {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const hadBirthday =
    now.getMonth() > born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export function stageFromAge(age) {
  if (age == null) return 'reproductive';
  if (age <= 19) return 'adolescent';
  if (age <= 44) return 'reproductive';
  if (age <= 64) return 'menopause';
  return 'elderly';
}

export function stageFromDob(dob) {
  return stageFromAge(ageFromDob(dob));
}

// What the consumer is here for. Each goal personalizes Home and can override
// the age-derived stage or flip a mode (pregnancy, caretaker).
// `soon: true` marks a goal whose dedicated feature isn't built yet — picking
// it still completes onboarding, then lands on the Coming-soon page.
export const GOALS = [
  { id: 'cycle', Icon: IconCycle, label: 'Track my cycle', desc: 'Periods, symptoms and predictions' },
  { id: 'conceive', Icon: IconSprout, label: 'Trying to conceive', desc: 'Fertile window and ovulation' },
  { id: 'pregnancy', Icon: IconPregnant, label: "I'm pregnant", desc: 'Week-by-week, gently guided', pregnancyMode: true },
  { id: 'menopause', Icon: IconCamellia, label: 'Menopause support', desc: 'Hormones, mood and bone health', stage: 'menopause' },
  { id: 'mental', Icon: IconWellness, label: 'Mental wellbeing', desc: 'Screening and quiet support' },
  { id: 'pcos', Icon: IconStethoscope, label: 'Manage PCOS / a condition', desc: 'Track signs, get a specialist' },
  { id: 'weight', Icon: IconWeight, label: 'Manage my weight', desc: 'Track weight alongside your cycle', weightTracking: true },
  { id: 'sleep', Icon: IconSleep, label: 'Improve my sleep', desc: 'See how rest moves with your hormones', soon: true },
  { id: 'body', Icon: IconGuide, label: 'Understand my body', desc: 'Learn your patterns and what’s normal', soon: true },
  { id: 'caretaker', Icon: IconHome, label: 'Set up for a family member', desc: 'Appointments and care, on their behalf', stage: 'elderly' },
];

/** Resolve final { lifeStage, pregnancyMode } from age-derived stage + chosen goal. */
export function resolveFromGoal(dob, goalId) {
  const base = stageFromDob(dob);
  const goal = GOALS.find((g) => g.id === goalId);
  return {
    lifeStage: goal?.stage || base,
    pregnancyMode: !!goal?.pregnancyMode,
    // Choosing "Manage my weight" is itself the opt-in — she asked for it, so
    // Track shows the switch without asking a second time.
    weightTracking: !!goal?.weightTracking,
  };
}
