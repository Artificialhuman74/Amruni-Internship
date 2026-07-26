/**
 * The "where you were" a journal entry carries.
 *
 * Captured at the moment of writing and stored with the entry, never
 * recomputed on read. An entry written in week 22 has to still say week 22
 * when she opens it two years later — recomputing would quietly rewrite her
 * own record, which is the one thing a journal must not do.
 *
 * Nothing here is typed by her. It's what the app already knows, offered back
 * as the setting the writing happened in.
 */

const PHASE_LABEL = {
  menstrual: 'Period',
  follicular: 'Follicular phase',
  ovulation: 'Around ovulation',
  luteal: 'Luteal phase',
};

const TRIMESTER = ['First trimester', 'Second trimester', 'Third trimester'];

export function captureContext({ state, cycleData, pregnancyData, date }) {
  const ctx = { capturedFor: date };

  if (state.settings?.pregnancyMode && pregnancyData?.known) {
    ctx.kind = 'pregnancy';
    ctx.weeks = pregnancyData.weeks;
    ctx.trimester = pregnancyData.trimester;
    ctx.daysToGo = pregnancyData.daysToGo;
    const kicks = state.pregnancy?.kickCounts?.[date];
    if (kicks) ctx.kicks = kicks;
  } else if (cycleData?.cycleDay) {
    ctx.kind = 'cycle';
    ctx.cycleDay = cycleData.cycleDay;
    ctx.phase = cycleData.phase;
  }

  const day = state.cycle?.loggedDays?.[date];
  if (day?.symptoms?.length) ctx.symptoms = day.symptoms;
  if (day?.flow && day.flow !== 'none') ctx.flow = day.flow;

  return ctx;
}

/**
 * The context as short human lines. Returns [] when there's nothing true to
 * say — an empty section is better than a section padded with "no data".
 */
export function describeContext(ctx) {
  if (!ctx || !ctx.kind) return [];
  const lines = [];

  if (ctx.kind === 'pregnancy') {
    lines.push({
      label: 'Pregnancy',
      value: `Week ${ctx.weeks} · ${TRIMESTER[ctx.trimester - 1] ?? ''}`.trim(),
    });
    if (typeof ctx.daysToGo === 'number') {
      lines.push({ label: 'Due', value: `${ctx.daysToGo} days to go` });
    }
    if (ctx.kicks) {
      lines.push({ label: 'Movements', value: `${ctx.kicks} felt that day` });
    }
  } else if (ctx.kind === 'cycle') {
    lines.push({ label: 'Cycle', value: `Day ${ctx.cycleDay}` });
    if (ctx.phase && PHASE_LABEL[ctx.phase]) {
      lines.push({ label: 'Phase', value: PHASE_LABEL[ctx.phase] });
    }
  }

  if (ctx.flow) {
    lines.push({ label: 'Flow', value: ctx.flow[0].toUpperCase() + ctx.flow.slice(1) });
  }

  return lines;
}
