import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApp, useCycleData, usePregnancyData } from '../context/AppContext';
import { useMood, todayISO } from '../context/MoodContext';
import { journalApi } from '../services/journalApi';
import { communityApi } from '../services/communityApi';
import { apiError } from '../services/api';
import { useToast } from '../components/ui/Toast';
import MoodSheet from '../components/mood/MoodSheet';
import MoodFlower from '../components/mood/MoodFlower';
import { BANDS } from '../lib/moodScale';
import { captureContext } from '../lib/journalContext';
import { promptsFor } from '../lib/journalPrompts';
import { captureWeather, weatherForEntry, weatherLine, weatherError } from '../lib/weather';
import { tap, confirm as confirmHaptic } from '../lib/haptics';
import { IconClose, IconCheck } from '../icons.jsx';

/**
 * Writing an entry. Two steps, on their own screen.
 *
 * Step one is the page and nothing else: no tab bar, no emergency button, no
 * card holding the text at arm's length. Everything that could ask for
 * attention is gone, because the whole job of this screen is to stop asking
 * for it. It's the only surface in the app that renders outside the shell for
 * a reason other than a video call.
 *
 * Step two attaches how she felt — the day's mood if she already gave one,
 * and a moment captured right there if she wants to. Both travel with the
 * entry, along with the cycle or pregnancy context the app captured silently.
 */

const EXPO = [0.16, 1, 0.3, 1];
const DRAFT_KEY = 'amruni_journal_draft';

/** An unsaved draft from a session the browser reclaimed. */
function readDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;   // a draft that won't parse is a draft we don't have
  }
}

