import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { communityApi } from '../services/communityApi';
import { apiError } from '../services/api';
import { useToast } from '../components/Toast';
import BottomSheet from '../components/BottomSheet';
import CommunityPostCard from '../components/CommunityPostCard';
import CommunityPostComposer from '../components/CommunityPostComposer';
import { tap } from '../lib/haptics';
import { IconHeart } from '../icons.jsx';

const PAGE_SIZE = 15;

/**
 * Anonymous-by-default community feed. Reads posts and tags from the
 * already-built communityApi (age-gating and blocked-author filtering are
 * enforced server-side, not re-implemented here) and renders each post with
 * the fully-built CommunityPostCard — this screen only owns the tag filter,
 * pagination, composer trigger, and local list state.
 */
export default function Community() {
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null); // null = "All"
  const [reloadKey, setReloadKey] = useState(0); // bumped to force a re-fetch after an error

  const [posts, setPosts] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(true); // initial load for the current tag
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [composerOpen, setComposerOpen] = useState(false);

  const sentinelRef = useRef(null);
  const requestIdRef = useRef(0);

  // Tags load once — the tag list itself doesn't change with the active filter.
  useEffect(() => {
    communityApi.getTags().then(setTags).catch(() => {});
  }, []);

  // (Re)load the feed from scratch whenever the active tag changes.
  useEffect(() => {
    async function loadFeed() {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const { posts: fetched, nextBefore: cursor } = await communityApi.getFeed({ tag: activeTag || undefined, limit: PAGE_SIZE });
        if (requestId !== requestIdRef.current) return;
        setPosts(fetched);
        setNextBefore(cursor);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(apiError(err));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }
    loadFeed();
  }, [activeTag, reloadKey]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !nextBefore) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    communityApi.getFeed({ tag: activeTag || undefined, before: nextBefore, limit: PAGE_SIZE })
      .then(({ posts: fetched, nextBefore: cursor }) => {
        if (requestId !== requestIdRef.current) return;
        setPosts((prev) => [...prev, ...fetched]);
        setNextBefore(cursor);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        toast(apiError(err), { icon: 'warning' });
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoadingMore(false);
      });
  }, [activeTag, loading, loadingMore, nextBefore, toast]);

  // Infinite scroll: observe a sentinel at the end of the list and fetch the
  // next page once it enters view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextBefore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextBefore, loadMore]);

  function selectTag(tagId) {
    if (tagId === activeTag) return;
    tap();
    setActiveTag(tagId);
  }

  function handlePostChange(updated) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handlePostRemoved(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleCreated(post) {
    setPosts((prev) => [post, ...prev]);
    setComposerOpen(false);
    toast('Your post is live', { icon: 'heart' });
  }

  return (
    <div className="screen screen--light">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', position: 'relative', minHeight: '100%' }}>

        {/* Header */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>Community</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2, lineHeight: 'var(--leading-snug)' }}>
            A space to ask, share, and be heard — anonymous by default, moderated with care.
          </p>
        </motion.div>

        {/* Tag filter row */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', gap: 'var(--sp-2)', overflowX: 'auto', paddingBottom: 2, marginLeft: 'calc(var(--sp-6) * -1)', marginRight: 'calc(var(--sp-6) * -1)', paddingLeft: 'var(--sp-6)', paddingRight: 'var(--sp-6)' }}
        >
          <button
            type="button"
            className={`chip${activeTag === null ? ' chip--active' : ''}`}
            aria-pressed={activeTag === null}
            onClick={() => selectTag(null)}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip${activeTag === t.id ? ' chip--active' : ''}`}
              aria-pressed={activeTag === t.id}
              onClick={() => selectTag(t.id)}
            >
              {t.label}
            </button>
          ))}
        </motion.div>

        {/* Feed */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-4)', background: 'var(--clr-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="skeleton" style={{ width: '40%', height: 12, borderRadius: 'var(--radius-sm)' }} />
                    <div className="skeleton" style={{ width: '25%', height: 10, borderRadius: 'var(--radius-sm)' }} />
                  </div>
                </div>
                <div className="skeleton" style={{ width: '100%', height: 14, borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ width: '75%', height: 14, borderRadius: 'var(--radius-sm)' }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-4)' }}
          >
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>{error}</p>
            <button className="btn btn--ghost btn--sm" style={{ width: 'auto', marginTop: 'var(--sp-3)' }} onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </button>
          </motion.div>
        ) : posts.length === 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)' }}
          >
            <span style={{ color: 'var(--clr-brand-muted)', display: 'flex' }} aria-hidden="true"><IconHeart size={32} /></span>
            <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>
              {activeTag ? "No one's posted here yet" : 'Be the first to share'}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', maxWidth: '32ch', lineHeight: 'var(--leading-snug)' }}>
              Whatever's on your mind, someone here has likely felt it too. Your name stays private unless you choose otherwise.
            </p>
            <button className="btn btn--primary btn--sm" style={{ width: 'auto', marginTop: 'var(--sp-2)' }} onClick={() => setComposerOpen(true)}>
              Start the conversation
            </button>
          </motion.div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CommunityPostCard
                    post={post}
                    onOpen={(p) => navigate(`/community/${p.id}`)}
                    onChange={handlePostChange}
                    onRemoved={handlePostRemoved}
                  />
                </motion.div>
              ))}
            </div>

            {/* Infinite-scroll sentinel */}
            <div ref={sentinelRef} style={{ height: 1 }} />
            <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
              {loadingMore ? 'Loading more posts' : ''}
            </div>
            {loadingMore && (
              <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }} aria-hidden="true">
                Loading more…
              </p>
            )}
            {!nextBefore && posts.length > 0 && (
              <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', padding: 'var(--sp-3) 0' }}>
                You're all caught up.
              </p>
            )}
          </>
        )}
      </div>

      {/* New post FAB — bottom-right, above the tab bar, within the 430px column */}
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        aria-label="New post"
        style={{
          position: 'fixed',
          bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + var(--sp-4))',
          right: 'max(var(--sp-5), calc((100vw - 430px) / 2 + var(--sp-5)))',
          width: 56, height: 56,
          borderRadius: 'var(--radius-full)',
          background: 'var(--clr-brand)',
          color: 'white',
          border: 'none',
          boxShadow: 'var(--shadow-brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 400, lineHeight: 1,
          zIndex: 'var(--z-nav)',
          cursor: 'pointer',
        }}
      >
        +
      </button>

      <BottomSheet open={composerOpen} onClose={() => setComposerOpen(false)} title="New post">
        <CommunityPostComposer onCreated={handleCreated} onCancel={() => setComposerOpen(false)} />
      </BottomSheet>
    </div>
  );
}
