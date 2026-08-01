/**
 * Trying to conceive: the fertile window, and what actually moves the odds.
 *
 * Two things this module refuses to do, because fertility apps routinely do
 * both and women make real decisions on the output:
 *
 *   · It does not invent precision. A calendar estimate built from a
 *     last-period date and an average cycle length is an estimate. Wilcox et
 *     al. (BMJ 2000) found the fertile window falls entirely within cycle days
 *     10–17 in only about 30% of women with regular cycles — so the window
 *     drawn here is a starting place to be corrected by her own body signs,
 *     and the screen says exactly that rather than printing a confident date.
 *   · It does not report a percentage per day. The day-specific probabilities
 *     exist in the literature, but they come from populations, not from her,
 *     and "9% today" reads as a fact about her cycle when it is nothing of the
 *     kind. Days are ranked instead — which is the part that is robust.
 *
 * The window itself is the well-established finding: conception follows
 * intercourse only in a six-day window ending on the day of ovulation, because
 * sperm survive up to about five days in fertile cervical mucus while the egg
 * is viable for roughly a day (Wilcox, Weinberg & Baird, NEJM 1995). The
 * highest chances are the two days before ovulation.
 */

const DAY = 86400000;

export const WINDOW_LENGTH = 6;        // five days before ovulation, plus the day itself
export const LUTEAL_DAYS = 14;         // ovulation sits ~14 days before the next period

