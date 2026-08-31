import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../components/Toast';
import { insuranceApi } from '../services/insuranceApi';
import { apiError } from '../services/api';
import {
  COUNTRIES, PAYER_TYPES, INDIA_SCHEMES, RELATIONSHIPS,
  emptyPolicy, validate, expiryState, isInternational,
} from '../lib/insurance';
import { confirm as confirmHaptic } from '../lib/haptics';
import { IconShield, IconAlert } from '../icons.jsx';

/**
 * Her coverage. One policy, saved once, reused at every booking.
 *
 * The screen leads with what Amruni actually does — she pays, we produce a
 * claim-ready receipt, she claims it back — because a woman in Dubai reading
 * the word "insurance" on a health app will otherwise reasonably assume
 * cashless billing, and find out she was wrong at the payment sheet.
 */
export default function Insurance() {
  const navigate = useNavigate();
  const toast = useToast();

  const [policy, setPolicy] = useState(emptyPolicy());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    insuranceApi.get()
      .then((res) => { if (!cancelled && res?.country) setPolicy({ ...emptyPolicy(), ...res }); })
      .catch(() => { /* nothing on file yet, or offline — the blank form is right */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function set(field, value) {
    setPolicy((p) => ({ ...p, [field]: value }));
    setTouched(true);
    // Clear this field's error as she fixes it, leaving the others standing.
    if (errors[field]) {
      setErrors((prev) => Object.fromEntries(
        Object.entries(prev).filter(([key]) => key !== field),
      ));
    }
  }

  async function save() {
    const found = validate(policy);
    setErrors(found);
    if (Object.keys(found).length) {
      toast('A couple of fields still need filling', { icon: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await insuranceApi.save(policy);
      confirmHaptic();
      toast('Coverage saved', { icon: 'check' });
      navigate(-1);
    } catch (err) {
      toast(apiError(err, 'Could not save that. Please try again.'), { icon: 'warning' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await insuranceApi.remove();
      setPolicy(emptyPolicy());
      toast('Coverage removed', { icon: 'trash' });
    } catch (err) {
      toast(apiError(err, 'Could not remove that.'), { icon: 'warning' });
    } finally {
      setSaving(false);
    }
  }

  const payer = policy.payerType;
  const claiming = payer && payer !== 'self';
  const abroad = isInternational(policy);
  const expiry = expiryState(policy);

  if (loading) {
    return (
      <div className="screen screen--light">
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: 'var(--sp-6)' }}>
          <div className="skeleton" style={{ height: 120 }} />
          <div className="skeleton" style={{ height: 220, marginTop: 'var(--sp-4)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--light">
      <Header onBack={() => navigate(-1)} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-24)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
      >
        {/* What this feature is, before she fills anything in. */}
        <div className="coverage-explainer">
          <div className="coverage-explainer__icon"><IconShield size={20} /></div>
          <div>
            <p className="coverage-explainer__title">How this works</p>
            <p className="coverage-explainer__body">
              You pay for the consultation yourself. We put your policy details on a claim-ready
              receipt with your practitioner, diagnosis, date and amount, and you send it to your
              insurer for reimbursement. Amruni does not bill your insurer directly.
            </p>
          </div>
        </div>

        <Field label="Where do you live?" error={errors.country}>
          <select
            className="input-field"
            value={policy.country}
            onChange={(e) => set('country', e.target.value)}
            aria-label="Country of residence"
          >
            <option value="">Choose a country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </Field>

        {abroad && (
          <div className="coverage-note">
            You are consulting from outside India. Your practitioner is registered in India and
            prescribes under Indian telemedicine guidelines — check that your insurer reimburses
            overseas teleconsultations before you rely on it.
          </div>
        )}

        <Field label="Who covers your care?" error={errors.payerType}>
          <div className="payer-tiles">
            {PAYER_TYPES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`payer-tile${payer === p.id ? ' payer-tile--active' : ''}`}
                onClick={() => set('payerType', p.id)}
                aria-pressed={payer === p.id}
              >
                <span className="payer-tile__label">{p.label}</span>
                <span className="payer-tile__desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </Field>

        {claiming && (
          <>
            <Field
              label={payer === 'government' ? 'Scheme' : 'Insurer'}
              error={errors.insurer}
            >
              <input
                className="input-field"
                type="text"
                value={policy.insurer}
                onChange={(e) => set('insurer', e.target.value)}
                placeholder={payer === 'government' ? 'Ayushman Bharat, NHS, Medicare…' : 'Star Health, Daman, Bupa, Aetna…'}
                list={payer === 'government' && policy.country === 'IN' ? 'india-schemes' : undefined}
                maxLength={80}
              />
              {payer === 'government' && policy.country === 'IN' && (
                <datalist id="india-schemes">
                  {INDIA_SCHEMES.map((s) => <option key={s} value={s} />)}
                </datalist>
              )}
            </Field>

            <Field label="Plan name" hint="Optional — helps your insurer find the policy faster">
              <input
                className="input-field"
                type="text"
                value={policy.planName}
                onChange={(e) => set('planName', e.target.value)}
                placeholder="e.g. Family Health Optima"
                maxLength={80}
              />
            </Field>

            {payer !== 'government' && (
              <Field label="Policy number" error={errors.policyNumber}>
                <input
                  className="input-field"
                  type="text"
                  value={policy.policyNumber}
                  onChange={(e) => set('policyNumber', e.target.value)}
                  placeholder="As printed on your card"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={40}
                />
              </Field>
            )}

            <Field
              label={payer === 'government' ? 'Beneficiary / member ID' : 'Member ID'}
              error={errors.memberId}
              hint={payer === 'government' ? undefined : 'Optional if it is the same as your policy number'}
            >
              <input
                className="input-field"
                type="text"
                value={policy.memberId}
                onChange={(e) => set('memberId', e.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
              />
            </Field>

            {payer === 'employer' && (
              <Field label="Group number" hint="On the card, usually near the employer name">
                <input
                  className="input-field"
                  type="text"
                  value={policy.groupNumber}
                  onChange={(e) => set('groupNumber', e.target.value)}
                  autoComplete="off"
                  maxLength={40}
                />
              </Field>
            )}

            {policy.country === 'IN' && payer === 'private' && (
              <Field label="TPA" hint="Third-party administrator, if your policy names one">
                <input
                  className="input-field"
                  type="text"
                  value={policy.tpa}
                  onChange={(e) => set('tpa', e.target.value)}
                  placeholder="e.g. Medi Assist, Paramount"
                  maxLength={60}
                />
              </Field>
            )}

            <Field label="Whose policy is it?">
              <div className="chip-row">
                {RELATIONSHIPS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`chip chip--sm${policy.relationship === r ? ' chip--active' : ''}`}
                    onClick={() => set('relationship', r)}
                    aria-pressed={policy.relationship === r}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Field>

            {policy.relationship !== 'Myself' && (
              <Field label="Policy holder’s full name" hint="Exactly as it appears on the policy">
                <input
                  className="input-field"
                  type="text"
                  value={policy.policyHolder}
                  onChange={(e) => set('policyHolder', e.target.value)}
                  maxLength={80}
                />
              </Field>
            )}

            <Field label="Valid until" error={errors.validTill} hint="Optional — we will warn you before it lapses">
              <input
                className="input-field"
                type="date"
                value={policy.validTill}
                onChange={(e) => set('validTill', e.target.value)}
              />
            </Field>

            {expiry && expiry.state !== 'ok' && (
              <div className={`coverage-expiry coverage-expiry--${expiry.state}`} role="alert">
                <IconAlert size={16} />
                <span>
                  {expiry.state === 'expired'
                    ? 'This policy has already expired. A claim against it will be refused.'
                    : `${expiry.label}. Renew before your next consultation if you plan to claim.`}
                </span>
              </div>
            )}

            <Field label="Anything else" hint="Optional — pre-authorisation rules, a claims email, a reference">
              <textarea
                className="intake-textarea"
                rows={3}
                value={policy.notes}
                onChange={(e) => set('notes', e.target.value)}
                maxLength={400}
              />
            </Field>
          </>
        )}

        {payer === 'self' && (
          <div className="coverage-note">
            Nothing more to record. You will still get a full receipt after every consultation, which
            is enough for most reimbursement claims if that changes later.
          </div>
        )}

        <p className="coverage-privacy">
          Your policy details are encrypted on our servers and shown only to you and to the
          practitioner you consult. We never show the full number back to you outside a receipt.
        </p>
      </motion.div>

      <div className="action-footer">
        {!touched && policy.payerType && (
          <button type="button" className="btn btn--secondary action-footer__back" onClick={remove} disabled={saving}>
            Remove
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save coverage'}
        </button>
      </div>
    </div>
  );
}

function Header({ onBack }) {
  return (
    <div className="screen-header-nav">
      <button className="nav-back-btn" onClick={onBack} aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <span className="nav-header-title">Insurance & coverage</span>
      <div style={{ width: 40 }} />
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div className="input-group">
      <label className="input-label">{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
