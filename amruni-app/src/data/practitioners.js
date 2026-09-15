/**
 * Reference lists for onboarding a practitioner.
 *
 * All three were free text or a six-item preset before, and free text is where
 * a directory quietly rots: "Gynecology", "Gynaecology" and "gynae" become
 * three specialties that filter separately, and "Kanada" becomes a language no
 * patient will ever search for. Picking from a list is the fix; each list still
 * accepts something it does not contain, because no list is ever complete and
 * a practitioner who cannot be onboarded at all is worse than one typo.
 *
 * SPECIALTIES MUST KEEP THEIR EXISTING SPELLINGS. "Mental Health", "Pregnancy",
 * "Homeopathy" and the rest are matched as exact strings elsewhere — the consult
 * filters, the intake-form lookup in BookAppointment, and anonymous booking,
 * which the server honours only for "Mental Health". Renaming one here breaks
 * all of those silently. Add; do not rename.
 *
 * The clinic is sending a fuller specialty list. When it arrives it goes in
 * SPECIALTY_GROUPS below and nowhere else.
 */

export const SPECIALTY_GROUPS = [
  {
    label: "Women's health",
    items: [
      'Gynaecology', 'Pregnancy', 'Fertility', 'Menopause', 'Maternal-Fetal Medicine',
      'Reproductive Endocrinology', 'Urogynaecology', 'Breast Health', 'Lactation Consulting',
    ],
  },
  {
    label: 'Mind',
    items: [
      'Mental Health', 'Psychiatry', 'Clinical Psychology', 'Counselling',
      'Child & Adolescent Psychiatry', 'Addiction Medicine',
    ],
  },
  {
    label: 'Medicine',
    items: [
      'General Medicine', 'Family Medicine', 'Internal Medicine', 'Cardiology', 'Endocrinology',
      'Diabetology', 'Thyroid', 'Gastroenterology', 'Hepatology', 'Nephrology', 'Neurology',
      'Pulmonology', 'Rheumatology', 'Haematology', 'Oncology', 'Infectious Diseases',
      'Allergy & Immunology', 'Dermatology', 'Geriatrics', 'Paediatrics', 'Neonatology',
      'Sexual Health',
    ],
  },
  {
    label: 'Surgery',
    items: [
      'General Surgery', 'Obstetric Surgery', 'Orthopaedics', 'ENT', 'Ophthalmology', 'Urology',
      'Plastic & Reconstructive Surgery', 'Breast Surgery', 'Neurosurgery',
      'Cardiothoracic Surgery', 'Surgical Oncology', 'Dentistry',
    ],
  },
  {
    label: 'Therapy & nutrition',
    items: [
      'Nutrition & Dietetics', 'Physiotherapy', 'Pelvic Floor Physiotherapy',
      'Occupational Therapy', 'Speech Therapy',
    ],
  },
  {
    label: 'Traditional & integrative',
    items: ['Ayurveda', 'Homeopathy', 'Yoga', 'Naturopathy', 'Unani', 'Siddha', 'Reiki'],
  },
];

export const SPECIALTIES = SPECIALTY_GROUPS.flatMap((g) => g.items);

/**
 * The 22 scheduled languages of India first, then widely spoken unscheduled
 * ones, then languages a practitioner serving the diaspora may consult in.
 * Grouped so "Kannada" is found by region-familiar scanning, not only search.
 */
export const LANGUAGE_GROUPS = [
  {
    label: 'Most used',
    items: ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali'],
  },
  {
    label: 'Indian languages',
    items: [
      'Assamese', 'Bhojpuri', 'Bodo', 'Chhattisgarhi', 'Dogri', 'Gujarati', 'Haryanvi',
      'Kashmiri', 'Khasi', 'Kodava', 'Konkani', 'Maithili', 'Manipuri', 'Mizo', 'Nepali',
      'Odia', 'Punjabi', 'Rajasthani', 'Sanskrit', 'Santali', 'Sindhi', 'Tulu', 'Urdu',
    ],
  },
  {
    label: 'Other languages',
    items: [
      'Arabic', 'French', 'German', 'Japanese', 'Mandarin', 'Portuguese', 'Russian',
      'Sinhala', 'Spanish', 'Tagalog',
    ],
  },
];

export const LANGUAGES = LANGUAGE_GROUPS.flatMap((g) => g.items);

/**
 * Where a licence can be issued.
 *
 * The region list is what makes a licence mean something. In the US it is
 * mandatory — a state board licence authorises practice in that state only,
 * so a doctor licensed in New York and Tennessee needs two rows, and cannot
 * see a patient in Ohio on either. In India a State Medical Council
 * registration is regional while an NMC registration is national, so the
 * region is optional there.
 */
export const LICENCE_COUNTRIES = [
  { code: 'IN', name: 'India', regionLabel: 'State / UT', regionRequired: false },
  { code: 'US', name: 'United States', regionLabel: 'State', regionRequired: true },
  { code: 'GB', name: 'United Kingdom', regionLabel: 'Nation', regionRequired: false },
  { code: 'AE', name: 'United Arab Emirates', regionLabel: 'Emirate', regionRequired: false },
  { code: 'CA', name: 'Canada', regionLabel: 'Province', regionRequired: false },
  { code: 'AU', name: 'Australia', regionLabel: 'State', regionRequired: false },
];

export const REGIONS = {
  IN: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
    'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ],
  US: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
    'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
    'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
    'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  GB: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
};

/**
 * Suggested issuing bodies. Suggestions only — the field stays free text,
 * because the exact name of a state council varies ("Travancore-Cochin Council
 * of Modern Medicine" registers Kerala's doctors) and guessing a body's name
 * wrongly on a legal credential is worse than letting the admin type it.
 */
export const AUTHORITY_SUGGESTIONS = {
  IN: [
    'National Medical Commission (NMC)',
    'State Medical Council',
    'NCISM — Ayurveda, Unani, Siddha',
    'National Commission for Homoeopathy (NCH)',
    'Rehabilitation Council of India (RCI) — psychologists',
    'Dental Council of India',
    'Indian Nursing Council',
  ],
  US: ['State Medical Board', 'State Board of Osteopathic Medicine', 'State Board of Psychology'],
  GB: ['General Medical Council (GMC)', 'Health and Care Professions Council (HCPC)'],
  AE: ['Department of Health — Abu Dhabi', 'Dubai Health Authority', 'Ministry of Health and Prevention'],
  CA: ['College of Physicians and Surgeons'],
  AU: ['Australian Health Practitioner Regulation Agency (Ahpra)'],
};

export function countryByCode(code) {
  return LICENCE_COUNTRIES.find((c) => c.code === code) ?? LICENCE_COUNTRIES[0];
}

/** "Karnataka · Karnataka Medical Council" — one line for a list row. */
export function licenceLine(l) {
  const where = l.region || countryByCode(l.country).name;
  return `${where} · ${l.authority}`;
}

export const EMPTY_LICENCE = { country: 'IN', region: '', authority: '', number: '', expiresOn: '' };

/** A licence row is complete when the server would accept it. */
export function licenceProblem(l) {
  const c = countryByCode(l.country);
  if (!l.authority.trim()) return 'Add the issuing council or board';
  if (!l.number.trim()) return 'Add the registration number';
  if (c.regionRequired && !l.region) return `Choose the ${c.regionLabel.toLowerCase()} — a ${c.name} licence is valid only there`;
  if (l.expiresOn && l.expiresOn < new Date().toISOString().slice(0, 10)) return 'This licence has already expired';
  return null;
}
