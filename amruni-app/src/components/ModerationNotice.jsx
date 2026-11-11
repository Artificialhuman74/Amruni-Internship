import { IconPhone } from '../icons.jsx';
import { tap } from '../lib/haptics';

/**
 * Surfaces community moderation outcomes (`pending`, `rejected`) and any
 * crisis helpline metadata returned by the backend without misrepresenting held
 * or rejected posts as live on the feed.
 */
export default function ModerationNotice({ moderation, onDismiss }) {
  const status = moderation?.moderationStatus || 'approved';
  const helpline = moderation?.helpline;

  if (!moderation || (status === 'approved' && !helpline)) {
    return null;
  }

  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  if (helpline) {
    const bodyText = isPending
      ? 'We held this post for safety review before showing it publicly. If things feel heavy right now, someone is here to listen.'
      : isRejected
        ? 'We could not publish this post under community safety guidelines. You do not have to carry this alone — someone is here to listen.'
        : 'If things feel heavy right now, someone is here to listen.';

    return (
      <div className="crisis-card" role="note" style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
          <p className="crisis-card__title">Support is here right now</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notice"
              style={{
                border: 'none', background: 'transparent', color: 'var(--clr-ink-muted)',
                fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          )}
        </div>
        <p className="crisis-card__body">{bodyText}</p>
        <a href={`tel:${helpline.number}`} className="crisis-card__call" onClick={() => tap()}>
          <IconPhone size={18} /> Call {helpline.name} · {helpline.number}
        </a>
        {helpline.description && (
          <p className="crisis-card__note">{helpline.description}</p>
        )}
      </div>
    );
  }

  return (
    <div
      role={isRejected ? 'alert' : 'status'}
      style={{
        padding: 'var(--sp-4)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--clr-surface-2)',
        border: '1px solid var(--clr-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>
          {isPending ? 'Submitted for review' : 'Post not published'}
        </p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notice"
            style={{
              border: 'none', background: 'transparent', color: 'var(--clr-ink-muted)',
              fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        )}
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
        {isPending
          ? 'Your message is queued with our safety team and will appear once reviewed.'
          : 'This message could not be posted under our community safety guidelines.'}
      </p>
    </div>
  );
}

