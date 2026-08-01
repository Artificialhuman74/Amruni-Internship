import { ageFromDob } from './lifeStage';
import { fertilityModel, todayIso } from './fertility';

/**
 * What is true about her right now, derived in one place.
 *
 * Modes arrived as loose booleans in settings, and every screen that cared
 * re-derived the meaning itself: Track works out `pregnancyMode && preg.known`,
 * WeightTracker works it out again, the conceive pane adds its own
 * `!pregnancyMode && conceiveMode` precedence rule. Three copies of one fact is
 * three chances for two screens to disagree about whether a woman is pregnant,
 * and the screens most likely to disagree are the ones added last.
 *
 * Worse, it kept the modes shallow. A flag that only Track knows how to read
 * can only change Track. The reason pregnancy never reached the SOS button or
 * the consult list is not that nobody thought of it — it is that reaching them
 * meant a fourth copy of the derivation. This module is what makes a mode able
 * to do more than one thing.
 *
 * Everything here is derived on read. Nothing is stored, because a stored
 * "weeks pregnant" is wrong by tomorrow.
 */

const STAGE_LABEL = {
  adolescent: 'Adolescent',
  reproductive: 'Reproductive age',
  postpartum: 'Post-partum',
  menopause: 'Menopause',
  elderly: 'Elderly care',
};

/** Which specialties this life actually needs, most relevant first. */
function specialtiesFor({ isPregnant, isTryingToConceive, stage, postpartumLikely }) {
  if (isPregnant) return ['Pregnancy', 'Gynaecology', 'Mental Health'];
  if (postpartumLikely) return ['Pregnancy', 'Mental Health', 'Gynaecology'];
  if (isTryingToConceive) return ['Fertility', 'Gynaecology'];
  if (stage === 'menopause') return ['Menopause', 'Gynaecology'];
  if (stage === 'adolescent') return ['Gynaecology', 'Mental Health'];
  if (stage === 'elderly') return ['Gynaecology', 'Menopause'];
  return [];
}

export function lifeContext(state) {
  const settings = state?.settings ?? {};
  const user = state?.user ?? {};
  const preg = state?.pregnancy ?? {};

  const pregnancyMode = Boolean(settings.pregnancyMode);
  const today = todayIso();

  // Gestational age, derived the same way usePregnancyData does.
  let weeks = null;
  let dueDate = preg.dueDateOverride ?? null;
  if (preg.lastPeriodStart || preg.dueDateOverride) {
    const lmp = preg.lastPeriodStart
      ? new Date(`${preg.lastPeriodStart}T00:00`)
      : new Date(new Date(`${preg.dueDateOverride}T00:00`).getTime() - 280 * 86400000);
    const due = preg.dueDateOverride
      ? new Date(`${preg.dueDateOverride}T00:00`)
      : new Date(lmp.getTime() + 280 * 86400000);
    dueDate = due.toISOString().slice(0, 10);
    weeks = Math.max(0, Math.floor((new Date(`${today}T00:00`) - lmp) / 604800000));
  }

  const known = weeks != null;
  const overdue = known && dueDate ? today > dueDate : false;

  /**
   * The end of a pregnancy is never assumed.
   *
   * A due date passing means the date passed. It does not mean a baby arrived,
   * and the app has no way to know which of the several things that might have
   * happened did. Auto-switching a woman who has had a loss into a post-partum
   * mode full of newborn content would be the cruellest bug this product could
   * ship. So this is a flag that something should be *asked*, never a state the
   * app enters on its own.
   */
  const postpartumLikely = pregnancyMode && overdue;

  const isPregnant = pregnancyMode && known && !overdue;
  const isTryingToConceive = !pregnancyMode && Boolean(settings.conceiveMode);

  const stage = user.lifeStage || 'reproductive';
  const age = ageFromDob(user.dob);

  const fertility = isTryingToConceive ? fertilityModel(state.cycle, today) : null;

  return {
    today,
    stage,
    stageLabel: STAGE_LABEL[stage] ?? null,
    age,

    isPregnant,
    weeks: isPregnant ? weeks : null,
    trimester: isPregnant ? (weeks <= 13 ? 1 : weeks <= 27 ? 2 : 3) : null,
    dueDate: isPregnant ? dueDate : null,
    postpartumLikely,

    isTryingToConceive,
    fertility,

    /** Ordered specialty hints for the consult list. */
    specialties: specialtiesFor({ isPregnant, isTryingToConceive, stage, postpartumLikely }),

    /**
     * One line, for whoever needs to know her situation in a hurry — the top of
     * a doctor's chart, the body of an emergency message.
     */
    headline: isPregnant
      ? `Pregnant · ${weeks} weeks`
      : postpartumLikely ? 'Recently pregnant — due date passed'
      : isTryingToConceive ? 'Trying to conceive'
      : STAGE_LABEL[stage] ?? null,
  };
}
