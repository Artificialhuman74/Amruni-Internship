import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  SPECIALTY_GROUPS, LANGUAGE_GROUPS, LICENCE_COUNTRIES, REGIONS, AUTHORITY_SUGGESTIONS, countryByCode, licenceProblem, EMPTY_LICENCE,
} from '../../data/practitioners';

/**
 * The three onboarding fields the clinic flagged, as real controls.
 *
 *  · SpecialtyPicker — one choice from ~60, searchable, grouped. Typing
 *    something not in the list offers it as a custom value rather than
 *    refusing, because the fuller list the clinic is sending will still miss
 *    something.
 *  · LanguagePicker — many choices, from a list, so "Kanada" cannot happen.
 *  · LicenceEditor — one row per jurisdiction. See REGIONS in
 *    data/practitioners.js for why a US licence must carry its state.
 *
 * Both pickers are a combobox over a listbox (WAI-ARIA APG pattern): arrow keys
 * move, Enter picks, Escape closes, and the options are announced. An admin
 * onboarding thirty practitioners in a morning does it from the keyboard.
 */

function useOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [ref, onOutside, active]);
}

function filterGroups(groups, query) {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length);
}

/** Shared listbox body. `isSelected` decides the check; `onPick` handles it. */
function Options({ id, groups, activeValue, isSelected, onPick, onHover, custom }) {
  return (
    <div className="pf-list" id={id} role="listbox" aria-multiselectable={undefined}>
      {groups.map((g) => (
        <div key={g.label} role="group" aria-label={g.label}>
          <p className="pf-list__group" aria-hidden="true">{g.label}</p>
          {g.items.map((item) => {
            const selected = isSelected(item);
            return (
              <div
                key={item}
                id={`${id}-${item.replace(/\W+/g, '-')}`}
                role="option"
                aria-selected={selected}
                className={`pf-option${activeValue === item ? ' pf-option--active' : ''}${selected ? ' pf-option--on' : ''}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onPick(item)}
                onPointerEnter={() => onHover(item)}
              >
                <span>{item}</span>
                {selected && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {custom}
      {!groups.length && !custom && <p className="pf-list__empty">Nothing matches.</p>}
    </div>
  );
}

function useListKeys(flat, onPick, setOpen) {
  const [active, setActive] = useState(null);
  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!flat.length) return;
      const i = flat.indexOf(active);
      const next = e.key === 'ArrowDown' ? (i + 1) % flat.length : (i <= 0 ? flat.length - 1 : i - 1);
      setActive(flat[next]);
    } else if (e.key === 'Enter') {
      if (active) { e.preventDefault(); onPick(active); }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }
  return { active, setActive, onKeyDown };
}

export function SpecialtyPicker({ value, onChange, label = 'Specialty', required }) {
  const id = useId();
  const wrap = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useOutside(wrap, () => { setOpen(false); setQuery(''); }, open);

  const groups = useMemo(() => filterGroups(SPECIALTY_GROUPS, query), [query]);
  const flat = groups.flatMap((g) => g.items);
  const trimmed = query.trim();
  const known = SPECIALTY_GROUPS.some((g) => g.items.some((i) => i.toLowerCase() === trimmed.toLowerCase()));
  const offerCustom = trimmed.length > 1 && !known;
  const flatWithCustom = offerCustom ? [...flat, trimmed] : flat;

  function pick(item) {
    onChange(item);
    setQuery('');
    setOpen(false);
  }
  const keys = useListKeys(flatWithCustom, pick, setOpen);

  return (
    <div className="pf" ref={wrap}>
      <label className="pf-label" htmlFor={`${id}-input`}>{label}{required && ' *'}</label>
      <div className={`pf-field${open ? ' pf-field--open' : ''}`}>
        <input
          id={`${id}-input`}
          className="pf-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && keys.active ? `${id}-list-${keys.active.replace(/\W+/g, '-')}` : undefined}
          value={open ? query : value}
          placeholder={open ? (value || 'Search 60+ specialties') : 'Choose a specialty'}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); keys.setActive(null); }}
          onKeyDown={keys.onKeyDown}
          autoComplete="off"
        />
        <Chevron open={open} />
      </div>
      {open && (
        <Options
          id={`${id}-list`}
          groups={groups}
          activeValue={keys.active}
          isSelected={(i) => i === value}
          onPick={pick}
          onHover={keys.setActive}
          custom={offerCustom ? (
            <div
              id={`${id}-list-${trimmed.replace(/\W+/g, '-')}`}
              role="option"
              aria-selected={false}
              className={`pf-option pf-option--custom${keys.active === trimmed ? ' pf-option--active' : ''}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(trimmed)}
            >
              Use “{trimmed}”
            </div>
          ) : null}
        />
      )}
    </div>
  );
}

export function LanguagePicker({ value, onChange, label = 'Languages' }) {
  const id = useId();
  const wrap = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useOutside(wrap, () => { setOpen(false); setQuery(''); }, open);

  const groups = useMemo(() => filterGroups(LANGUAGE_GROUPS, query), [query]);
  const flat = groups.flatMap((g) => g.items);

  function toggle(item) {
    onChange(value.includes(item) ? value.filter((l) => l !== item) : [...value, item]);
    // Stays open: picking three languages should not mean opening it three times.
  }
  const keys = useListKeys(flat, toggle, setOpen);

  return (
    <div className="pf" ref={wrap}>
      <label className="pf-label" htmlFor={`${id}-input`}>{label}</label>
      <div
        className={`pf-field pf-field--chips${open ? ' pf-field--open' : ''}`}
        onClick={() => document.getElementById(`${id}-input`)?.focus()}
      >
        {value.map((l) => (
          <span key={l} className="pf-chip">
            {l}
            <button
              type="button"
              className="pf-chip__x"
              aria-label={`Remove ${l}`}
              onClick={(e) => { e.stopPropagation(); toggle(l); }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={`${id}-input`}
          className="pf-input pf-input--inline"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && keys.active ? `${id}-list-${keys.active.replace(/\W+/g, '-')}` : undefined}
          value={query}
          placeholder={value.length ? 'Add another' : 'Choose languages'}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); keys.setActive(null); }}
          onKeyDown={(e) => {
            // Backspace on an empty search removes the last chip, as in every tag input.
            if (e.key === 'Backspace' && !query && value.length) toggle(value[value.length - 1]);
            else keys.onKeyDown(e);
          }}
          autoComplete="off"
        />
      </div>
      {open && (
        <Options
          id={`${id}-list`}
          groups={groups}
          activeValue={keys.active}
          isSelected={(i) => value.includes(i)}
          onPick={toggle}
          onHover={keys.setActive}
        />
      )}
      <p className="pf-hint">{value.length ? `${value.length} selected` : 'Pick every language they consult in.'}</p>
    </div>
  );
}

export function LicenceEditor({ value, onChange, showErrors }) {
  const id = useId();
  const today = new Date().toISOString().slice(0, 10);

  function update(i, patch) {
    onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <fieldset className="lic">
      <legend className="pf-label">Licences to practise *</legend>
      <p className="pf-hint lic__intro">
        One row per place they are licensed. A doctor licensed in New York and Tennessee needs two rows —
        and cannot consult patients in any other state.
      </p>

      {value.map((l, i) => {
        const country = countryByCode(l.country);
        const regions = REGIONS[l.country];
        const problem = showErrors ? licenceProblem(l) : null;
        return (
          <div key={i} className={`lic__row${problem ? ' lic__row--bad' : ''}`}>
            <div className="lic__head">
              <span className="lic__n">Licence {i + 1}</span>
              {value.length > 1 && (
                <button type="button" className="lic__remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>

            <div className="lic__grid">
              <label className="lic__cell">
                <span>Country</span>
                <select
                  value={l.country}
                  onChange={(e) => update(i, { country: e.target.value, region: '' })}
                >
                  {LICENCE_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>

              <label className="lic__cell">
                <span>{country.regionLabel}{country.regionRequired ? ' *' : ''}</span>
                {regions ? (
                  <select value={l.region} onChange={(e) => update(i, { region: e.target.value })}>
                    <option value="">{country.regionRequired ? 'Choose…' : 'National / not regional'}</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <input value={l.region} onChange={(e) => update(i, { region: e.target.value })} placeholder="Optional" />
                )}
              </label>

              <label className="lic__cell lic__cell--wide">
                <span>Issuing council or board *</span>
                <input
                  list={`${id}-auth-${l.country}`}
                  value={l.authority}
                  onChange={(e) => update(i, { authority: e.target.value })}
                  placeholder={AUTHORITY_SUGGESTIONS[l.country]?.[0] ?? 'Licensing authority'}
                />
                <datalist id={`${id}-auth-${l.country}`}>
                  {(AUTHORITY_SUGGESTIONS[l.country] ?? []).map((a) => <option key={a} value={a} />)}
                </datalist>
              </label>

              <label className="lic__cell">
                <span>Registration number *</span>
                <input
                  value={l.number}
                  onChange={(e) => update(i, { number: e.target.value })}
                  placeholder="e.g. KMC 123456"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </label>

              <label className="lic__cell">
                <span>Valid until</span>
                <input type="date" min={today} value={l.expiresOn} onChange={(e) => update(i, { expiresOn: e.target.value })} />
              </label>
            </div>

            {problem && <p className="lic__problem" role="alert">{problem}</p>}
          </div>
        );
      })}

      <button type="button" className="lic__add" onClick={() => onChange([...value, { ...EMPTY_LICENCE }])}>
        + Add another licence
      </button>
    </fieldset>
  );
}

function Chevron({ open }) {
  return (
    <svg className={`pf-chev${open ? ' pf-chev--open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
