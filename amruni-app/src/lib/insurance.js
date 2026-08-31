/**
 * Coverage: who is paying for the consultation, and what the woman needs from
 * us in order to claim it back.
 *
 * The feature exists because doctors want to consult patients living outside
 * India, and almost all of those patients hold insurance. What that actually
 * means in practice is narrower than "we accept insurance", and the difference
 * matters enough to state here so the UI never overstates it:
 *
 *   Amruni does not bill an insurer and does not settle a claim. She pays for
 *   the consultation, and we give her a receipt and a consultation summary
 *   carrying every field a reimbursement claim asks for — insurer, policy
 *   number, member id, practitioner, date, amount, currency, diagnosis. She
 *   submits it herself.
 *
 * That is a reimbursement flow, not cashless, and every string in the UI says
 * so. Telling a woman abroad her insurance is "accepted" and then handing her
 * a bill is a worse failure than not offering the feature.
 */

// Countries where consultations are commonly claimed back, with the payer
// language each market actually uses. Ordered by expected volume for an Indian
// telemedicine practice, not alphabetically.
export const COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', domestic: true },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'QA', name: 'Qatar', currency: 'QAR' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD' },
  { code: 'OM', name: 'Oman', currency: 'OMR' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'OTHER', name: 'Somewhere else', currency: 'USD' },
];

export const PAYER_TYPES = [
  {
    id: 'private',
    label: 'Private health insurance',
    desc: 'A policy you or your family bought',
  },
  {
    id: 'employer',
    label: 'Employer or group cover',
    desc: 'Provided through work, often with a group number',
  },
  {
    id: 'government',
    label: 'Government scheme',
    desc: 'Ayushman Bharat, CGHS, ESIC, NHS, Medicare and similar',
  },
  {
    id: 'self',
    label: 'Paying myself',
    desc: 'No cover to record — you will still get a full receipt',
  },
];

// Indian schemes worth naming rather than making her type. Not exhaustive;
// the field stays free-text underneath.
export const INDIA_SCHEMES = [
  'Ayushman Bharat PM-JAY',
  'CGHS',
  'ESIC',
  'State government scheme',
];

export const RELATIONSHIPS = ['Myself', 'Spouse', 'Parent', 'Child', 'Other'];

export const emptyPolicy = () => ({
  country: '',
  payerType: '',
  insurer: '',
  planName: '',
  policyNumber: '',
  memberId: '',
  groupNumber: '',
  policyHolder: '',
  relationship: 'Myself',
  validTill: '',
  tpa: '',
  preAuthRequired: false,
  notes: '',
});

/** True once she has told us she lives outside India. */
export function isInternational(policy) {
  return !!policy?.country && policy.country !== 'IN';
}

/** Currency of the country on the policy; INR when unknown. */
export function currencyFor(countryCode) {
  return COUNTRIES.find((c) => c.code === countryCode)?.currency ?? 'INR';
}

export function countryName(countryCode) {
  return COUNTRIES.find((c) => c.code === countryCode)?.name ?? countryCode ?? '';
}

/**
 * Last four characters only, everywhere a policy or member number is shown
 * back to her.
 *
 * A policy number is the credential an insurer answers to over the phone. It
 * belongs in a field she typed into and in the claim receipt, and nowhere
 * else — not on a settings row, not in a booking summary, not in a screenshot
 * she takes of either.
 */
export function maskNumber(value) {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '•'.repeat(raw.length);
  return `•••• ${raw.slice(-4)}`;
}

/**
 * Which fields a claim actually needs, per payer type.
 *
 * `self` needs nothing — she is not claiming. Government schemes are
 * identified by a beneficiary/member id rather than a policy number, which is
 * why the required set differs.
 */
const REQUIRED_BY_PAYER = {
  private: ['country', 'insurer', 'policyNumber'],
  employer: ['country', 'insurer', 'policyNumber'],
  government: ['country', 'insurer', 'memberId'],
  self: ['country'],
};

export function validate(policy) {
  const errors = {};
  if (!policy.country) errors.country = 'Where do you live?';
  if (!policy.payerType) errors.payerType = 'Who covers your care?';

  for (const field of REQUIRED_BY_PAYER[policy.payerType] ?? []) {
    if (!String(policy[field] ?? '').trim()) {
      errors[field] = 'Needed to claim this back';
    }
  }

  if (policy.validTill) {
    const d = new Date(policy.validTill);
    if (Number.isNaN(d.getTime())) errors.validTill = 'Use a real date';
    else if (d < new Date(new Date().toDateString())) errors.validTill = 'This policy has expired';
  }
  return errors;
}

export function isValid(policy) {
  return Object.keys(validate(policy)).length === 0;
}

/** Expired, or expiring inside 30 days — surfaced before she books, not after. */
export function expiryState(policy) {
  if (!policy?.validTill) return null;
  const till = new Date(policy.validTill);
  if (Number.isNaN(till.getTime())) return null;
  const days = Math.ceil((till - new Date()) / 86400000);
  if (days < 0) return { state: 'expired', days, label: 'Expired' };
  if (days <= 30) return { state: 'soon', days, label: `Expires in ${days} day${days === 1 ? '' : 's'}` };
  return { state: 'ok', days, label: `Valid to ${till.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` };
}

/** One-line description for a settings row or a booking summary. */
export function summaryLine(policy) {
  if (!policy?.payerType) return 'Not set up yet';
  if (policy.payerType === 'self') return `Paying yourself · ${countryName(policy.country)}`;
  const who = policy.insurer || 'Insurer not named';
  const num = maskNumber(policy.policyNumber || policy.memberId);
  return num ? `${who} · ${num}` : who;
}

/**
 * The fields a reimbursement claim asks for, assembled from a policy plus a
 * consultation. Rendered on the claim receipt and nowhere else — this is the
 * one place the full policy number is deliberately shown, because it is the
 * document she sends her insurer.
 */
export function claimFields(policy, consultation) {
  return [
    ['Patient', consultation.patientName],
    ['Policy holder', policy.policyHolder || consultation.patientName],
    ['Relationship to holder', policy.relationship || 'Myself'],
    ['Insurer', policy.insurer],
    ['Plan', policy.planName],
    ['Policy number', policy.policyNumber],
    ['Member ID', policy.memberId],
    ['Group number', policy.groupNumber],
    ['TPA', policy.tpa],
    ['Country of residence', countryName(policy.country)],
    ['Practitioner', consultation.doctorName],
    ['Qualification', consultation.doctorSpecialty],
    ['Consultation date', consultation.date],
    ['Mode', consultation.mode === 'chat' ? 'Teleconsultation (messaging)' : 'Teleconsultation (video)'],
    ['Diagnosis', consultation.diagnosis],
    ['Amount paid', consultation.amount],
    ['Receipt number', consultation.receiptNo],
  ].filter(([, value]) => value != null && String(value).trim() !== '');
}
