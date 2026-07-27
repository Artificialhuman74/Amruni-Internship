import { useApp } from '../../../context/AppContext';
import { BottomSheet } from '../../shared';

// A live before/after of the user's OWN post, not a generic stock graphic —
// makes the identity-exposure risk concrete rather than abstract.
function MockPostCard({ anonymous, name }) {
  const label = anonymous ? 'VioletHarbor192' : (name || 'You');
  const initial = anonymous ? '?' : label[0]?.toUpperCase();
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: 'var(--sp-3)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--clr-border)',
        background: 'var(--clr-surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-full)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-xs)', fontWeight: 700,
            background: anonymous ? 'var(--clr-surface-2)' : 'var(--clr-brand-soft)',
            color: anonymous ? 'var(--clr-ink-subtle)' : 'var(--clr-brand)',
          }}
        >
          {initial}
        </div>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </p>
      </div>
      <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--clr-surface-2)', marginBottom: 4 }} />
      <div style={{ height: 6, width: '70%', borderRadius: 'var(--radius-full)', background: 'var(--clr-surface-2)' }} />
      <p style={{ fontSize: 10, fontWeight: 600, color: anonymous ? 'var(--clr-success)' : 'var(--clr-warning)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 'var(--sp-3)' }}>
        {anonymous ? 'Hidden identity' : 'Your real name shows'}
      </p>
    </div>
  );
}

export default function IdentityWarningSheet({ open, onConfirm, onCancel }) {
  const { state } = useApp();
  const name = state.user.name;

  return (
    <BottomSheet open={open} onClose={onCancel} title="You're about to post as yourself">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)' }}>
          Turning anonymity off means this post — and any others you make while it's off — shows your real name instead of your anonymous handle.
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <MockPostCard anonymous name={name} />
          <MockPostCard anonymous={false} name={name} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <button className="btn btn--primary" onClick={onConfirm}>
            Post as {name || 'myself'}
          </button>
          <button className="btn btn--ghost" onClick={onCancel}>
            Stay anonymous
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
