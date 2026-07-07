/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { getToken, setToken, meApi } from '../services/api';

const initialState = {
  auth: { phone: null, isAuthenticated: false },
  user: { name: null, dob: null, lifeStage: null, isOnboarded: false },
  cycle: {
    lastPeriodStart: null,
    cycleLength: 28,
    periodLength: 5,
    loggedDays: {},   // { 'YYYY-MM-DD': { flow, symptoms: [] } }
  },
  pregnancy: { weeksPregnant: 16, dueDate: null, trustedContacts: [] },
  settings: { notifications: true, anonymousMode: false },
  sos: {
    contacts: [],          // [{ id, name, phone, relation, userId, createdAt }]
    alerts: [],            // [{ id, message, sentTo, userId, timestamp }]
    activeSession: null,   // null | { startedAt, coords: { lat, lng } }
  },
};

// Maps the server's /me payload onto the client state shape.
export function stateFromServer(payload, phone) {
  return {
    auth: { phone: payload.user.phone || phone, isAuthenticated: true },
    user: {
      name: payload.user.name,
      dob: payload.user.dob,
      lifeStage: payload.user.lifeStage,
      isOnboarded: payload.user.isOnboarded,
    },
    cycle: payload.cycle,
    pregnancy: payload.pregnancy,
    settings: payload.settings,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, auth: { ...state.auth, ...action.payload } };
    case 'SET_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'SET_CYCLE':
      return { ...state, cycle: { ...state.cycle, ...action.payload } };
    case 'LOG_CYCLE_DAY':
      return {
        ...state,
        cycle: {
          ...state.cycle,
          loggedDays: { ...state.cycle.loggedDays, [action.date]: action.data },
        },
      };
    case 'SET_PREGNANCY':
      return { ...state, pregnancy: { ...state.pregnancy, ...action.payload } };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_SOS_CONTACTS':
      return { ...state, sos: { ...state.sos, contacts: action.payload } };
    case 'SET_SOS_ALERTS':
      return { ...state, sos: { ...state.sos, alerts: action.payload } };
    case 'SOS_ACTIVATE':
      return { ...state, sos: { ...state.sos, activeSession: action.payload } };
    case 'SOS_UPDATE_COORDS':
      return {
        ...state,
        sos: {
          ...state.sos,
          activeSession: state.sos.activeSession
            ? { ...state.sos.activeSession, coords: action.payload }
            : null,
        },
      };
    case 'SOS_CANCEL':
      return { ...state, sos: { ...state.sos, activeSession: null } };
    case 'LOGOUT':
      return { ...initialState };
    case 'HYDRATE':
      return action.payload;
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem('amruni_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...init,
          ...parsed,
          sos: parsed.sos || init.sos,
        };
      }
      return init;
      const parsed = saved ? JSON.parse(saved) : init;
      // A session is only valid if the API token is still present.
      if (parsed.auth?.isAuthenticated && !getToken()) {
        return { ...parsed, auth: { ...parsed.auth, isAuthenticated: false } };
      }
      return parsed;
    } catch {
      return init;
    }
  });

  // Server is the source of truth once signed in; localStorage is a fast-start
  // cache. Sync pushes are held until the initial hydrate lands so stale local
  // data never overwrites the account.
  const hydratedRef = useRef(false);
  const syncTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('amruni_state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!state.auth.isAuthenticated) {
      hydratedRef.current = false;
      return;
    }
    if (hydratedRef.current || !getToken()) return;
    let cancelled = false;
    meApi.get()
      .then((payload) => {
        if (cancelled) return;
        dispatch({ type: 'HYDRATE', payload: stateFromServer(payload, state.auth.phone) });
        hydratedRef.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 401) {
          dispatch({ type: 'LOGOUT' });
        }
        // Network errors: keep the cached state and stay usable offline.
      });
    return () => { cancelled = true; };
  }, [state.auth.isAuthenticated, state.auth.phone]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !hydratedRef.current || !getToken()) return;
    clearTimeout(syncTimerRef.current);
    const snapshot = {
      user: state.user,
      cycle: state.cycle,
      pregnancy: state.pregnancy,
      settings: state.settings,
    };
    syncTimerRef.current = setTimeout(() => {
      meApi.syncState(snapshot).catch((err) => {
        console.warn('State sync failed; will retry on next change.', err);
      });
    }, 700);
    return () => clearTimeout(syncTimerRef.current);
  }, [state.auth.isAuthenticated, state.user, state.cycle, state.pregnancy, state.settings]);

  useEffect(() => {
    if (!state.auth.isAuthenticated) setToken(null);
  }, [state.auth.isAuthenticated]);

  // Hydration entry point for the OTP screen: it already has the /me payload
  // from verify-otp, so it hydrates directly instead of re-fetching.
  function hydrateFromServer(payload, phone) {
    dispatch({ type: 'HYDRATE', payload: stateFromServer(payload, phone) });
    hydratedRef.current = true;
  }

  return (
    <AppContext.Provider value={{ state, dispatch, hydrateFromServer }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useCycleData(state) {
  const { lastPeriodStart, cycleLength, periodLength } = state.cycle;
  if (!lastPeriodStart) return { periodDays: [], fertileDays: [], predictedDays: [], ovulationDate: null, cycleDay: null, phase: null };

  const start = new Date(lastPeriodStart);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = today - start;
  const cycleDay = Math.floor(diffMs / 86400000) + 1;

  const periodDays = [];
  for (let i = 0; i < periodLength; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    periodDays.push(d.toISOString().split('T')[0]);
  }

  const ovulationDay = new Date(start);
  ovulationDay.setDate(ovulationDay.getDate() + cycleLength - 14);
  const ovulationDate = ovulationDay.toISOString().split('T')[0];

  const fertileDays = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(ovulationDay);
    d.setDate(d.getDate() + i);
    fertileDays.push(d.toISOString().split('T')[0]);
  }

  const nextStart = new Date(start);
  nextStart.setDate(nextStart.getDate() + cycleLength);
  const predictedDays = [];
  for (let i = 0; i < periodLength; i++) {
    const d = new Date(nextStart);
    d.setDate(d.getDate() + i);
    predictedDays.push(d.toISOString().split('T')[0]);
  }

  const normalizedCycleDay = ((cycleDay - 1) % cycleLength) + 1;
  let phase = 'luteal';
  if (normalizedCycleDay <= periodLength) phase = 'menstrual';
  else if (normalizedCycleDay <= cycleLength - 14 - 5) phase = 'follicular';
  else if (normalizedCycleDay <= cycleLength - 14 + 1) phase = 'ovulation';

  return { periodDays, fertileDays, predictedDays, ovulationDate, cycleDay: normalizedCycleDay, phase };
}
