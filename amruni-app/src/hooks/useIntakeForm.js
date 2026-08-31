import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FORMS, allFields, completion, missingRequired, scorePrakriti,
} from '../data/intake';
import { intakeApi } from '../services/intakeApi';

/**
 * State for a multi-section intake form: answers, drafts, section navigation
 * and submission.
 *
 * ── On drafts, and the one thing they deliberately do not save ──────────
 *
 * A twelve-minute form on a phone will be interrupted. So answers are written
 * to localStorage as she types and restored when she comes back.
 *
 * Everything in a section marked `sensitive` is excluded from that draft. Her
 * account of being abused as a child is not something to leave sitting in a
 * browser store on a shared family phone, where it survives sign-out, is
 * readable by any script that ever runs on this origin, and is one "let me
 * check something on your phone" away from being read by exactly the person it
 * concerns. Those answers live in React state for as long as the screen is
 * open, go to the server when she submits, and are gone if she leaves. She is
 * told this on the section's consent gate, because a form that silently drops
 * work is its own kind of betrayal — the promise is only worth making if she
 * knows it was made.
 */
export function useIntakeForm(formId) {
  const form = FORMS[formId] ?? null;
  const draftKey = `amruni_intake_draft_${formId}`;

  // Read the draft once, during the first render, rather than in an effect.
  // An effect would render the empty form first and then replace it, which
  // shows a woman a blank page for a frame and costs a second render of a
  // forty-field form; it is also the cascading-render pattern React now warns
  // about. `formId` comes from the route and never changes under this hook.
  const initial = useMemo(() => readDraft(draftKey), [draftKey]);

  const [answers, setAnswers] = useState(initial.answers);
  const [skipped, setSkipped] = useState(initial.skipped);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [restored] = useState(Object.keys(initial.answers).length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [previous, setPrevious] = useState(null);   // last submission, if any
  const [loading, setLoading] = useState(true);

  // Field ids that must never reach localStorage. Computed once per form.
  const sensitiveIds = useMemo(() => {
    if (!form) return new Set();
    return new Set(
      form.sections.filter((s) => s.sensitive).flatMap((s) => s.fields.map((f) => f.id)),
    );
  }, [form]);

  // ── her last submission, if there is one ─────────────────────
  useEffect(() => {
    if (!form) return;
    let cancelled = false;
    intakeApi.latest(formId)
      .then((res) => { if (!cancelled) setPrevious(res?.submittedAt ? res : null); })
      .catch(() => { /* first-time, offline, or signed out — all fine */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [form, formId]);

  // ── persist (minus the sensitive sections) ───────────────────
  const persistTimer = useRef(null);
  useEffect(() => {
    if (!form || loading) return;
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const safe = Object.fromEntries(
        Object.entries(answers).filter(([id]) => !sensitiveIds.has(id)),
      );
      try {
        localStorage.setItem(draftKey, JSON.stringify({ answers: safe, skipped, at: Date.now() }));
      } catch {
        // Quota or private mode. The form still works; it just won't survive.
      }
    }, 400);
    return () => clearTimeout(persistTimer.current);
  }, [answers, skipped, form, loading, draftKey, sensitiveIds]);

  const setAnswer = useCallback((fieldId, value) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const skipSection = useCallback((sectionId) => {
    setSkipped((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    // Anything already typed into a skipped section is dropped, not hidden.
    const section = form?.sections.find((s) => s.id === sectionId);
    if (section) {
      setAnswers((prev) => {
        const next = { ...prev };
        for (const f of section.fields) delete next[f.id];
        return next;
      });
    }
  }, [form]);

  const unskipSection = useCallback((sectionId) => {
    setSkipped((prev) => prev.filter((s) => s !== sectionId));
  }, []);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch { /* nothing to clean up */ }
  }, [draftKey]);

  const discard = useCallback(() => {
    setAnswers({});
    setSkipped([]);
    setSectionIndex(0);
    clearDraft();
  }, [clearDraft]);

  const submit = useCallback(async ({ appointmentId } = {}) => {
    if (!form) throw new Error('Unknown form');
    setSubmitting(true);
    try {
      const prakriti = form.id === 'ayurveda' ? scorePrakriti(answers) : null;
      const result = await intakeApi.submit({
        formId: form.id,
        answers,
        skippedSections: skipped,
        prakriti,
        appointmentId,
      });
      clearDraft();
      return { ...result, prakriti };
    } finally {
      setSubmitting(false);
    }
  }, [form, answers, skipped, clearDraft]);

  // ── derived ──────────────────────────────────────────────────
  const visibleSections = useMemo(
    () => (form ? form.sections : []),
    [form],
  );
  const section = visibleSections[sectionIndex] ?? null;
  const progress = form ? completion(form, answers, skipped) : 0;
  const missing = form ? missingRequired(form, answers, skipped) : [];
  const canSubmit = missing.length === 0 && !submitting;

  const sectionComplete = useMemo(() => {
    if (!section) return false;
    if (skipped.includes(section.id)) return true;
    return section.fields
      .filter((f) => f.required)
      .every((f) => {
        const v = answers[f.id];
        return Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '';
      });
  }, [section, answers, skipped]);

  return {
    form,
    fields: form ? allFields(form) : [],
    sections: visibleSections,
    section,
    sectionIndex,
    setSectionIndex,
    isLast: sectionIndex === visibleSections.length - 1,
    answers,
    setAnswer,
    skipped,
    skipSection,
    unskipSection,
    progress,
    missing,
    canSubmit,
    sectionComplete,
    submitting,
    submit,
    discard,
    restored,
    previous,
    loading,
  };
}

/** The saved draft for this form, or empty state. A corrupt draft is not worth
 *  an error screen — she starts fresh. */
function readDraft(draftKey) {
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return { answers: {}, skipped: [] };
    const parsed = JSON.parse(raw);
    return { answers: parsed.answers ?? {}, skipped: parsed.skipped ?? [] };
  } catch {
    return { answers: {}, skipped: [] };
  }
}
