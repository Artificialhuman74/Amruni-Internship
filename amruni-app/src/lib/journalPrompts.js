/**
 * What a blank page offers when she opens it with nothing to say.
 *
 * Prompts are seeded from what the app already knows — a feeling she named
 * this morning, the phase she's in, the week she's at, a stretch of hard days.
 * A generic "What's on your mind?" is the blank page again with a question
 * mark on it; a prompt that picks up what she already told us is an invitation
 * to continue.
 *
 * Returned in tiers so the caller can offer a few at a time and rotate through
 * the rest — the first suggestion should be the sharpest, but it must never be
 * the only one, and choosing one must never be final.
 */

const GENERAL = [
  'What has taken up the most room in your head today?',
  'What would you want to remember about today in a year?',
  'Is there something you have been putting off saying?',
  'What has been kind to you lately?',
  'What are you tired of explaining to people?',
  'What went better than you expected?',
  'What do you need that you have not asked for?',
  'Who has been on your mind?',
];

const PHASE = {
  menstrual: [
    'What does your body need from you today?',
    'What did you push through this week that you did not have to?',
  ],
  follicular: [
    'What are you starting to have energy for again?',
    'What would you do with a good week?',
  ],
  ovulation: [
    'What do you feel most yourself doing?',
    'What are you looking forward to?',
  ],
  luteal: [
    'What has felt harder than usual this week?',
    'What are you being harder on yourself about than you would be with a friend?',
  ],
};

const PREGNANCY = [
  'What do you want to tell your baby about right now?',
  'What has changed in your body this week that nobody warned you about?',
  'What are you afraid to say out loud about becoming a mother?',
  'What has surprised you about how people are treating you?',
];

const POSTPARTUM = [
  'What is nobody asking you about?',
  'What did today take out of you?',
  'What would you tell yourself from a month ago?',
];

const MENOPAUSE = [
  'What has your body been doing that you have not talked to anyone about?',
  'What do you want this next stage to look like?',
];

function hoursAgo(iso) {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? Infinity : (Date.now() - then) / 3600000;
}

const STAGE = { postpartum: POSTPARTUM, menopause: MENOPAUSE };

/**
 * Ordered most-specific first, de-duplicated. The caller shows a window of
 * three and can page through the rest.
 */
export function promptsFor({
  todaysMoments = [],
  todaysDay = null,
  context = {},
  insights = null,
  lifeStage = null,
  recentText = [],
} = {}) {
  const out = [];

  // A feeling she named a few hours ago, still close enough to pick back up.
  const recent = todaysMoments.find((m) => m.word && hoursAgo(m.loggedAt) < 10);
  if (recent) {
    out.push(`You logged “${recent.word}” earlier. What was underneath it?`);
    if (recent.factors?.length) {
      out.push(`You said ${recent.factors[0].toLowerCase()} was weighing on you. How is that sitting now?`);
    }
  }
  if (todaysDay?.word) {
    out.push(`Today came out as “${todaysDay.word}”. What made it that?`);
  }

  // A run of hard days is when writing helps most and when she is least likely
  // to find her own way in.
  if (insights?.lowStreak >= 3) {
    out.push('It has been a heavy few days. What would you want someone to understand about it?');
  }
  // A pattern she may not have noticed herself is worth handing back as a question.
  if (insights?.cycleCorrelation?.prePeriod) {
    out.push('Your mood tends to dip around now in your cycle. Does today feel like that, or like something else?');
  }

  if (context.kind === 'pregnancy') {
    out.push(`Week ${context.weeks}. ${PREGNANCY[0]}`);
    out.push(...PREGNANCY.slice(1));
  } else if (context.kind === 'cycle' && PHASE[context.phase]) {
    out.push(...PHASE[context.phase]);
  }

  if (STAGE[lifeStage]) out.push(...STAGE[lifeStage]);

  if (context.symptoms?.length) {
    out.push('You logged some symptoms today. How did they actually affect your day?');
  }

  // Something she has written about before, offered as a thread to pick up.
  if (recentText.length) {
    out.push('Last time you wrote, something was unresolved. Where did it land?');
  }

  return [...new Set([...out, ...GENERAL])];
}