export default function JournalComposer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const toast = useToast();
  const reduce = useReducedMotion();

  const { state } = useApp();
  const cycleData = useCycleData(state);
  const pregnancyData = usePregnancyData(state);
  const { log, todaysDay, todaysMoments, insights } = useMood();

  const editing = Boolean(id);
  const passed = location.state?.entry ?? null;

  const [step, setStep] = useState(0);          // 0 write · 1 feeling
  // The prompt is held beside the writing, never inside it. Putting it into
  // the textarea made choosing one irreversible — she'd have to delete the
  // app's words out of her own entry to change her mind.
  const [prompt, setPrompt] = useState(() => passed?.context?.prompt ?? null);
  const [promptPage, setPromptPage] = useState(0);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [weather, setWeather] = useState(() => passed?.context?.weather ?? null);
  const [weatherState, setWeatherState] = useState('idle');  // idle | asking | on | off
  // Restored during initialisation rather than in an effect, so the draft is
  // already on screen in the first frame — she should never watch her own
  // writing appear.
  const [text, setText] = useState(() => passed?.text ?? (id ? '' : readDraft()?.text ?? ''));
  const [date] = useState(passed?.date ?? todayISO());
  const [tags, setTags] = useState(() => passed?.tags ?? (id ? [] : readDraft()?.tags ?? []));
  const [allTags, setAllTags] = useState([]);
  const [bringToAppointment, setBringToAppointment] = useState(passed?.bringToAppointment ?? false);
  const [attachedMood, setAttachedMood] = useState(passed?.mood ?? null);
  const [moodSheet, setMoodSheet] = useState(false);
  const [savingMood, setSavingMood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(editing && !passed);

  const areaRef = useRef(null);

  const context = useMemo(
    () => captureContext({ state, cycleData, pregnancyData, date }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date],
  );

  const prompts = useMemo(
    () => promptsFor({
      todaysMoments, todaysDay, context, insights,
      lifeStage: state.user?.lifeStage,
    }),
    [todaysMoments, todaysDay, context, insights, state.user?.lifeStage],
  );

  // A window of three, paged rather than reshuffled, so "back" is possible.
  const PAGE = 3;
  const pageCount = Math.max(1, Math.ceil(prompts.length / PAGE));
  const shown = prompts.slice(promptPage * PAGE, promptPage * PAGE + PAGE);

  function choose(p) {
    tap();
    setPrompt(p);
    setPromptsOpen(false);
    areaRef.current?.focus();
  }

  // Every entry gets its sky by default. `weatherForEntry` falls back to the
  // last recent reading, so a slow fix or a dead moment of network doesn't
  // cost her the weather — which is what "remember it every time" has to mean
  // on the connections this runs on.
  //
  // The trade: the location prompt now appears the first time she writes,
  // rather than only if she asks for it. It is asked once — after she answers
  // either way, nothing prompts again.
  useEffect(() => {
    if (editing || weather) return undefined;
    let cancelled = false;
    weatherForEntry().then((w) => { if (!cancelled && w) setWeather(w); });
    return () => { cancelled = true; };
  }, [editing, weather]);

  // Kept current as she writes, so closing the tab mid-thought loses nothing.
  useEffect(() => {
    if (editing) return;
    try {
      if (text.trim()) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ text, tags }));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* private mode */ }
  }, [text, tags, editing]);

  useEffect(() => {
    if (!editing || passed) return undefined;
    let cancelled = false;
    journalApi.list()
      .then((all) => {
        if (cancelled) return;
        const found = (all ?? []).find((e) => e.id === id);
        if (found) {
          setText(found.text);
          setTags(found.tags ?? []);
          setAttachedMood(found.mood ?? null);
          setBringToAppointment(found.bringToAppointment ?? false);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [editing, id, passed]);

  useEffect(() => {
    let cancelled = false;
    communityApi.getTags()
      .then((d) => { if (!cancelled) setAllTags(d ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (step === 0 && !loading) areaRef.current?.focus();
  }, [step, loading]);

  // The field grows with the writing so the page stays one continuous sheet
  // rather than a small box with its own scrollbar inside a big empty screen.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, step]);

  function leave() {
    tap();
    navigate('/journal');
  }

  async function handleMoodSave({ valence, intensity, word, factors }) {
    setSavingMood(true);
    try {
      const created = await log({
        valence, intensity, word, factors, scope: 'moment', source: 'journal', date,
      });
      setAttachedMood(created);
      setMoodSheet(false);
    } catch {
      toast('That mood didn’t save. Your writing is safe.', { icon: 'warning' });
    } finally {
      setSavingMood(false);
    }
  }

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        date,
        text: text.trim(),
        tags,
        moodLogId: attachedMood?.id ?? null,
        context: { ...context, ...(prompt ? { prompt } : {}), ...(weather ? { weather } : {}) },
        bringToAppointment,
      };
      const saved = editing
        ? await journalApi.update(id, payload)
        : await journalApi.create(payload);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      confirmHaptic();
      toast(editing ? 'Entry updated' : 'Entry saved', { icon: 'heart' });
      navigate(`/journal/${saved.id}`, { replace: true });
    } catch (err) {
      setError(apiError(err, 'Could not save this entry. Your writing is still here — try again.'));
    } finally {
      setSaving(false);
    }
  }

  const dayMood = todaysDay && date === todayISO() ? todaysDay : null;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="jc">
      <header className="jc__bar">
        <button type="button" className="jc__circle" onClick={step === 1 ? () => setStep(0) : leave}
          aria-label={step === 1 ? 'Back to your writing' : 'Close without saving'}>
          {step === 1
            ? <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            : <IconClose size={17} strokeWidth={2} />}
        </button>

        <span className="jc__date">
          {new Date(`${date}T00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>

        <span className="jc__circle jc__circle--ghost" aria-hidden="true" />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {step === 0 ? (
          <motion.div
            key="write"
            className="jc__body"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: reduce ? 0.15 : 0.3, ease: EXPO }}
          >
            {/* A chosen prompt sits above the writing as a heading she is
                answering — not as text inside her entry. It can be swapped or
                dropped at any point, including after she has written half a
                page, and it never has to be deleted out of her own words. */}
            {prompt && (
              <div className="jc__chosen">
                <p className="jc__chosen-text">{prompt}</p>
                <div className="jc__chosen-actions">
                  <button type="button" className="jc__chosen-btn" onClick={() => { tap(); setPromptsOpen(true); }}>
                    Change
                  </button>
                  <button type="button" className="jc__chosen-btn" onClick={() => { tap(); setPrompt(null); }}>
                    Remove
                  </button>
                </div>
              </div>
            )}

            <textarea
              ref={areaRef}
              className="jc__text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={prompt ? 'Answer in your own words.' : 'Start anywhere.'}
              aria-label={prompt || 'Your journal entry'}
              spellCheck
            />

            {/* Offered while the page is blank, and reachable forever after
                from the bar at the foot — a suggestion she can't get back to
                is a suggestion that made the decision for her. */}
            {(promptsOpen || (!prompt && !text.trim())) && (
              <div className="jc__prompts">
                <div className="jc__prompts-head">
                  <p className="jc__prompts-label">If you&rsquo;d like somewhere to start</p>
                  {promptsOpen && (
                    <button type="button" className="jc__chosen-btn" onClick={() => { tap(); setPromptsOpen(false); }}>
                      Close
                    </button>
                  )}
                </div>

                {shown.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`jc__prompt${prompt === p ? ' jc__prompt--on' : ''}`}
                    aria-pressed={prompt === p}
                    onClick={() => choose(p)}
                  >
                    {p}
                  </button>
                ))}

                {pageCount > 1 && (
                  <div className="jc__prompts-nav">
                    <button
                      type="button"
                      className="jc__chosen-btn"
                      onClick={() => { tap(); setPromptPage((n) => (n - 1 + pageCount) % pageCount); }}
                    >
                      Back
                    </button>
                    <span className="jc__prompts-count">{promptPage + 1} / {pageCount}</span>
                    <button
                      type="button"
                      className="jc__chosen-btn"
                      onClick={() => { tap(); setPromptPage((n) => (n + 1) % pageCount); }}
                    >
                      More ideas
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Once she is writing, the way back to the prompts stays here. */}
            {!promptsOpen && !prompt && text.trim() && (
              <button type="button" className="jc__reopen" onClick={() => { tap(); setPromptsOpen(true); }}>
                Need a prompt?
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="feel"
            className="jc__body jc__body--feel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: reduce ? 0.15 : 0.3, ease: EXPO }}
          >
            <h2 className="jc__heading">How were you feeling?</h2>
            <p className="jc__sub">This stays with the entry, so it means something when you read it back.</p>

            {dayMood && (
              <div className="jc__daymood">
                <MoodFlower band={dayMood.valence} size={54} breathe={false} />
                <div>
                  <p className="jc__daymood-label">Today, overall</p>
                  <p className="jc__daymood-word">{dayMood.word || BANDS[String(dayMood.valence)].label}</p>
                </div>
              </div>
            )}

            {attachedMood ? (
              <div className="jc__attached">
                <MoodFlower band={attachedMood.valence} size={72} breathe={false} />
                <p className="jc__attached-word">
                  {attachedMood.word || BANDS[String(attachedMood.valence)].label}
                </p>
                {attachedMood.factors?.length > 0 && (
                  <p className="jc__attached-factors">{attachedMood.factors.join(' · ')}</p>
                )}
                <button type="button" className="jc__link" onClick={() => { tap(); setMoodSheet(true); }}>
                  Change how you felt
                </button>
              </div>
            ) : (
              <button type="button" className="jc__attach" onClick={() => { tap(); setMoodSheet(true); }}>
                <MoodFlower band={1} size={44} breathe={false} />
                <span>
                  <span className="jc__attach-title">Add how you feel right now</span>
                  <span className="jc__attach-hint">Optional</span>
                </span>
              </button>
            )}

            {/* Weather. Offered, never assumed — and only ever as a line, since
                it is the room the entry was written in and not its subject. */}
            {weather ? (
              <p className="jc__weather">{weatherLine(weather)} — kept with this entry</p>
            ) : weatherState !== 'off' && (
              <button
                type="button"
                className="jc__weather-add"
                disabled={weatherState === 'asking'}
                onClick={async () => {
                  tap();
                  setWeatherState('asking');
                  const w = await captureWeather();
                  if (w && !w.error) { setWeather(w); setWeatherState('on'); }
                  else {
                    setWeatherState('off');
                    toast(weatherError(w), { icon: 'warning' });
                  }
                }}
              >
                {weatherState === 'asking' ? 'Checking the sky…' : 'Try adding today’s weather'}
              </button>
            )}

            {allTags.length > 0 && (
              <div className="jc__tags">
                <p className="jc__tags-label">Tags</p>
                <div className="jc__tag-row">
                  {allTags.map((t) => {
                    const on = tags.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`chip${on ? ' chip--active' : ''}`}
                        aria-pressed={on}
                        onClick={() => {
                          tap();
                          setTags((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]));
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              className={`jc__flag${bringToAppointment ? ' jc__flag--on' : ''}`}
              aria-pressed={bringToAppointment}
              onClick={() => { tap(); setBringToAppointment((v) => !v); }}
            >
              <span className="jc__flag-box" aria-hidden="true">
                {bringToAppointment && <IconCheck size={13} />}
              </span>
              <span>
                <span className="jc__flag-title">Bring this to my next appointment</span>
                <span className="jc__flag-hint">Your doctor sees it only when you flag it.</span>
              </span>
            </button>

            {error && <p role="alert" className="jc__error">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="jc__foot">
        {step === 0 && words > 0 && (
          <span className="jc__count">{words} word{words === 1 ? '' : 's'}</span>
        )}
        <button
          type="button"
          className="jc__cta"
          disabled={!text.trim() || saving}
          onClick={() => (step === 0 ? (tap(), setStep(1)) : save())}
        >
          {step === 0 ? 'Next' : saving ? 'Saving…' : editing ? 'Save changes' : 'Save entry'}
        </button>
      </footer>

      <MoodSheet
        open={moodSheet}
        scope="moment"
        pregnancyMode={Boolean(state.settings?.pregnancyMode)}
        saving={savingMood}
        onClose={() => !savingMood && setMoodSheet(false)}
        onSave={handleMoodSave}
      />
    </div>
  );
}
