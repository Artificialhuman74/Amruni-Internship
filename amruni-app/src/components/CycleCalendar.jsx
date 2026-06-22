import { useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isoDate(d) {
  return d.toISOString().split('T')[0];
}

export default function CycleCalendar({
  periodDays = [],
  predictedDays = [],
  fertileDays = [],
  ovulationDate = null,
  loggedDays = {},
  selectedDate,
  onSelectDate,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  const todayStr = isoDate(today);
  const periodSet = new Set(periodDays);
  const predictedSet = new Set(predictedDays);
  const fertileSet = new Set(fertileDays);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="cycle-cal">
      {/* Header */}
      <div className="cycle-cal__header">
        <button className="cycle-cal__nav" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft />
        </button>
        <span className="cycle-cal__month">{MONTHS[month]} {year}</span>
        <button className="cycle-cal__nav" onClick={nextMonth} aria-label="Next month">
          <ChevronRight />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="cycle-cal__weekdays">
        {WEEKDAYS.map(d => (
          <div key={d} className="cycle-cal__weekday">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="cycle-cal__grid">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="cycle-cal__day cycle-cal__day--empty" />;

          const dateStr = isoDate(new Date(year, month, day));
          const isToday = dateStr === todayStr;
          const isPeriod = periodSet.has(dateStr) || !!loggedDays[dateStr]?.flow;
          const isPredicted = predictedSet.has(dateStr) && !isPeriod;
          const isFertile = fertileSet.has(dateStr) && !isPeriod;
          const isOvulation = ovulationDate === dateStr && !isPeriod;
          const isSelected = selectedDate === dateStr;

          const cls = [
            'cycle-cal__day',
            isToday ? 'cycle-cal__day--today' : '',
            isOvulation ? 'cycle-cal__day--ovulation' : '',
            isPeriod ? 'cycle-cal__day--period' : '',
            isPredicted ? 'cycle-cal__day--predicted' : '',
            isFertile && !isOvulation ? 'cycle-cal__day--fertile' : '',
            isSelected ? 'cycle-cal__day--selected' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={dateStr}
              className={cls}
              onClick={() => onSelectDate?.(dateStr)}
              aria-label={`${day} ${MONTHS[month]}`}
              aria-pressed={isSelected}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="cycle-legend">
        <div className="cycle-legend__item">
          <div className="cycle-legend__dot" style={{ background: 'var(--clr-brand)' }} />
          Period
        </div>
        <div className="cycle-legend__item">
          <div className="cycle-legend__dot" style={{ background: 'var(--clr-brand-muted)' }} />
          Predicted
        </div>
        <div className="cycle-legend__item">
          <div className="cycle-legend__dot" style={{ background: 'var(--clr-fertile)' }} />
          Fertile
        </div>
        <div className="cycle-legend__item">
          <div className="cycle-legend__dot" style={{ background: 'var(--clr-ovulation)' }} />
          Ovulation
        </div>
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
