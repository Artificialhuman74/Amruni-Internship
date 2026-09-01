import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { journalApi } from '../services/journalApi';
import { communityApi } from '../services/communityApi';
import { apiError } from '../services/api';
import { useToast } from '../components/ui/Toast';
import { useIdentityWarning } from '../lib/useIdentityWarning';
import IdentityWarningSheet from '../components/ui/IdentityWarningSheet';
import BottomSheet from '../components/ui/BottomSheet';
import MoodFlower from '../components/mood/MoodFlower';
import { BANDS } from '../lib/moodScale';
import { describeContext } from '../lib/journalContext';
import { weatherLine, devSky } from '../lib/weather';
import WeatherScene from '../components/mood/WeatherScene';
import { tap, warn, confirm as confirmHaptic } from '../lib/haptics';
import { IconClose, IconCheck } from '../icons.jsx';

/**
 * Reading an entry back.
 *
 * Sectioned, because an entry is several different kinds of record and they
 * shouldn't be flattened into one block of text: the feeling she named, the
 * writing itself, what was pressing on her, and where she was in her body at
 * the time. Only the writing is hers to have typed — the rest the app already
 * knew and gives back as the setting it happened in.
 *
 * The page takes its whole colour from the mood attached to it, so opening an
 * old entry feels the way that day felt before a word is read.
 */

const EXPO = [0.16, 1, 0.3, 1];

