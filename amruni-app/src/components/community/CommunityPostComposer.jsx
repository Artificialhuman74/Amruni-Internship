import { useEffect, useState } from 'react';
import { communityApi } from '../../services/communityApi';
import { apiError } from '../../services/api';
import { useToast } from '../ui/Toast';
import { useIdentityWarning } from '../../lib/useIdentityWarning';
import IdentityWarningSheet from '../ui/IdentityWarningSheet';

/**
 * Shared composer for both a new root post (Community feed) and a reply
 * (Community thread) — pass `replyToId` for the latter. Root posts can be
 * text or a 2-4 option poll; replies are always text-only and carry no tags
 * of their own (they inherit context from the thread they're in).
 */
export default function CommunityPostComposer({ replyToId = null, onCreated, onCancel }) {
  const toast = useToast();
  const { open: warnOpen, guardToggleOff, confirm: confirmWarn, cancel: cancelWarn } = useIdentityWarning();

  const [availableTags, setAvailableTags] = useState([]);
  const [type, setType] = useState('text');
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (replyToId) return; // replies don't show a tag picker
    communityApi.getTags().then(setAvailableTags).catch(() => {});
  }, [replyToId]);

  function toggleTag(id) {
    setTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function handleAnonymityChange(nextValue) {
    if (nextValue === false) {
      guardToggleOff(() => setIsAnonymous(false));
    } else {
      setIsAnonymous(true);
    }
  }

  function updatePollOption(i, value) {
    setPollOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addPollOption() {
    setPollOptions((prev) => (prev.length < 4 ? [...prev, ''] : prev));
  }
  function removePollOption(i) {
    setPollOptions((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const canSubmit = type === 'text'
    ? text.trim().length > 0
    : text.trim().length > 0 && trimmedOptions.length >= 2;

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const post = await communityApi.createPost({
        tags: replyToId ? [] : tags,
        type: replyToId ? 'text' : type,
        text: text.trim(),
        pollOptions: type === 'poll' && !replyToId ? trimmedOptions : [],
        isAnonymous,
        replyToId,
      });
      onCreated(post);
    } catch (err) {
      toast(apiError(err), { icon: 'warning' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {!replyToId && (
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            type="button"
            className={`chip${type === 'text' ? ' chip--active' : ''}`}
            onClick={() => setType('text')}
          >
            Text post
          </button>
          <button
            type="button"
            className={`chip${type === 'poll' ? ' chip--active' : ''}`}
            onClick={() => setType('poll')}
          >
            Poll
          </button>
        </div>
      )}

      <div className="input-group">
        <label className="input-label" htmlFor="composer-text">
          {type === 'poll' && !replyToId ? 'Your question' : replyToId ? 'Your reply' : "What's on your mind?"}
        </label>
        <textarea
          id="composer-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={replyToId ? 'Add to the thread…' : "Share what's on your mind — you're anonymous by default."}
          rows={3}
          maxLength={1000}
          style={{
            width: '100%', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--clr-surface-2)', border: '1.5px solid var(--clr-border)',
            color: 'var(--clr-ink)', resize: 'vertical', minHeight: 80,
          }}
          autoFocus
        />
      </div>

      {type === 'poll' && !replyToId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <span className="input-label">Options</span>
          {pollOptions.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
              <input
                className="input-field"
                type="text"
                value={opt}
                maxLength={80}
                placeholder={`Option ${i + 1}`}
                onChange={(e) => updatePollOption(i, e.target.value)}
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePollOption(i)}
                  aria-label={`Remove option ${i + 1}`}
                  style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--clr-surface-2)', color: 'var(--clr-ink-subtle)', cursor: 'pointer', flexShrink: 0 }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 4 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={addPollOption} style={{ alignSelf: 'flex-start', width: 'auto' }}>
              + Add option
            </button>
          )}
        </div>
      )}

      {!replyToId && availableTags.length > 0 && (
        <div>
          <span className="input-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Tags</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            {availableTags.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip chip--sm${tags.includes(t.id) ? ' chip--active' : ''}`}
                aria-pressed={tags.includes(t.id)}
                onClick={() => toggleTag(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)' }}>
        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>Post anonymously</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 1 }}>
            {isAnonymous ? 'Shown under your anonymous handle' : 'Shown under your real name'}
          </p>
        </div>
        <button
          type="button"
          className={`toggle${isAnonymous ? ' toggle--on' : ''}`}
          onClick={() => handleAnonymityChange(!isAnonymous)}
          aria-pressed={isAnonymous}
          aria-label="Post anonymously"
        >
          <div className="toggle__knob" />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={submit} disabled={!canSubmit || submitting}>
          {submitting ? 'Posting…' : replyToId ? 'Reply' : 'Post'}
        </button>
      </div>

      <IdentityWarningSheet open={warnOpen} onConfirm={confirmWarn} onCancel={cancelWarn} />
    </div>
  );
}
