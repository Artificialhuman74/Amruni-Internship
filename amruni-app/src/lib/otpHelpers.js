export const OTP_RESEND_COOLDOWN_SEC = 30;

const CHANNEL_TERM_RE = /\b(whatsapp|sms)\b/i;

function extractApiDetail(err) {
  const data = err?.response?.data;
  if (data?.error && typeof data.error === 'string') return data.error.trim();
  const detail = data?.detail;
  if (typeof detail === 'string') return detail.trim();
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).trim();
  return '';
}

function sanitizeOtpMessage(raw, fallback) {
  if (!raw || CHANNEL_TERM_RE.test(raw)) return fallback;
  return raw;
}

export function parseOtpCooldownSeconds(err, fallback = 0) {
  if (err?.response?.status !== 429) return fallback;
  const detail = extractApiDetail(err);
  const waitMatch = detail.match(/wait\s+(\d+)\s*s/i);
  if (waitMatch) {
    const secs = Number.parseInt(waitMatch[1], 10);
    if (Number.isFinite(secs) && secs >= 1 && secs <= 300) return secs;
  }
  const retryAfter = err?.response?.headers?.['retry-after'] ?? err?.response?.headers?.['Retry-After'];
  if (retryAfter !== undefined) {
    const secs = Number.parseInt(String(retryAfter), 10);
    if (Number.isFinite(secs) && secs >= 1 && secs <= 300) return secs;
  }
  return fallback;
}

export function remainingCooldownSec(cooldownUntil, now = Date.now()) {
  if (!Number.isFinite(cooldownUntil)) return 0;
  return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
}

export function maskOtpPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length === 10) {
    return `+91 ${local.slice(0, 2)}••• •••${local.slice(-3)}`;
  }
  if (local.length > 4) {
    return `${local.slice(0, 2)}••• •••${local.slice(-2)}`;
  }
  return local;
}

export function formatOtpRequestError(err, fallback = 'Could not send the OTP. Please try again.') {
  const status = err?.response?.status;
  const raw = extractApiDetail(err);

  if (!err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error')) {
    return {
      message: 'Cannot reach the server. Check your connection and try again.',
      cooldownSec: 0,
    };
  }

  if (status === 429) {
    const cooldownSec = parseOtpCooldownSeconds(err, 0);
    if (cooldownSec > 0) {
      return {
        message: `Please wait ${cooldownSec}s before requesting another OTP.`,
        cooldownSec,
      };
    }
    return {
      message: sanitizeOtpMessage(raw, 'Too many OTP requests right now. Try again later.'),
      cooldownSec: 0,
    };
  }

  if (status >= 500) {
    return {
      message: 'Could not send the OTP right now. Please try again in a moment.',
      cooldownSec: 0,
    };
  }

  return {
    message: sanitizeOtpMessage(raw, fallback),
    cooldownSec: 0,
  };
}

export function formatOtpVerifyError(
  err,
  fallback = "That OTP didn't match. Try again or request a new one.",
) {
  const status = err?.response?.status;
  const raw = extractApiDetail(err);

  if (!err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error')) {
    return {
      message: 'Cannot reach the server. Check your connection and try again.',
      requiresNewCode: false,
    };
  }

  const requiresNewCode = status === 429 || /\b(expired|no code was sent)\b/i.test(raw);
  if (status === 429) {
    return {
      message: 'Too many incorrect attempts. Request a new OTP.',
      requiresNewCode: true,
    };
  }

  return {
    message: sanitizeOtpMessage(raw, fallback),
    requiresNewCode,
  };
}