function formatDate(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function JournalEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { open: warningOpen, guardToggleOff, confirm: confirmWarning, cancel: cancelWarning } = useIdentityWarning();

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tagLabels, setTagLabels] = useState({});
  const [shareOpen, setShareOpen] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    journalApi.list()
      .then((all) => {
        if (cancelled) return;
        setEntry((all ?? []).find((e) => e.id === id) ?? null);
      })
      .catch((err) => {
        if (!cancelled) toast(apiError(err, 'Could not open this entry.'), { icon: 'warning' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, toast]);

  useEffect(() => {
    let cancelled = false;
    communityApi.getTags()
      .then((tags) => {
        if (cancelled) return;
        const map = {};
        (tags ?? []).forEach((t) => { map[t.id] = t.label; });
        setTagLabels(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const scrollRef = useRef(null);
  // Drives the handover from sky to page. The hero and the sky are read off
  // the same scroll position, so the sky receding and the mood colour arriving
  // are one movement rather than two effects that happen to overlap.
  const { scrollYProgress } = useScroll({ container: scrollRef, offset: ['start start', '62vh start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const heroLift = useTransform(scrollYProgress, [0, 1], [0, -46]);
  const skyDim = useTransform(scrollYProgress, [0, 1], [1, 0.35]);
  const skyScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const band = entry?.mood ? BANDS[String(entry.mood.valence)] : null;
  const contextLines = useMemo(() => describeContext(entry?.context), [entry]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    setShareError('');
    try {
      const post = await journalApi.share(entry.id, { isAnonymous });
      setEntry((e) => ({ ...e, sharedAsPostId: post.id }));
      confirmHaptic();
      toast('Shared to community', { icon: 'heart' });
      setShareOpen(false);
      navigate(`/community/${post.id}`);
    } catch (err) {
      setShareError(apiError(err, 'Could not share this entry. Please try again.'));
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete() {
    if (!deleteArmed) { setDeleteArmed(true); return; }
    setBusy(true);
    try {
      await journalApi.remove(entry.id);
      warn();
      toast('Entry deleted', { icon: 'trash' });
      navigate('/journal', { replace: true });
    } catch (err) {
      toast(apiError(err, 'Could not delete this entry.'), { icon: 'warning' });
      setDeleteArmed(false);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFlag() {
    tap();
    const next = !entry.bringToAppointment;
    setEntry((e) => ({ ...e, bringToAppointment: next }));
    try {
      await journalApi.update(entry.id, {
        date: entry.date, text: entry.text, tags: entry.tags ?? [],
        moodLogId: entry.moodLogId ?? null, context: entry.context ?? {},
        bringToAppointment: next,
      });
    } catch {
      setEntry((e) => ({ ...e, bringToAppointment: !next }));
      toast('Could not update that. Try again.', { icon: 'warning' });
    }
  }

  if (loading) {
    return (
      <div className="je" aria-busy="true">
        <div className="je__skeleton" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="je">
        <header className="je__bar">
          <button type="button" className="je__circle" onClick={() => navigate('/journal')} aria-label="Back to your journal">
            <IconClose size={17} strokeWidth={2} />
          </button>
        </header>
        <div className="je__missing">
          <p className="je__missing-title">This entry isn&rsquo;t here anymore</p>
          <p className="je__missing-body">It may have been deleted from another device.</p>
          <button className="btn btn--primary" onClick={() => navigate('/journal')}>Back to your journal</button>
        </div>
      </div>
    );
  }

  // `?sky=wet-day` in dev forces the treatment onto any entry, so a sky can be
  // reviewed without one having been captured.
  const sky = entry.context?.weather ?? devSky();
  const hasSky = Boolean(sky);

  return (
    <div className={`je${hasSky ? ' je--sky' : ''}`} style={band ? { color: band.ink } : undefined}>
      {/* The field. Mixed from the mood the entry carries, so the day's colour
          is the first thing back — before a word of it is read. */}
      <div
        className="je__field"
        aria-hidden="true"
        style={{
          background: band
            ? `linear-gradient(178deg, ${band.wash2} 0%, ${band.wash} 58%, ${band.wash} 100%)`
            : 'var(--clr-bg)',
        }}
      />

      <header className="je__bar">
        <button type="button" className="je__circle" onClick={() => { tap(); navigate('/journal'); }} aria-label="Back to your journal">
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="je__bar-date">{formatDate(entry.date)}</span>
        <button
          type="button"
          className="je__circle"
          onClick={() => { tap(); navigate(`/journal/${entry.id}/edit`, { state: { entry } }); }}
          aria-label="Edit this entry"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
      </header>

      {hasSky && (
        <motion.div
          className="je__scene"
          style={reduce ? undefined : { opacity: skyDim, scale: skyScale }}
        >
          <WeatherScene weather={sky} />
        </motion.div>
      )}

      <motion.article
        ref={scrollRef}
        className="je__scroll"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.2 : 0.44, ease: EXPO }}
      >
        {/* ── The hero ──
            Composed the way a weather screen is: place, then the one big
            number, then the condition. Here the "number" is the feeling —
            the sky is the room she was in, and the mood is what happened in
            it. The bloom drops back to an accent so the word can be the
            subject; two heroes would be neither. */}
        {/* The stage: one screen of sky with the subject standing in the
            middle of it. It runs whether or not a mood was logged — an entry
            written under a sky is still an entry written under that sky, and
            dropping to a plain page when the feeling is missing would make the
            absence of a mood feel like a fault. Without one, the sky itself
            takes the big slot, which is the Weather composition exactly. */}
        {(entry.mood || hasSky) && (
          <motion.section
            className={`je__hero${hasSky ? ' je__hero--sky' : ''}`}
            style={reduce ? undefined : { opacity: heroOpacity, y: heroLift }}
          >
            <p className="je__hero-when">
              {entry.mood
                ? (entry.mood.scope === 'day' ? 'How the day felt' : formatTime(entry.mood.loggedAt))
                : formatDate(entry.date)}
            </p>

            <h2 className="je__hero-word">
              {entry.mood
                ? (entry.mood.word || band.label)
                : (sky?.tempC != null ? `${sky.tempC}°` : sky?.label)}
            </h2>

            <p className="je__hero-sub">
              {entry.mood ? band.label : sky?.label}
            </p>

            {hasSky && entry.mood && (
              <p className="je__hero-weather">{weatherLine(sky)}</p>
            )}

            {/* The bloom carries its own light so it reads as an object in the
                sky rather than a sticker on a photograph. */}
            {entry.mood && (
              <span className="je__hero-bloom" aria-hidden="true">
                <MoodFlower band={entry.mood.valence} size={132} breathe={false} />
              </span>
            )}
          </motion.section>
        )}

        {/* Everything she wrote rides up over the sky on one sheet, carrying
            the colour of the mood she chose. The sheet's own top edge fades in
            from nothing, so the sky doesn't stop at a line — it becomes the
            page. */}
        <div
          className={`je__sheet${hasSky ? ' je__sheet--overSky' : ''}`}
          style={band ? { '--sheet-wash': band.wash, '--sheet-wash2': band.wash2 } : undefined}
        >
          {!entry.mood && hasSky && (
            <p className="je__weather-only">{weatherLine(sky)}</p>
          )}

          {/* The question she was answering, if she took one. */}
          {entry.context?.prompt && (
            <p className="je__prompt">{entry.context.prompt}</p>
          )}

        {/* ── The writing ── */}
        <section className="je__prose">
          {entry.text.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>

        {/* ── What was behind it ── */}
        {entry.mood?.factors?.length > 0 && (
          <section className="je__section">
            <h2 className="je__section-title">What was behind it</h2>
            <div className="je__chips">
              {entry.mood.factors.map((f) => (
                <span key={f} className="je__chip">{f}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── Where you were ── the part she never typed */}
        {(contextLines.length > 0 || entry.context?.symptoms?.length > 0) && (
          <section className="je__section">
            <h2 className="je__section-title">Where you were</h2>
            <dl className="je__facts">
              {contextLines.map((line) => (
                <div key={line.label} className="je__fact">
                  <dt>{line.label}</dt>
                  <dd>{line.value}</dd>
                </div>
              ))}
            </dl>
            {entry.context?.symptoms?.length > 0 && (
              <div className="je__chips je__chips--quiet">
                {entry.context.symptoms.map((s) => (
                  <span key={s} className="je__chip">{s}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Tags ── */}
        {entry.tags?.length > 0 && (
          <section className="je__section">
            <h2 className="je__section-title">Tags</h2>
            <div className="je__chips">
              {entry.tags.map((t) => (
                <span key={t} className="je__chip">{tagLabels[t] ?? t}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── What happens next with it ── */}
        <section className="je__actions">
          <button
            type="button"
            className={`je__flag${entry.bringToAppointment ? ' je__flag--on' : ''}`}
            aria-pressed={entry.bringToAppointment}
            onClick={toggleFlag}
          >
            <span className="je__flag-box" aria-hidden="true">
              {entry.bringToAppointment && <IconCheck size={13} />}
            </span>
            <span className="je__flag-text">
              {entry.bringToAppointment
                ? 'Your doctor will see this at your next appointment'
                : 'Bring this to my next appointment'}
            </span>
          </button>

          {entry.sharedAsPostId ? (
            <button type="button" className="je__ghost" onClick={() => navigate(`/community/${entry.sharedAsPostId}`)}>
              View your shared post
            </button>
          ) : (
            <button type="button" className="je__ghost" onClick={() => { tap(); setIsAnonymous(true); setShareError(''); setShareOpen(true); }}>
              Share to community
            </button>
          )}

          <button
            type="button"
            className="je__delete"
            onClick={handleDelete}
            disabled={busy}
            aria-label={deleteArmed ? 'Tap again to permanently delete this entry' : 'Delete this entry'}
          >
            {deleteArmed ? 'Tap again to delete' : 'Delete entry'}
          </button>
        </section>
        </div>
      </motion.article>

      <BottomSheet open={shareOpen} onClose={() => !sharing && setShareOpen(false)} title="Share to community">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
            This publishes a copy to the community feed. Your entry stays exactly as it is, and your mood and health details are never included.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>Post anonymously</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
                {isAnonymous ? 'Your name will be hidden' : 'Your name will be shown'}
              </p>
            </div>
            <button
              className={`toggle${isAnonymous ? ' toggle--on' : ''}`}
              onClick={() => (isAnonymous ? guardToggleOff(() => setIsAnonymous(false)) : (setIsAnonymous(true), tap()))}
              aria-pressed={isAnonymous}
              aria-label="Toggle posting anonymously"
            >
              <div className="toggle__knob" />
            </button>
          </div>
          {shareError && <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-emergency)' }}>{shareError}</p>}
          <button className="btn btn--primary" onClick={handleShare} disabled={sharing}>
            {sharing ? 'Sharing…' : 'Share to community'}
          </button>
        </div>
      </BottomSheet>

      <IdentityWarningSheet open={warningOpen} onConfirm={confirmWarning} onCancel={cancelWarning} />
    </div>
  );
}
