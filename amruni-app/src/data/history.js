/**
 * The sections of her health history, as both sides name them.
 *
 * Ids match CATEGORIES in server/app/routes_history.py exactly — the server
 * compares ids and nothing else, so a label can be reworded freely here but an
 * id cannot be renamed on one side only.
 *
 * `patient` is how the section is offered to her when she chooses what to
 * share; `doctor` is how it is named on the chart, including when it is
 * withheld ("Allergies — not shared").
 */
export const HISTORY_CATEGORIES = [
  { id: 'conditions', patient: 'Health conditions', doctor: 'Conditions & blood group', hint: 'PCOS, thyroid, diabetes, blood group' },
  { id: 'allergies', patient: 'Allergies', doctor: 'Allergies', hint: 'Medicines, foods, anything else' },
  { id: 'medications', patient: 'Medicines', doctor: 'Medicines', hint: 'What you take now and have taken before' },
  { id: 'procedures', patient: 'Surgeries & hospital stays', doctor: 'Surgeries & hospital stays', hint: 'Operations, admissions, deliveries' },
  { id: 'family', patient: 'Family history', doctor: 'Family history (patient-reported)', hint: 'Illnesses in your family' },
  { id: 'consultations', patient: 'Notes from other doctors', doctor: 'Records from other doctors', hint: 'Consultations on Amruni with other doctors' },
  { id: 'documents', patient: 'Documents', doctor: 'Documents', hint: 'Prescriptions, lab reports, scans' },
  { id: 'notes', patient: 'Anything else', doctor: 'Other notes from the patient', hint: 'Whatever else you want a doctor to know' },
];

export const CATEGORY_BY_ID = Object.fromEntries(HISTORY_CATEGORIES.map((c) => [c.id, c]));

/** Document types, in the order a doctor usually wants them. */
export const DOC_KINDS = [
  { id: 'prescription', label: 'Prescriptions', one: 'Prescription' },
  { id: 'lab', label: 'Lab reports', one: 'Lab report' },
  { id: 'scan', label: 'Scans & imaging', one: 'Scan' },
  { id: 'discharge', label: 'Discharge summaries', one: 'Discharge summary' },
  { id: 'report', label: 'Other reports', one: 'Report' },
  { id: 'other', label: 'Other documents', one: 'Document' },
];

export const DOC_KIND_BY_ID = Object.fromEntries(DOC_KINDS.map((k) => [k.id, k]));

export const SHARE_MODES = {
  all: { label: 'Share my full history', short: 'Full history shared' },
  selected: { label: 'Share only what I choose', short: 'Limited history shared' },
  none: { label: 'Don’t share my history', short: 'No history shared' },
};

/** Groups documents by kind, keeping each group newest first. */
export function groupDocuments(documents) {
  return DOC_KINDS
    .map((k) => ({ ...k, items: documents.filter((d) => (DOC_KIND_BY_ID[d.kind] ? d.kind : 'other') === k.id) }))
    .filter((g) => g.items.length);
}

/** How many entries each section holds, for labels like “2 on your record”. */
export function countsFor(history) {
  if (!history) return {};
  return {
    conditions: history.conditions?.length + (history.bloodGroup ? 1 : 0),
    allergies: history.allergies?.length,
    medications: (history.medications?.current?.length ?? 0) + (history.medications?.past?.length ?? 0),
    procedures: history.procedures?.length,
    family: history.family?.length,
    documents: history.documents?.length,
    notes: history.notes?.length,
  };
}
