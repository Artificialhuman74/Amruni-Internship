import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useMood } from '../../context/MoodContext';
import { useToast } from '../ui/Toast';
import MoodSheet from './MoodSheet';
import MoodChart from './MoodChart';
import MoodFlower from './MoodFlower';
import { BANDS } from '../../lib/moodScale';
import { tap } from '../../lib/haptics';
import { IconTrend, IconChat } from '../../icons.jsx';

/**
 * Your moods — the log, in Track.
 *
 * The ribbon is thirty days wide, one column per day, newest on the right.
 * Height encodes valence and colour encodes it again, because a mood chart
 * read at a glance in poor light needs both. A day with several moments shows
 * them stacked behind the day's summary rather than averaged away: an hour of
 * dread inside a good day is true, and so is the good day.
 *
 * Below it sit the two things the log is actually for — the pattern it reveals
 * against her cycle, and the moment it should stop being a chart and offer
 * her something.
 */

const EXPO = [0.16, 1, 0.3, 1];
const DAYS = 30;

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function shortDay(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function MoodLogSection() {
  const { state } = useApp();
  const { logs, log, todaysDay, insights } = useMood();
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [sheet, setSheet] = useState(null);        // null | 'moment' | 'day'
  const [saving, setSaving] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const pregnancyMode = Boolean(state.settings?.pregnancyMode);

  // Thirty columns, oldest first, whether or not anything was logged — the
  // gaps are part of the picture.
  const days = useMemo(() => {
    const byDate = new Map();
    logs.forEach((m) => {
      if (!byDate.has(m.date)) byDate.set(m.date, []);
      byDate.get(m.date).push(m);
    });
    return Array.from({ length: DAYS }, (_, i) => {
      const date = isoDaysAgo(DAYS - 1 - i);
      const entries = byDate.get(date) ?? [];
      const day = entries.find((m) => m.scope === 'day') ?? null;
      const moments = entries.filter((m) => m.scope === 'moment');
      const lead = day ?? moments[0] ?? null;
      return { date, entries, day, moments, lead };
    });
  }, [logs]);

  const logged = days.filter((d) => d.entries.length > 0).length;

  async function handleSave({ valence, intensity, word, factors, scope }) {
    setSaving(true);
    try {
      await log({ valence, intensity, word, factors, scope, source: 'track' });
      toast(scope === 'day' ? 'Today is logged. Thank you.' : 'Logged. Thank you for sharing.', { icon: 'heart' });
      setSheet(null);
    } catch {
      toast('That didn’t save. Check your connection and try again.', { icon: 'warning' });
    } finally {
      setSaving(false);
    }
  }

  const correlation = insights?.cycleCorrelation;
  const needsSupport = insights?.needsSupport;

  return (
    <section className="ml">
      <div className="ml__head">
        <div>
          <p className="section-title" style={{ margin: 0 }}>Your moods</p>
          {logged > 0 && (
            <p className="ml__count">
              {logged} of the last {DAYS} days logged
            </p>
          )}
        </div>
        {logged > 0 && (
          <button type="button" className="ml__expand" onClick={() => { tap(); setChartOpen(true); }}>
            See chart
          </button>
        )}
      </div>

      {/* ── The offer to log ── */}
      <div className="ml__actions">
        <button type="button" className="ml__action" onClick={() => { tap(); setSheet('moment'); }}>
          <MoodFlower band={2} size={30} breathe={false} />
          <span>Right now</span>
        </button>
        <button
          type="button"
          className={`ml__action${todaysDay ? ' ml__action--done' : ''}`}
          onClick={() => { tap(); setSheet('day'); }}
        >
          <MoodFlower band={todaysDay ? todaysDay.valence : 0} size={30} breathe={false} />
          <span>{todaysDay ? 'Change today' : 'How was today'}</span>
        </button>
      </div>

      {/* ── The ribbon ── */}
      {logged === 0 ? (
        <p className="ml__empty">
          Log how you&rsquo;re feeling and the last thirty days will build up here — including
          how it moves with your cycle.
        </p>
      ) : (
        <button
          type="button"
          className="ml__ribbon"
          onClick={() => { tap(); setChartOpen(true); }}
          aria-label={`Mood over the last ${DAYS} days — open the full chart`}
        >
          {days.map((d, i) => {
            const b = d.lead ? BANDS[String(d.lead.valence)] : null;
            // −3..3 mapped onto 18–100% of the track's height.
            const height = d.lead ? 18 + ((d.lead.valence + 3) / 6) * 82 : 0;
            return (
              <span
                key={d.date}
                className={`ml__col${d.entries.length ? '' : ' ml__col--empty'}`}
                aria-hidden="true"
              >
                <span className="ml__col-track">
                  {d.lead && (
                    <motion.span
                      className="ml__col-bar"
                      style={{ background: b.core }}
                      initial={reduce ? false : { height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : Math.min(i * 0.012, 0.35), ease: EXPO }}
                    />
                  )}
                  {/* Extra moments on this day sit as ticks on the column. */}
                  {d.moments.slice(0, 3).map((m, mi) => (
                    <span
                      key={m.id}
                      className="ml__col-tick"
                      style={{
                        background: BANDS[String(m.valence)].edge,
                        bottom: `${18 + ((m.valence + 3) / 6) * 82}%`,
                        opacity: 0.9 - mi * 0.2,
                      }}
                    />
                  ))}
                </span>
              </span>
            );
          })}
        </button>
      )}

      {logged > 0 && (
        <div className="ml__scale" aria-hidden="true">
          <span>{shortDay(days[0].date)}</span>
          <span>Today</span>
        </div>
      )}

      {/* ── What the log says about her cycle ── */}
      {correlation && (
        <motion.div
          className="ml__insight"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EXPO }}
        >
          <span className="ml__insight-mark" aria-hidden="true"><IconTrend size={18} /></span>
          <div>
            <p className="ml__insight-text">
              {correlation.prePeriod?.text ?? correlation.text}
            </p>
            <p className="ml__insight-meta">
              From your own logs across {insights.daysLogged} days.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── The moment a chart should stop being a chart ── */}
      {needsSupport && (
        <motion.button
          type="button"
          className="ml__support"
          onClick={() => { tap(); navigate('/help'); }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: EXPO }}
        >
          <span className="ml__support-mark" aria-hidden="true"><IconChat size={22} /></span>
          <span className="ml__support-body">
            <span className="ml__support-title">
              That&rsquo;s {insights.lowStreak} hard days in a row.
            </span>
            <span className="ml__support-text">
              You don&rsquo;t have to sit with it alone — talking to someone is here whenever
              you want it.
            </span>
          </span>
          <span className="ml__support-go" aria-hidden="true">→</span>
        </motion.button>
      )}

      <MoodChart open={chartOpen} onClose={() => setChartOpen(false)} logs={logs} />

      <MoodSheet
        open={sheet !== null}
        scope={sheet ?? 'moment'}
        pregnancyMode={pregnancyMode}
        saving={saving}
        initial={sheet === 'day' && todaysDay ? todaysDay : null}
        onClose={() => !saving && setSheet(null)}
        onSave={handleSave}
      />

    </section>
  );
}
