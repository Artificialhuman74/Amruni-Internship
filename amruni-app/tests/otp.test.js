import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  OTP_RESEND_COOLDOWN_SEC,
  formatOtpRequestError,
  formatOtpVerifyError,
  maskOtpPhone,
  parseOtpCooldownSeconds,
  remainingCooldownSec,
} from '../src/lib/otpHelpers.js';

test('parseOtpCooldownSeconds extracts wait seconds from 429 detail or Retry-After header', () => {
  assert.equal(OTP_RESEND_COOLDOWN_SEC, 30);
  assert.equal(
    parseOtpCooldownSeconds({ response: { status: 429, data: { detail: 'Please wait 19s before requesting another code.' } } }),
    19,
  );
  assert.equal(
    parseOtpCooldownSeconds({ response: { status: 429, headers: { 'retry-after': '12' }, data: {} } }),
    12,
  );
  assert.equal(
    parseOtpCooldownSeconds({ response: { status: 500, data: { detail: 'Please wait 19s' } } }, 0),
    0,
  );
  assert.equal(remainingCooldownSec(100_000 + 24_200, 100_000), 25);
  assert.equal(remainingCooldownSec(90_000, 100_000), 0);
  assert.equal(remainingCooldownSec(null, 100_000), 0);
});

test('formatOtpRequestError redacts channel names and maps rate-limit, delivery, and network errors to clear OTP messages', () => {
  const deliveryErr = formatOtpRequestError({
    response: { status: 503, data: { detail: 'Could not send verification code via WhatsApp. Please try again.' } },
  });
  assert.equal(deliveryErr.cooldownSec, 0);
  assert.doesNotMatch(deliveryErr.message, /\b(whatsapp|sms)\b/i);
  assert.match(deliveryErr.message, /\bOTP\b/);

  const cooldownErr = formatOtpRequestError({
    response: { status: 429, data: { detail: 'Please wait 14s before requesting another code.' } },
  });
  assert.equal(cooldownErr.cooldownSec, 14);
  assert.equal(cooldownErr.message, 'Please wait 14s before requesting another OTP.');

  const hourlyLimitErr = formatOtpRequestError({
    response: { status: 429, data: { detail: 'Too many codes requested. Try again later.' } },
  });
  assert.equal(hourlyLimitErr.cooldownSec, 0);
  assert.doesNotMatch(hourlyLimitErr.message, /\b(whatsapp|sms)\b/i);

  const networkErr = formatOtpRequestError({ code: 'ERR_NETWORK' });
  assert.equal(networkErr.cooldownSec, 0);
  assert.match(networkErr.message, /connection/i);
});

test('formatOtpVerifyError handles invalid, expired, and locked-out OTP errors clearly', () => {
  const wrongErr = formatOtpVerifyError({
    response: { status: 401, data: { detail: "That code didn't match. Try again or request a new one." } },
  });
  assert.equal(wrongErr.requiresNewCode, false);
  assert.match(wrongErr.message, /didn't match/i);

  const expiredErr = formatOtpVerifyError({
    response: { status: 401, data: { detail: 'That code has expired. Request a new one.' } },
  });
  assert.equal(expiredErr.requiresNewCode, true);

  const lockErr = formatOtpVerifyError({
    response: { status: 429, data: { detail: 'Too many incorrect attempts. Request a new code.' } },
  });
  assert.equal(lockErr.requiresNewCode, true);
  assert.doesNotMatch(lockErr.message, /\b(whatsapp|sms)\b/i);
});

test('maskOtpPhone masks 10-digit numbers without revealing raw fallback artifacts', () => {
  assert.equal(maskOtpPhone('9876543210'), '+91 98••• •••210');
  assert.equal(maskOtpPhone('+919876543210'), '+91 98••• •••210');
  assert.equal(maskOtpPhone(''), '');
});

test('PhoneEntry and OTPVerify keep OTP-only copy with zero SMS/WhatsApp selectors or text', () => {
  const phoneSrc = fs.readFileSync(new URL('../src/screens/PhoneEntry.jsx', import.meta.url), 'utf8');
  const verifySrc = fs.readFileSync(new URL('../src/screens/OTPVerify.jsx', import.meta.url), 'utf8');
  for (const src of [phoneSrc, verifySrc]) {
    assert.doesNotMatch(src, /\b(whatsapp|sms)\b/i);
    assert.match(src, /otpHelpers/);
  }
});

