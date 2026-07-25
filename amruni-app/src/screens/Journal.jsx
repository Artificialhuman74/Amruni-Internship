import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { journalApi } from '../services/journalApi';
import { communityApi } from '../services/communityApi';
import { apiError } from '../services/api';
import BottomSheet from '../components/BottomSheet';
import IdentityWarningSheet from '../components/IdentityWarningSheet';
import { useToast } from '../components/Toast';
import { useIdentityWarning } from '../lib/useIdentityWarning';
import { IconJournal } from '../icons.jsx';
import { tap, confirm as confirmHaptic, warn } from '../lib/haptics';

const FADE_UP_TRANSITION = { duration: 0.35, ease: [0.16, 1, 0.3, 1] };

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function formatDate(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Journal() {
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { open: warningOpen, guardToggleOff, confirm: confirmWarning, cancel: cancelWarning } = useIdentityWarning();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState('form'); // 'form' | 'share'
  const [activeEntry, setActiveEntry] = useState(null); // null while composing a new entry
  const [form, setForm] = useState({ date: todayISO(), text: '', tags: [] });
  const [saving, setSaving] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [formError, setFormError] = useState('');

  const [isAnonymous, setIsAnonymous] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');

  useEffect(() => {
    let cancelled = false;
    journalApi.list()
      .then((data) => { if (!cancelled) setEntries(data ?? []); })
      .catch((err) => { if (!cancelled) toast(apiError(err, 'Could not load your journal.'), { icon: 'warning' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    communityApi.getTags()
      .then((data) => { if (!cancelled) setTags(data ?? []); })
      .catch((err) => { if (!cancelled) toast(apiError(err, 'Could not load tags.'), { icon: 'warning' }); });
    return () => { cancelled = true; };
  }, [toast]);

  const tagLabelById = useMemo(() => {
    const map = {};
    tags.forEach((t) => { map[t.id] = t.label; });
    return map;
  }, [tags]);

  function openNewEntry() {
    tap();
    setActiveEntry(null);
    setForm({ date: todayISO(), text: '', tags: [] });
    setFormError('');
    setDeleteArmed(false);
    setSheetView('form');
    setSheetOpen(true);
  }

  function openEntry(entry) {
    tap();
    setActiveEntry(entry);
    setForm({ date: entry.date, text: entry.text, tags: entry.tags ?? [] });
    setFormError('');
    setDeleteArmed(false);
    setSheetView('form');
    setSheetOpen(true);
  }

  function closeSheet() {
    if (saving || sharing) return; // don't let a backdrop tap interrupt an in-flight save
    setSheetOpen(false);
  }

  function toggleTag(id) {
    tap();
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(id) ? f.tags.filter((t) => t !== id) : [...f.tags, id],
    }));
  }

  async function handleSave() {
    if (!form.text.trim() || saving) return;
    setSaving(true);
    setFormError('');
    try {
      const payload = { date: form.date, text: form.text.trim(), tags: form.tags };
      if (activeEntry) {
        const updated = await journalApi.update(activeEntry.id, payload);
        setEntries((prev) => prev.map((e) => (e.id === activeEntry.id ? updated : e)));
        toast('Entry updated', { icon: 'heart' });
      } else {
        const created = await journalApi.create(payload);
        setEntries((prev) => [created, ...prev]);
        toast('Entry saved', { icon: 'heart' });
      }
      confirmHaptic();
      setSheetOpen(false);
    } catch (err) {
      setFormError(apiError(err, 'Could not save this entry. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteTap() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    handleDelete();
  }

  async function handleDelete() {
    if (!activeEntry || saving) return;
    setSaving(true);
    setFormError('');
    try {
      await journalApi.remove(activeEntry.id);
      setEntries((prev) => prev.filter((e) => e.id !== activeEntry.id));
      warn();
      toast('Entry deleted', { icon: 'trash' });
      setSheetOpen(false);
    } catch (err) {
      setFormError(apiError(err, 'Could not delete this entry. Please try again.'));
      setDeleteArmed(false);
    } finally {
      setSaving(false);
    }
  }

  function openShareConfirm() {
    if (!activeEntry) return;
    tap();
    setIsAnonymous(true);
    setShareError('');
    setSheetView('share');
  }

  function handleToggleAnonymous() {
    if (isAnonymous) {
      // Flipping from anonymous to real-name — give the identity hook a chance
      // to warn first (it caps this at twice per account, then just proceeds).
      guardToggleOff(() => setIsAnonymous(false));
    } else {
      setIsAnonymous(true);
      tap();
    }
  }

  async function handleShareConfirm() {
    if (!activeEntry || sharing) return;
    setSharing(true);
    setShareError('');
    try {
      const post = await journalApi.share(activeEntry.id, { isAnonymous });
      setEntries((prev) => prev.map((e) => (e.id === activeEntry.id ? { ...e, sharedAsPostId: post.id } : e)));
      confirmHaptic();
      toast('Shared to community', { icon: 'heart' });
      setSheetOpen(false);
      navigate(`/community/${post.id}`);
    } catch (err) {
      setShareError(apiError(err, 'Could not share this entry. Please try again.'));
    } finally {
      setSharing(false);
    }
  }

  function viewSharedPost() {
    if (!activeEntry?.sharedAsPostId) return;
    setSheetOpen(false);
    navigate(`/community/${activeEntry.sharedAsPostId}`);
  }

  const sheetTitle = sheetView === 'share'
    ? 'Share to community'
    : activeEntry ? 'Edit entry' : 'New entry';

  return (
    <div className="screen screen--light">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={FADE_UP_TRANSITION}
        >
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>My journal</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
            A private space for your thoughts. Only you can see it, unless you choose to share.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...FADE_UP_TRANSITION, delay: 0.05 }}
        >
          <button className="btn btn--primary" onClick={openNewEntry}>
            + New entry
          </button>
        </motion.div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} aria-busy="true" aria-label="Loading your journal">
            {[0, 1, 2].map((i) => (
              <JournalSkeleton key={i} reduce={reduce} delay={i * 0.08} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...FADE_UP_TRANSITION, delay: 0.1 }}
          >
            <EmptyState onStart={openNewEntry} />
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...FADE_UP_TRANSITION, delay: Math.min(i * 0.04, 0.3) }}
              >
                <EntryCard entry={entry} tagLabelById={tagLabelById} onOpen={() => openEntry(entry)} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={closeSheet} title={sheetTitle}>
        {sheetView === 'share' ? (
          <ShareConfirm
            isAnonymous={isAnonymous}
            onToggle={handleToggleAnonymous}
            onConfirm={handleShareConfirm}
            onBack={() => setSheetView('form')}
            sharing={sharing}
            shareError={shareError}
          />
        ) : (
          <EntryForm
            form={form}
            setForm={setForm}
            tags={tags}
            toggleTag={toggleTag}
            saving={saving}
            formError={formError}
            onSave={handleSave}
            isEditing={!!activeEntry}
            sharedAsPostId={activeEntry?.sharedAsPostId}
            onShare={openShareConfirm}
            onViewShared={viewSharedPost}
            deleteArmed={deleteArmed}
            onDeleteTap={handleDeleteTap}
          />
        )}
      </BottomSheet>

      <IdentityWarningSheet open={warningOpen} onConfirm={confirmWarning} onCancel={cancelWarning} />
    </div>
  );
}

function EntryCard({ entry, tagLabelById, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
        padding: 'var(--sp-4) var(--sp-5)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-lg)', cursor: 'pointer', minHeight: 44,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {formatDate(entry.date)}
        </span>
        {entry.sharedAsPostId && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-1)',
            fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-sage)',
            background: 'var(--clr-sage-soft)', padding: '2px var(--sp-2)', borderRadius: 'var(--radius-full)',
          }}>
            <ShareIcon /> Shared
          </span>
        )}
      </div>
      <p style={{
        fontSize: 'var(--text-sm)', color: 'var(--clr-ink)', lineHeight: 'var(--leading-snug)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {entry.text}
      </p>
      {entry.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          {entry.tags.map((tagId) => (
            <span key={tagId} className="chip chip--sm" style={{ cursor: 'default' }}>
              {tagLabelById[tagId] ?? tagId}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function EmptyState({ onStart }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)' }}>
      <div style={{ color: 'var(--clr-brand)', display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-4)' }} aria-hidden="true"><IconJournal size={40} /></div>
      <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-2)' }}>
        Begin your journal
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)', marginBottom: 'var(--sp-6)', textWrap: 'pretty' }}>
        Write down how you're feeling, a symptom you noticed, or a question for your next visit. It stays private to you — sharing is always your choice.
      </p>
      <button className="btn btn--primary" onClick={onStart}>
        Write your first entry
      </button>
    </div>
  );
}

function JournalSkeleton({ reduce, delay }) {
  return (
    <motion.div
      animate={reduce ? undefined : { opacity: [0.5, 0.9, 0.5] }}
      transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay }}
      style={{
        height: 84, borderRadius: 'var(--radius-lg)', background: 'var(--clr-surface-2)',
        border: '1px solid var(--clr-border)', opacity: reduce ? 0.7 : undefined,
      }}
      aria-hidden="true"
    />
  );
}

function EntryForm({
  form, setForm, tags, toggleTag, saving, formError, onSave,
  isEditing, sharedAsPostId, onShare, onViewShared, deleteArmed, onDeleteTap,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="input-group">
        <label className="input-label" htmlFor="journal-date">Date</label>
        <input
          id="journal-date"
          className="input-field"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="journal-text">What's on your mind?</label>
        <textarea
          id="journal-text"
          value={form.text}
          onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          placeholder="Write freely — this stays private unless you choose to share it."
          rows={6}
          style={{
            width: '100%', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--clr-surface-2)', border: '1.5px solid var(--clr-border)',
            color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none',
            resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
            transition: 'border-color var(--dur-fast)',
          }}
        />
      </div>

      {tags.length > 0 && (
        <div>
          <p className="input-label" style={{ marginBottom: 'var(--sp-2)' }}>Tags</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            {tags.map((tag) => {
              const active = form.tags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`chip${active ? ' chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {formError && (
        <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.55 0.18 24)' }}>
          {formError}
        </p>
      )}

      <button className="btn btn--primary" onClick={onSave} disabled={!form.text.trim() || saving}>
        {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save entry'}
      </button>

      {isEditing && (
        sharedAsPostId ? (
          <button className="btn btn--ghost" onClick={onViewShared}>
            View shared post →
          </button>
        ) : (
          <button className="btn btn--ghost" onClick={onShare}>
            Share to community
          </button>
        )
      )}

      {isEditing && (
        <button
          className="btn btn--secondary"
          onClick={onDeleteTap}
          disabled={saving}
          style={deleteArmed ? { background: 'var(--clr-emergency-soft)', color: 'var(--clr-emergency)' } : undefined}
          aria-label={deleteArmed ? 'Tap again to permanently delete this entry' : 'Delete this entry'}
        >
          {deleteArmed ? 'Tap again to delete' : 'Delete entry'}
        </button>
      )}
    </div>
  );
}

function ShareConfirm({ isAnonymous, onToggle, onConfirm, onBack, sharing, shareError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
          This publishes a copy of this entry to the community feed. Your private journal entry stays exactly as it is — sharing never deletes or changes it.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)', padding: 'var(--sp-2) 0' }}>
        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>Post anonymously</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
            {isAnonymous ? 'Your name will be hidden' : 'Your name will be shown'}
          </p>
        </div>
        <button
          className={`toggle${isAnonymous ? ' toggle--on' : ''}`}
          onClick={onToggle}
          aria-pressed={isAnonymous}
          aria-label="Toggle posting anonymously"
        >
          <div className="toggle__knob" />
        </button>
      </div>

      {shareError && (
        <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.55 0.18 24)' }}>
          {shareError}
        </p>
      )}

      <button className="btn btn--primary" onClick={onConfirm} disabled={sharing}>
        {sharing ? 'Sharing…' : 'Share to community'}
      </button>
      <button className="btn btn--ghost" onClick={onBack} disabled={sharing}>
        Back
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" />
      <line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
    </svg>
  );
}
