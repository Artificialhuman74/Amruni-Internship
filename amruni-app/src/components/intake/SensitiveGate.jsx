import { IconLock } from '../../icons.jsx';

/**
 * The door in front of the difficult-experiences section.
 *
 * Its whole job is to make sure she chooses to open it. It states what is
 * behind it, why a homeopath asks, who reads the answers, that nothing is
 * required, and that skipping costs her nothing — then gives skipping equal
 * visual weight to continuing. A "Skip" styled as the lesser option is not
 * really an offer.
 */
export default function SensitiveGate({ section, onEnter, onSkip }) {
  const gate = section.gate;
  return (
    <div className="gate-card">
      <div className="gate-card__icon" aria-hidden="true"><IconLock size={20} /></div>
      <h3 className="gate-card__title">{gate.title}</h3>
      <p className="gate-card__body">{gate.body}</p>

      <div className="gate-card__who">
        <p className="gate-card__who-label">Who sees this</p>
        <p className="gate-card__who-text">{gate.who}</p>
      </div>

      {/* Said here rather than discovered later: the draft that saves the rest
          of the form on purpose does not save this section. */}
      <p className="gate-card__note">
        Answers here are not saved as you type, unlike the rest of the form. They stay on this
        screen until you submit, and are gone if you close it.
      </p>

      <div className="gate-card__actions">
        <button type="button" className="btn btn--secondary" onClick={onSkip}>
          {gate.skip}
        </button>
        <button type="button" className="btn btn--primary" onClick={onEnter}>
          {gate.enter}
        </button>
      </div>
    </div>
  );
}
