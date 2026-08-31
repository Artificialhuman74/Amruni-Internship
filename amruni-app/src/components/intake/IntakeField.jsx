import { optionValue } from '../../data/intake';

/**
 * One question, rendered by kind. UI only — every decision about what is asked
 * lives in data/intake.js, and every decision about what happens to the answer
 * lives in hooks/useIntakeForm.js.
 *
 * The label is a real <label>/<legend> in every branch. A form this long,
 * asked of women who may be using a screen reader or voice control, cannot
 * afford a single question whose text is not programmatically tied to its
 * control.
 */
export default function IntakeField({ field, value, onChange }) {
  const describedBy = field.hint ? `${field.id}-hint` : undefined;

  return (
    <div className="intake-field">
      {field.kind === 'choice' || field.kind === 'multi' || field.kind === 'scale' || field.kind === 'bool' ? (
        <fieldset className="intake-field__set">
          <legend className="intake-field__label">
            {field.label}
            {field.optional && <span className="intake-field__optional">Optional</span>}
          </legend>
          {field.hint && <p className="intake-field__hint" id={describedBy}>{field.hint}</p>}
          <Control field={field} value={value} onChange={onChange} describedBy={describedBy} />
        </fieldset>
      ) : (
        <>
          <label className="intake-field__label" htmlFor={field.id}>
            {field.label}
            {field.optional && <span className="intake-field__optional">Optional</span>}
          </label>
          {field.hint && <p className="intake-field__hint" id={describedBy}>{field.hint}</p>}
          <Control field={field} value={value} onChange={onChange} describedBy={describedBy} />
        </>
      )}
    </div>
  );
}

function Control({ field, value, onChange, describedBy }) {
  switch (field.kind) {
    case 'long':
      return (
        <textarea
          id={field.id}
          className="intake-textarea"
          rows={4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
        />
      );

    case 'text':
      return (
        <input
          id={field.id}
          type="text"
          className="input-field"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
        />
      );

    case 'choice':
      return (
        <div className="intake-options">
          {field.options.map((opt) => {
            const val = optionValue(opt);
            const active = value === val;
            return (
              <button
                key={val}
                type="button"
                className={`intake-option${active ? ' intake-option--active' : ''}`}
                // Tapping the chosen answer again clears it — the only way out
                // of a radio group she answered by accident.
                onClick={() => onChange(active ? null : val)}
                aria-pressed={active}
              >
                <span className="intake-option__mark" aria-hidden="true">
                  {active && <span className="intake-option__dot" />}
                </span>
                <span className="intake-option__text">{val}</span>
              </button>
            );
          })}
        </div>
      );

    case 'multi': {
      const selected = value ?? [];
      return (
        <div className="intake-options">
          {field.options.map((opt) => {
            const val = optionValue(opt);
            const active = selected.includes(val);
            return (
              <button
                key={val}
                type="button"
                className={`intake-option${active ? ' intake-option--active' : ''}`}
                onClick={() => {
                  // "None of these" and its cousins clear the rest, and any
                  // other pick clears them — otherwise a chart reads
                  // "Diabetes, Nothing I know of".
                  if (field.exclusive && val === field.exclusive) {
                    onChange(active ? [] : [val]);
                    return;
                  }
                  const without = selected.filter((s) => s !== field.exclusive);
                  onChange(active ? without.filter((s) => s !== val) : [...without, val]);
                }}
                aria-pressed={active}
              >
                <span className="intake-option__mark intake-option__mark--box" aria-hidden="true">
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="intake-option__text">{val}</span>
              </button>
            );
          })}
        </div>
      );
    }

    case 'bool':
      return (
        <div className="intake-bool">
          {[['Yes', true], ['No', false]].map(([label, val]) => (
            <button
              key={label}
              type="button"
              className={`intake-bool__btn${value === val ? ' intake-bool__btn--active' : ''}`}
              onClick={() => onChange(value === val ? null : val)}
              aria-pressed={value === val}
            >
              {label}
            </button>
          ))}
        </div>
      );

    case 'scale': {
      const steps = Array.from({ length: field.max - field.min + 1 }, (_, i) => field.min + i);
      return (
        <div className="intake-scale">
          <div className="intake-scale__row" role="group" aria-describedby={describedBy}>
            {steps.map((step) => (
              <button
                key={step}
                type="button"
                className={`intake-scale__step${value === step ? ' intake-scale__step--active' : ''}`}
                onClick={() => onChange(value === step ? null : step)}
                aria-label={`${step} out of ${field.max}`}
                aria-pressed={value === step}
              >
                {step}
              </button>
            ))}
          </div>
          <div className="intake-scale__ends">
            <span>{field.ends[0]}</span>
            <span>{field.ends[1]}</span>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
