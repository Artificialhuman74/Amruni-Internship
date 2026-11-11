import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';

const calls = [];
let nextResponse = { data: {} };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/src/services/appointmentApi.js') && specifier === './api') {
      return { url: 'mock://api', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock://api') {
      return {
        format: 'module',
        source: `
          export const api = {
            get: async (path, config) => globalThis.__rxApiGet(path, config),
            post: async () => ({ data: {} }),
            delete: async () => ({ data: {} }),
          };
        `,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

globalThis.__rxApiGet = async (path, config) => {
  calls.push({ path, config });
  return nextResponse;
};

const { appointmentApi } = await import('../src/services/appointmentApi.js');

test('appointmentApi exposes server-side prescription metadata, PDF blob download, and public verification', async () => {
  calls.length = 0;
  nextResponse = { data: { rxId: 'Rx_appt_1', verificationToken: 'tok.sig', verificationUrl: '/api/prescriptions/verify?token=tok.sig' } };
  const meta = await appointmentApi.getPrescriptionMeta('appt_1');
  assert.equal(meta.rxId, 'Rx_appt_1');
  assert.deepEqual(calls[0], { path: '/appointments/appt_1/prescription', config: undefined });

  const blobPayload = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  nextResponse = { data: blobPayload };
  const pdf = await appointmentApi.downloadPrescriptionPdf('appt_1');
  assert.equal(pdf, blobPayload);
  assert.deepEqual(calls[1], {
    path: '/appointments/appt_1/prescription.pdf',
    config: { responseType: 'blob' },
  });

  nextResponse = { data: { valid: true, status: 'valid', rxId: 'Rx_appt_1' } };
  const verified = await appointmentApi.verifyPrescription('tok.sig');
  assert.equal(verified.valid, true);
  assert.deepEqual(calls[2], {
    path: '/prescriptions/verify',
    config: { params: { token: 'tok.sig' } },
  });
});

test('ConsultationSummary uses real server PDF + verification link with no mock download or electronic seal claims', () => {
  const src = fs.readFileSync(new URL('../src/screens/ConsultationSummary.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Mock Prescription PDF/i);
  assert.doesNotMatch(src, /Electronically signed/i);
  assert.doesNotMatch(src, /digital seal/i);
  assert.match(src, /downloadPrescriptionPdf/);
  assert.match(src, /getPrescriptionMeta/);
  assert.match(src, /\/verify-rx/);
});

test('VerifyPrescription and PatientApp mount public /verify-rx verification flow outside auth guard', () => {
  const verifySrc = fs.readFileSync(new URL('../src/screens/VerifyPrescription.jsx', import.meta.url), 'utf8');
  const appSrc = fs.readFileSync(new URL('../src/apps/PatientApp.jsx', import.meta.url), 'utf8');
  assert.match(verifySrc, /verifyPrescription/);
  assert.match(verifySrc, /superseded/);
  assert.doesNotMatch(verifySrc, /Electronically signed/i);
  assert.doesNotMatch(verifySrc, /digital seal/i);

  const authGuardIndex = appSrc.indexOf('!isAuthenticated');
  const verifyRouteIndex = appSrc.indexOf('path="/verify-rx"');
  assert.ok(verifyRouteIndex !== -1, 'Expected /verify-rx route in PatientApp.jsx');
  assert.ok(authGuardIndex !== -1 && verifyRouteIndex < authGuardIndex, '/verify-rx must sit outside the auth guard');
});

