/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { moodApi } from '../../services/api/moodApi'
import { useApp } from './AppContext'

/**
 * Mood factors that are also cycle symptoms. Choosing "Pain" in the check-in
 * and then logging "Cramps" again in the tracker is the same fact entered
 * twice; when they overlap, the day's cycle log is filled in for her.
 * Deliberately conservative — only mappings that mean the same thing.
 */
const FACTOR_TO_SYMPTOM = {
  Pain: 'cramps',
  Sleep: 'insomnia',
  Energy: 'fatigue',
  Nausea: 'nausea',
  Appetite: 'cravings',
  Hormones: 'mood_swings',
};

/**
 * The mood stream, shared.
 *
 * Home, Track and the journal all read the same logs and all write to them, so
 * they hold one copy between them rather than three that drift. Logging from
 * the journal is why this is a context and not a per-screen fetch: the entry
 * she just wrote has to show up in Track's ribbon without a reload.
 */

const MoodContext = createContext(null);

/** Local calendar day — not UTC. A 1am log belongs to the night she had. */
export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function localISOStamp(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

export function MoodProvider({ children }) {
  const { state, dispatch } = useApp();
  const signedIn = state.auth.isAuthenticated;

  // Read through a ref so `log` doesn't have to depend on the whole app state
  // and be rebuilt on every keystroke elsewhere in the tree.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const [logs, setLogs] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const [list, ins] = await Promise.all([
        moodApi.list(),
        moodApi.insights().catch(() => null),
      ]);
      setLogs(list ?? []);
      setInsights(ins);
    } catch {
      // Offline is a normal state here, not an error worth interrupting for —
      // the ribbon simply shows what it already had.
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  // The initial load resolves inside the promise rather than calling `refresh`
  // straight from the effect body, so state only ever lands once the request
  // has — and a sign-out mid-flight can't repopulate the stream behind it.
  useEffect(() => {
    if (!signedIn) return undefined;
    let cancelled = false;
    Promise.all([moodApi.list(), moodApi.insights().catch(() => null)])
      .then(([list, ins]) => {
        if (cancelled) return;
        setLogs(list ?? []);
        setInsights(ins);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [signedIn]);

  /** Writes a log and folds it into local state without waiting for a refetch. */
  const log = useCallback(async ({ valence, word, factors, scope, source, journalId, date }) => {
    const created = await moodApi.create({
      date: date ?? todayISO(),
      loggedAt: localISOStamp(),
      scope, valence, word, factors, source, journalId,
    });
    setLogs((prev) => {
      // A day-scope log replaces the day's existing summary, matching the server.
      const kept = scope === 'day'
        ? prev.filter((m) => !(m.scope === 'day' && m.date === created.date))
        : prev;
      return [created, ...kept];
    });
    // Anything she named that the cycle tracker also tracks is written into
    // that day's log, so she never enters the same fact twice. Additive only —
    // this can fill a gap, never remove something she chose herself.
    const mapped = (factors ?? [])
      .map((f) => FACTOR_TO_SYMPTOM[f])
      .filter(Boolean);
    if (mapped.length) {
      const day = created.date;
      const existing = stateRef.current.cycle?.loggedDays?.[day] ?? {};
      const merged = [...new Set([...(existing.symptoms ?? []), ...mapped])];
      if (merged.length !== (existing.symptoms ?? []).length) {
        dispatch({
          type: 'LOG_CYCLE_DAY',
          date: day,
          data: { flow: existing.flow ?? 'none', symptoms: merged },
        });
      }
    }

    // The derived signals depend on the whole history, so they're re-asked for
    // rather than guessed at locally.
    moodApi.insights().then(setInsights).catch(() => {});
    return created;
  }, [dispatch]);

  const remove = useCallback(async (id) => {
    await moodApi.remove(id);
    setLogs((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const value = useMemo(() => {
    const today = todayISO();
    // Signed out has no stream — derived rather than stored, so signing out
    // can't leave the previous account's moods sitting in state.
    const all = signedIn ? logs : [];
    const todays = all.filter((m) => m.date === today);
    return {
      logs: all,
      loading: signedIn ? loading : false,
      insights: signedIn ? insights : null,
      refresh,
      log,
      remove,
      today,
      todaysLogs: todays,
      todaysDay: todays.find((m) => m.scope === 'day') ?? null,
      todaysMoments: todays.filter((m) => m.scope === 'moment'),
      /** Every log on a date, newest first. */
      forDate: (date) => all.filter((m) => m.date === date),
    };
  }, [signedIn, logs, loading, insights, refresh, log, remove]);

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

export function useMood() {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error('useMood must be used inside MoodProvider');
  return ctx;
}
