/**
 * Cross-app links.
 *
 * Patient, practitioner and admin ship as three separate builds on three
 * domains, so links between them are absolute URLs supplied at build time.
 * When a URL isn't configured (e.g. the old single-bundle dev setup) we fall
 * back to the in-app path, so nothing dead-ends.
 */
const PATIENT_URL = import.meta.env.VITE_PATIENT_URL || '';
const DOCTOR_URL = import.meta.env.VITE_DOCTOR_URL || '';

export const patientAppHref = PATIENT_URL || '/phone';
export const doctorAppHref = DOCTOR_URL || '/doctor';

/** True when the link leaves this deployment (so we use a full page load). */
export const isExternal = (href) => /^https?:\/\//.test(href);

export function goTo(href, navigate) {
  if (isExternal(href)) window.location.assign(href);
  else navigate(href);
}
