/**
 * Supported country codes for practitioner phone numbers and authentication.
 */
export const COUNTRY_CODES = [
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India', placeholder: '98765 43210', len: 10 },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States', placeholder: '202 555 0123', len: 10 },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom', placeholder: '7911 123456', len: 10 },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE', placeholder: '50 123 4567', len: 9 },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada', placeholder: '416 555 0199', len: 10 },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia', placeholder: '412 345 678', len: 9 },
  { code: 'SG', dial: '+65', flag: '🇸🇬', name: 'Singapore', placeholder: '8123 4567', len: 8 },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // India (+91)
