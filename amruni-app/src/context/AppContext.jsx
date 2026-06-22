import { createContext, useContext, useReducer, useEffect } from 'react';

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
};

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
      return saved ? JSON.parse(saved) : init;
    } catch {
      return init;
    }
  });

  useEffect(() => {
    localStorage.setItem('amruni_state', JSON.stringify(state));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
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
