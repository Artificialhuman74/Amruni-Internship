import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { communityApi } from '../services/communityApi';
import { apiError } from '../services/api';
import { useToast } from '../components/Toast';
import CommunityPostCard from '../components/CommunityPostCard';
import CommunityPostComposer from '../components/CommunityPostComposer';
import { IconHeart } from '../icons.jsx';

/** Single-post thread, X-style: the root post in full, flat replies below it
 *  in the order the server returns them (reverse-chronological — never
 *  re-sorted here), and an inline reply composer. Reached from the Community
 *  feed via CommunityPostCard's onOpen, and lives inside the tab shell, so it
 *  carries its own back chevron rather than relying on router chrome. */
export default function CommunityThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    async function loadThread() {
      setLoading(true);
      setError(null);
      try {
        const data = await communityApi.getPost(id);
        setPost(data.post);
        setReplies(data.replies);
      } catch (err) {
        setError(apiError(err, "This post isn't available right now."));
      } finally {
        setLoading(false);
      }
    }
    loadThread();
  }, [id]);

  function handleReplyCreated(reply) {
    setReplies((prev) => [reply, ...prev]);
    setPost((prev) => (prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev));
    setComposerOpen(false);
    toast('Your reply is posted', { icon: 'heart' });
  }

  function handleReplyChange(updated) {
    setReplies((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleReplyRemoved(removedId) {
    setReplies((prev) => prev.filter((r) => r.id !== removedId));
    setPost((prev) => (prev ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) } : prev));
  }

  // Any reply can be opened as its own sub-thread (comments have comments).
  function openReply(reply) {
    navigate(`/community/${reply.id}`);
  }

  // Back to wherever we came from — the parent thread when we're in a
  // sub-thread, the feed when we're at the top level — falling back to the
  // feed for a cold deep-link with no in-app history to step back into.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/community');
  }

  return (
    <div className="screen screen--light">
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={goBack} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">Thread</span>
        <div style={{ width: 40 }} />
      </div>

      {loading && (
        <div role="status" aria-live="polite" style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Loading this post…
          </span>
          <div className="skeleton" style={{ height: 20, width: '60%' }} />
          <div className="skeleton" style={{ height: 16, width: '90%' }} />
          <div className="skeleton" style={{ height: 16, width: '75%' }} />
          <div className="divider" style={{ margin: 'var(--sp-2) 0' }} />
          <div className="skeleton" style={{ height: 72, width: '100%', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: 72, width: '100%', borderRadius: 'var(--radius-lg)' }} />
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          style={{
            padding: 'var(--sp-8) var(--sp-6)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: 'var(--sp-4)',
          }}
        >
          <span style={{ color: 'var(--clr-brand-muted)', display: 'flex' }} aria-hidden="true"><IconHeart size={32} /></span>
          <div>
            <p style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--clr-ink)' }}>
              This post isn't available
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-snug)' }}>
              {error}
            </p>
          </div>
          <button className="btn btn--primary" style={{ width: 'auto', paddingLeft: 'var(--sp-8)', paddingRight: 'var(--sp-8)' }} onClick={() => navigate('/community')}>
            Back to Community
          </button>
        </div>
      )}

      {!loading && !error && post && (
        <>
          <div style={{ flex: 1, padding: '0 0 var(--sp-6)' }}>
            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              style={{ padding: 'var(--sp-5) var(--sp-5) var(--sp-2)' }}
            >
              <CommunityPostCard
                post={post}
                onChange={(updated) => setPost(updated)}
                onRemoved={() => navigate('/community')}
              />
            </motion.div>

            <div className="divider" style={{ margin: 'var(--sp-4) var(--sp-5)' }} />

            <div style={{ padding: '0 var(--sp-5)' }}>
              <p className="section-title">
                {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
              </p>

              {replies.length === 0 ? (
                <div style={{ padding: 'var(--sp-6) 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)', lineHeight: 'var(--leading-snug)' }}>
                    No one has replied yet. Be the first to share a kind word.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  {replies.map((reply) => (
                    <CommunityPostCard
                      key={reply.id}
                      post={reply}
                      onOpen={openReply}
                      onChange={handleReplyChange}
                      onRemoved={handleReplyRemoved}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              position: 'sticky', bottom: 0, background: 'var(--clr-surface)',
              borderTop: '1px solid var(--clr-border)',
              padding: composerOpen
                ? 'var(--sp-4) var(--sp-5) calc(env(safe-area-inset-bottom) + var(--sp-4))'
                : 'var(--sp-3) var(--sp-5) calc(env(safe-area-inset-bottom) + var(--sp-3))',
            }}
          >
            {composerOpen ? (
              <CommunityPostComposer
                replyToId={id}
                onCreated={handleReplyCreated}
                onCancel={() => setComposerOpen(false)}
              />
            ) : (
              <button className="btn btn--primary" onClick={() => setComposerOpen(true)}>
                Reply to this thread
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