function iso(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function parse(isoStr) {
  return new Date(`${isoStr}T00:00`);
}

function addDays(isoStr, n) {
  return iso(new Date(parse(isoStr).getTime() + n * DAY));
}

export function daysBetween(a, b) {
  return Math.round((parse(b) - parse(a)) / DAY);
}

export function todayIso() {
  return iso(new Date());
}

/**
 * How each day of the window ranks.
 *
 * Ordered by the shape found in Wilcox 1995 and Dunson 1999: chances climb
 * from about five days before ovulation, are highest on the two days before
 * it, and fall away sharply once ovulation has passed — the egg is gone within
 * a day, which is why the window ends rather than continuing.
 */
const TIERS = {
  '-5': { tier: 'rising', label: 'Window opens' },
  '-4': { tier: 'rising', label: 'Rising' },
  '-3': { tier: 'high', label: 'High' },
  '-2': { tier: 'peak', label: 'Best day' },
  '-1': { tier: 'peak', label: 'Best day' },
  '0': { tier: 'ovulation', label: 'Ovulation' },
};

const TIER_WEIGHT = { rising: 0.45, high: 0.7, peak: 1, ovulation: 0.8 };

export function tierWeight(tier) {
  return TIER_WEIGHT[tier] ?? 0.3;
}

/**
 * The window for the cycle she is in now.
 *
 * Rolls forward from her last logged period rather than reading it literally:
 * a woman who logged a period seven weeks ago should not be shown a window
 * that closed a month back. Past two missed cycles it stops guessing and says
 * the estimate is stale, because at that point the arithmetic is fiction and a
 * late period is itself the more important thing to notice.
 */
export function fertilityModel(cycle, today = todayIso()) {
  const { lastPeriodStart, cycleLength = 28 } = cycle || {};
  if (!lastPeriodStart) return { known: false, reason: 'no-period' };

  const len = Math.max(21, Math.min(45, Number(cycleLength) || 28));
  const elapsed = daysBetween(lastPeriodStart, today);
  if (elapsed < 0) return { known: false, reason: 'no-period' };

  const cyclesPassed = Math.floor(elapsed / len);
  if (cyclesPassed > 2) return { known: false, reason: 'stale', lastPeriodStart };

  // The cycle she is in now. Everything she is told *about today* — the cycle
  // day, when her next period is due — is measured from here.
  const currentStart = addDays(lastPeriodStart, cyclesPassed * len);

  // The window she is being shown may belong to the next cycle instead: once
  // ovulation has passed, the useful answer is the window coming up, not the
  // one that closed yesterday. These two starts are kept apart deliberately —
  // measuring the cycle day from a start date in the future is what produced
  // "day -12 of your cycle".
  let ovulation = addDays(currentStart, len - LUTEAL_DAYS);
  if (daysBetween(today, ovulation) < 0) {
    ovulation = addDays(ovulation, len);
  }

  const windowStart = addDays(ovulation, -(WINDOW_LENGTH - 1));
  const days = [];
  for (let offset = -(WINDOW_LENGTH - 1); offset <= 0; offset++) {
    const date = addDays(ovulation, offset);
    days.push({ date, offset, ...TIERS[String(offset)], isToday: date === today });
  }

  const daysToOvulation = daysBetween(today, ovulation);
  const daysToWindow = daysBetween(today, windowStart);
  const inWindow = daysToWindow <= 0 && daysToOvulation >= 0;
  const todayDay = days.find((d) => d.isToday) || null;

  return {
    known: true,
    cycleStart: currentStart,
    cycleLength: len,
    ovulation,
    windowStart,
    windowEnd: ovulation,
    peakStart: addDays(ovulation, -2),
    nextPeriod: addDays(currentStart, len),
    days,
    inWindow,
    daysToWindow,
    daysToOvulation,
    tier: todayDay?.tier ?? null,
    cycleDay: daysBetween(currentStart, today) + 1,
  };
}

/**
 * The one line at the top of the screen.
 *
 * Written as the answer to "should this week matter to me", which is the only
 * question the screen is really asked — and, on the days when the answer is
 * no, written to say so out loud. A fertility app that finds something for her
 * to do every single day of the month turns two useful days into thirty
 * anxious ones. "Nothing to do until then" is the most useful sentence here.
 */
export function windowHeadline(model) {
  if (!model.known) return { title: 'One date, and the rest follows', body: 'The window is counted back from your last period.' };
  const { daysToWindow, daysToOvulation, tier } = model;

  if (tier === 'peak') {
    return daysToOvulation === 2
      ? {
        title: 'Today and tomorrow are the two',
        body: 'Of the six days, these two carry the highest chance. After them the week is yours again.',
        urgent: true,
      }
      : {
        title: 'Today is the second of the two',
        body: 'The best of the six days ends tonight. Tomorrow you ovulate, and the window closes behind it.',
        urgent: true,
      };
  }
  if (tier === 'ovulation') {
    return {
      title: 'Ovulation, give or take a day',
      body: 'This is the last of the six. An egg keeps for about a day, which is why the window ends rather than tapering.',
      urgent: true,
    };
  }
  if (model.inWindow) {
    // The best days start two days before ovulation, not on it — counting down
    // to the wrong date is the one mistake this screen cannot afford.
    const toPeak = Math.max(1, daysToOvulation - 2);
    return {
      title: 'Your window is open',
      body: toPeak === 1
        ? 'One day until the two that matter most. Sperm can wait — starting now is not too early.'
        : `${toPeak} days until the two that matter most. Sperm can wait, so these early days count too.`,
      urgent: true,
    };
  }
  if (daysToWindow === 1) {
    return { title: 'Your window opens tomorrow', body: 'Six days, ending the day you ovulate. Tonight, nothing is required of you.' };
  }
  return {
    title: `Your window opens in ${daysToWindow} days`,
    body: 'Six days, ending the day you ovulate. Nothing to do until then — that is the point of knowing.',
  };
}

/**
 * A notification, at most twice a cycle.
 *
 * Only two moments are worth interrupting her for: the window opening, and the
 * two best days starting. Anything more frequent is a daily reminder that she
 * is not pregnant yet, which is the last thing a woman trying to conceive
 * needs from her phone.
 */
export function fertileAlert(model, today = todayIso()) {
  if (!model.known) return null;
  if (today === model.windowStart) {
    return {
      key: `fertile-open-${today}`,
      title: 'Your window opens today',
      body: 'Six days from here. Every day or two is plenty — nobody needs to keep score.',
    };
  }
  if (today === model.peakStart) {
    return {
      key: `fertile-peak-${today}`,
      title: 'Today and tomorrow are the two',
      body: 'The two days before ovulation carry the highest chance of the six.',
    };
  }
  return null;
}

/**
 * What actually helps, and what only sounds like it does.
 *
 * Every line here traces to a clinical guideline or a controlled study —
 * ASRM's "Optimizing natural fertility", NICE CG156, ACOG and WHO
 * preconception guidance. The two entries that say *don't bother* earn their
 * place: timing myths cost couples real months, and a woman who has been told
 * to lie still with her legs up for twenty minutes deserves to know that no
 * trial supports it.
 */
export const CONCEIVE_EVIDENCE = [
  {
    id: 'frequency',
    title: 'Every one to two days through the window',
    body: 'Couples who have sex every day or every other day during the fertile window conceive fastest. Saving up does not help — longer gaps lower the count that reaches the egg, and abstinence beyond about five days makes sperm quality worse, not better.',
    source: 'ASRM, Optimizing natural fertility',
  },
  {
    id: 'mucus',
    title: 'Your own signs beat the calendar',
    body: 'Cervical mucus that turns clear, slippery and stretchy — like raw egg white — is the most reliable free sign that the window is open now. Urine ovulation (LH) strips pick up the surge about a day or two before ovulation. Temperature only confirms ovulation after it has happened, so it teaches you your pattern but cannot time this cycle.',
    source: 'ASRM; NICE CG156',
  },
  {
    id: 'folate',
    title: 'Folic acid, starting before you conceive',
    body: '400 micrograms daily, from at least a month before conceiving through the first twelve weeks. It cuts the risk of neural tube defects like spina bifida, and it has to be on board before the neural tube closes — by week four, often before a pregnancy is confirmed. A higher dose is only on medical advice, such as a previous affected pregnancy, diabetes or epilepsy medicines.',
    source: 'WHO; CDC; ACOG',
  },
  {
    id: 'smoking',
    title: 'Smoking and alcohol, both partners',
    body: 'Smoking lowers fertility in women and damages sperm in men, and the effect on time-to-pregnancy is one of the largest that behaviour can change. Heavy drinking does the same. Keep caffeine under about 200 mg a day — roughly two cups of coffee.',
    source: 'ASRM; NICE CG156',
  },
  {
    id: 'weight',
    title: 'Weight, in both directions',
    body: 'A BMI well above or well below the healthy range delays conception, largely by disturbing ovulation. In PCOS, losing 5–10% of body weight can restore ovulation on its own. This is about ovulating regularly, not about a number on a scale.',
    source: 'ASRM; NICE CG156',
  },
  {
    id: 'lubricant',
    title: 'Check your lubricant',
    body: 'Most common lubricants slow sperm in the lab. If you use one, choose a fertility-friendly one; otherwise skip it during the fertile window.',
    source: 'ASRM',
  },
  {
    id: 'myths',
    title: 'Things you have permission to stop doing',
    body: 'No position works better than another, and lying still with your hips propped up has never been shown to help — sperm reach the cervix within minutes of arriving. Nor does any particular food, or timing by the moon. Dropping all of it frees you from treating conception as a performance with a technique to get right.',
    source: 'ASRM',
  },
  {
    id: 'time',
    title: 'It usually takes months, not weeks',
    body: 'Around 8 in 10 couples conceive within a year of trying, and most of the rest within the year after. A month where nothing happens is the ordinary experience of trying. It is not a result, and it is not a verdict on anybody.',
    source: 'NICE CG156',
  },
];

/**
 * When trying stops being a waiting game and becomes something to investigate.
 *
 * The thresholds are the ones every guideline agrees on, and they are age-split
 * because time matters more at 38 than at 28 — a woman who waits the full year
 * because an app said "give it a year" has lost the months that counted most.
 */
export function seekHelpAfter(age) {
  if (age != null && age >= 35) {
    return {
      months: 6,
      line: 'At 35 or over, ask after six months of trying rather than twelve — the same advice, moved earlier because time counts for more.',
    };
  }
  return {
    months: 12,
    line: 'Under 35, the usual advice is to seek help after twelve months of regular unprotected sex.',
  };
}

export const SEEK_HELP_SOONER = [
  'Periods that are irregular, absent, or further apart than about 35 days',
  'Known PCOS, endometriosis, thyroid disease or diabetes',
  'Previous pelvic surgery, infection, chemotherapy or radiotherapy',
  'Two or more miscarriages',
  'A known issue on your partner’s side — around half of all cases involve a male factor, so a semen analysis is part of the first set of tests, not a last resort',
];
