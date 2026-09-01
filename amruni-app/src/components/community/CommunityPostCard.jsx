import { useState } from 'react';
import { communityApi } from '../../services/communityApi';
import { apiError } from '../../services/api';
import { useToast } from '../ui/Toast';
import BottomSheet from '../ui/BottomSheet';
import { tap, confirm as confirmHaptic } from '../../lib/haptics';
import { IconHeart, IconChat } from '../../icons.jsx';

const TAG_LABELS = {
  'menstruation': 'Menstruation',
  'sex-pleasure': 'Sex & pleasure',
  'taboo': 'Taboo',
  'pcos-hormones': 'PCOS & hormones',
  'mental-health': 'Mental health & feelings',
  'relationships': 'Relationships',
  'pregnancy-postpartum': 'Pregnancy & postpartum',
  'body-image': 'Body image & self-care',
  'random': 'Random / off-topic',
};

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Renders one post or reply. Used identically by the Community feed (with
 * onOpen, to navigate into the thread) and the thread screen itself (root
 * post and each reply, without onOpen — nothing deeper to navigate to).
 */
export default function CommunityPostCard({ post, onOpen, onChange, onRemoved }) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleLike(e) {
    e.stopPropagation();
    if (busy) return;
    tap();
    try {
      const r = await communityApi.toggleLike(post.id);
      onChange?.({ ...post, likeCount: r.likeCount, likedByMe: r.likedByMe });
    } catch (err) {
      toast(apiError(err), { icon: 'warning' });
    }
  }

  async function handleVote(index, e) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const r = await communityApi.vote(post.id, index);
      onChange?.({ ...post, poll: r.poll, myVote: r.myVote });
    } catch (err) {
      toast(apiError(err), { icon: 'warning' });
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    setMenuOpen(false);
    try {
      await communityApi.report(post.id);
      confirmHaptic();
      toast('Thanks — our team will review this.', { icon: 'heart' });
    } catch (err) {
      toast(apiError(err), { icon: 'warning' });
    }
  }

  async function handleBlock() {
    setMenuOpen(false);
    try {
      await communityApi.blockAuthor(post.id);
      confirmHaptic();
      toast("You won't see posts from this member again.", { icon: 'heart' });
      onRemoved?.(post.id);
    } catch (err) {
      toast(apiError(err), { icon: 'warning' });
    }
  }

  const totalVotes = post.poll ? post.poll.reduce((sum, o) => sum + o.votes, 0) : 0;
  const clickable = !!onOpen;

  return (
    <div
      className={`post-card${clickable ? ' post-card--clickable' : ''}`}
      onClick={clickable ? () => onOpen(post) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => e.key === 'Enter' && onOpen(post) : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <div
          className="post-card__avatar"
          style={{
            background: post.isAnonymous ? 'var(--clr-surface-2)' : 'var(--clr-brand-soft)',
            color: post.isAnonymous ? 'var(--clr-ink-subtle)' : 'var(--clr-brand)',
          }}
        >
          {post.isAnonymous ? '?' : post.displayName?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.displayName}{post.isMine && <span style={{ color: 'var(--clr-ink-subtle)', fontWeight: 500 }}> · you</span>}
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>{relativeTime(post.createdAt)}</p>
        </div>
        {!post.isMine && (
          <button
            className="post-card__action"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
            aria-label="More options"
          >
            •••
          </button>
        )}
      </div>

      {post.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {post.tags.map((t) => (
            <span key={t} className="chip chip--sm" style={{ cursor: 'default' }}>
              {TAG_LABELS[t] || t}
            </span>
          ))}
        </div>
      )}

      {post.type === 'poll' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-snug)' }}>{post.text}</p>
          {post.poll.map((opt, i) => {
            const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
            const voted = post.myVote === i;
            return (
              <button
                key={i}
                type="button"
                className={`post-card__poll-option${voted ? ' post-card__poll-option--voted' : ''}`}
                onClick={(e) => handleVote(i, e)}
                disabled={busy}
              >
                {post.myVote !== null && post.myVote !== undefined && (
                  <div className="post-card__poll-option__fill" style={{ transform: `scaleX(${pct / 100})` }} />
                )}
                <span className="post-card__poll-option__label">
                  <span>{opt.label}</span>
                  {(post.myVote !== null && post.myVote !== undefined) && <span>{pct}%</span>}
                </span>
              </button>
            );
          })}
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>{totalVotes} vote{totalVotes === 1 ? '' : 's'}</p>
        </div>
      ) : (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)', lineHeight: 'var(--leading-snug)', whiteSpace: 'pre-wrap' }}>
          {post.text}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <button
          className={`post-card__action${post.likedByMe ? ' post-card__action--active' : ''}`}
          onClick={handleLike}
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? 'Unlike' : 'Like'}
        >
          <IconHeart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} /> {post.likeCount}
        </button>
        {/* Reply affordance: shown whenever the card opens into a thread of its
            own (feed posts AND replies — any reply can itself be replied to). */}
        {clickable && (
          <span className="post-card__action" style={{ cursor: 'default' }} aria-label={`${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`}>
            <IconChat size={16} /> {post.replyCount}
          </span>
        )}
      </div>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="More options">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <button className="btn btn--ghost" onClick={handleReport}>Report this post</button>
          <button className="btn btn--ghost" onClick={handleBlock} style={{ color: 'var(--clr-emergency)' }}>
            Block this member
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
