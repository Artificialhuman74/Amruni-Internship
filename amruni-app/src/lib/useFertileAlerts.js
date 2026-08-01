import { useEffect } from 'react';
import { fertilityModel, fertileAlert } from './fertility';
import { notifyOnce } from './reminders';

/**
 * The two notifications a cycle.
 *
 * Lives in the shell rather than on the Conceive screen, because a fertile
 * window she has to open the app to find out about is not something the app
 * told her — and the day it opens is precisely the day she has not thought to
 * look.
 *
 * Three gates, all of which must be open: she said she is trying to conceive,
 * reminders are on, and the browser permission was actually granted.
 * `notifyOnce` keys on the date, so the window opening fires once however many
 * times the app is opened that day. The interval exists only so an app left
 * open across midnight still fires in the morning.
 */
const HOURLY = 60 * 60 * 1000;

export function useFertileAlerts(state) {
  const on = Boolean(state.settings?.conceiveMode)
    && Boolean(state.settings?.notifications)
    && !state.settings?.pregnancyMode;
  const { lastPeriodStart, cycleLength } = state.cycle || {};

  useEffect(() => {
    if (!on || !lastPeriodStart) return;

    const check = () => {
      const alert = fertileAlert(fertilityModel({ lastPeriodStart, cycleLength }));
      if (alert) notifyOnce(alert.key, alert.title, alert.body);
    };

    check();
    const timer = setInterval(check, HOURLY);
    return () => clearInterval(timer);
  }, [on, lastPeriodStart, cycleLength]);
}
