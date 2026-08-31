import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { insuranceApi } from '../services/insuranceApi';
import { apiError } from '../services/api';
import { useToast } from '../components/Toast';
import { claimFields, countryName } from '../lib/insurance';
import { IconShield, IconSend, IconPrescription } from '../icons.jsx';

/**
 * The document she sends her insurer.
 *
 * Every clinical and financial line is assembled server-side and rendered
 * here as read-only text. Nothing on this screen is editable, and nothing is
 * filled in from the client's own state — a receipt is only worth anything to
 * an insurer if the person submitting it could not have written it.
 *
 * This is also the one screen in the app that shows a policy number in full.
 * Everywhere else it is masked to four digits; here it is not, because a
 * masked number on a claim form is a claim that will be rejected.
 */
export default function ClaimReceipt() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    insuranceApi.receipt(appointmentId)
      .then((res) => { if (!cancelled) setReceipt(res); })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not build the receipt.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appointmentId]);

  async function share() {
    const text = asPlainText(receipt);
    // Share sheet where the platform has one, clipboard where it does not.
    // Both beat a "download" that a mobile browser drops into a folder she
    // will never find again.
    try {
      if (navigator.share) {
        await navigator.share({ title: `Amruni receipt ${receipt.receiptNo}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast('Receipt copied — paste it into your claim', { icon: 'check' });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Could not share that.', { icon: 'warning' });
    }
  }

  if (loading) {
    return (
      <div className="screen screen--light">
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="screen screen--light">
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: 'var(--sp-8) var(--sp-6)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>
            No receipt for this consultation
          </p>
          <p style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)' }}>
            {error || 'A receipt is available once the consultation is paid for and confirmed.'}
          </p>
          <button className="btn btn--secondary" style={{ width: 'auto', margin: 'var(--sp-5) auto 0' }} onClick={() => navigate('/home')}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const { policy, consultation, practitioner, payment, patient } = receipt;
  const rows = policy
    ? claimFields(
        { ...policy, country: policy.country },
        {
          patientName: patient.name,
          doctorName: practitioner.name,
          doctorSpecialty: practitioner.specialty,
          date: consultation.date,
          mode: consultation.mode,
          diagnosis: consultation.diagnosis,
          amount: `${payment.currency} ${payment.amount}`,
          receiptNo: receipt.receiptNo,
        },
      )
    : [];

  return (
    <div className="screen screen--light">
      <Header onBack={() => navigate(-1)} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-24)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}
      >
        <div className="receipt-head">
          <div className="receipt-head__mark"><IconPrescription size={20} /></div>
          <p className="receipt-head__no">{receipt.receiptNo}</p>
          <p className="receipt-head__meta">
            {practitioner.name} · {consultation.date}
          </p>
          <p className="receipt-head__amount">{payment.currency} {payment.amount}</p>
          <span className={`receipt-head__status receipt-head__status--${payment.status}`}>
            {payment.status === 'paid' ? 'Paid' : payment.status}
          </span>
        </div>

        {patient.note && <div className="coverage-note">{patient.note}</div>}

        {!policy && (
          <div className="coverage-explainer">
            <div className="coverage-explainer__icon"><IconShield size={20} /></div>
            <div>
              <p className="coverage-explainer__title">No policy on file</p>
              <p className="coverage-explainer__body">
                This receipt is complete as proof of payment. Add your insurance and future receipts
                will also carry your policy details, which is what most insurers ask for.
              </p>
              <button
                className="btn btn--secondary btn--sm"
                style={{ width: 'auto', marginTop: 'var(--sp-3)' }}
                onClick={() => navigate('/insurance')}
              >
                Add insurance
              </button>
            </div>
          </div>
        )}

        <section>
          <p className="section-title">Consultation</p>
          <div className="receipt-table">
            <Row label="Practitioner" value={practitioner.name} />
            <Row label="Qualification" value={practitioner.experience} />
            <Row label="Discipline" value={practitioner.specialty} />
            <Row label="Registered in" value={practitioner.country} />
            <Row label="Date" value={consultation.date} />
            <Row label="Time" value={consultation.time} />
            <Row label="Mode" value={consultation.mode === 'chat' ? 'Teleconsultation (messaging)' : 'Teleconsultation (video)'} />
            <Row label="Reason given" value={consultation.reason} />
            <Row label="Diagnosis" value={consultation.diagnosis} pending="Your practitioner has not written the summary yet" />
            <Row label="Follow-up" value={consultation.followUp} />
          </div>
        </section>

        <section>
          <p className="section-title">Payment</p>
          <div className="receipt-table">
            <Row label="Amount" value={`${payment.currency} ${payment.amount}`} />
            <Row label="Status" value={payment.status} />
            <Row label="Paid on" value={payment.paidAt ? new Date(payment.paidAt).toLocaleString('en-IN') : null} />
            <Row label="Reference" value={payment.reference} />
          </div>
        </section>

        {policy && (
          <section>
            <p className="section-title">Policy</p>
            <div className="receipt-table">
              {rows
                .filter(([label]) => !['Practitioner', 'Qualification', 'Consultation date', 'Mode', 'Diagnosis', 'Amount paid', 'Receipt number', 'Patient'].includes(label))
                .map(([label, value]) => <Row key={label} label={label} value={String(value)} />)}
              <Row label="Country of residence" value={countryName(policy.country)} />
            </div>
            <p className="receipt-warning">
              Your full policy number appears on this page because a claim needs it. Take care where
              you share it.
            </p>
          </section>
        )}

        <p className="receipt-disclaimer">{receipt.disclaimer}</p>
      </motion.div>

      <div className="action-footer">
        <button className="btn btn--primary" onClick={share}>
          <IconSend size={17} style={{ marginRight: 8, verticalAlign: '-3px' }} />
          Send to my insurer
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
      <span className="nav-header-title">Claim receipt</span>
      <div style={{ width: 40 }} />
    </div>
  );
}

function Row({ label, value, pending }) {
  if (!value && !pending) return null;
  return (
    <div className="receipt-row">
      <span className="receipt-row__label">{label}</span>
      <span className={`receipt-row__value${!value ? ' receipt-row__value--pending' : ''}`}>
        {value || pending}
      </span>
    </div>
  );
}

/** The receipt as text, for the share sheet and the clipboard. */
function asPlainText(receipt) {
  const { policy, consultation, practitioner, payment } = receipt;
  const lines = [
    `AMRUNI CONSULTATION RECEIPT — ${receipt.receiptNo}`,
    '',
    `Practitioner:  ${practitioner.name} (${practitioner.specialty}), registered in ${practitioner.country}`,
    `Date:          ${consultation.date} ${consultation.time ?? ''}`.trim(),
    `Mode:          ${consultation.mode === 'chat' ? 'Teleconsultation (messaging)' : 'Teleconsultation (video)'}`,
    consultation.diagnosis ? `Diagnosis:     ${consultation.diagnosis}` : null,
    `Amount:        ${payment.currency} ${payment.amount} (${payment.status})`,
    payment.reference ? `Reference:     ${payment.reference}` : null,
  ];
  if (policy) {
    lines.push(
      '',
      'POLICY',
      `Insurer:       ${policy.insurer ?? ''}`,
      policy.planName ? `Plan:          ${policy.planName}` : null,
      policy.policyNumber ? `Policy no:     ${policy.policyNumber}` : null,
      policy.memberId ? `Member ID:     ${policy.memberId}` : null,
      policy.groupNumber ? `Group no:      ${policy.groupNumber}` : null,
      `Holder:        ${policy.policyHolder ?? ''} (${policy.relationship ?? 'Myself'})`,
    );
  }
  lines.push('', receipt.disclaimer);
  return lines.filter((l) => l !== null).join('\n');
}
