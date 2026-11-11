import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { authApi, setToken } from '../services/api';
import {
  OTP_RESEND_COOLDOWN_SEC,
  formatOtpRequestError,
  formatOtpVerifyError,
  maskOtpPhone,
  remainingCooldownSec,
} from '../lib/otpHelpers';
import OTPInput from '../components/OTPInput';
import SuccessCheck from '../components/SuccessCheck';
import { confirm } from '../lib/haptics';

export default function OTPVerify() {
  const navigate = useNavigate();
  const { state, dispatch, hydrateFromServer } = useApp();
  const phone = state.auth.phone;
  const devOtp = state.auth.devOtp;

  const [otp, setOtp] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendNotice, setResendNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(() => (
    typeof state.auth.otpCooldownUntil === 'number'
      ? remainingCooldownSec(state.auth.otpCooldownUntil)
      : OTP_RESEND_COOLDOWN_SEC
  ));
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!phone) navigate('/phone', { replace: true });
  }, [phone, navigate]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verify = useCallback(async (code) => {
    if (code.length !== 6 || loading || verified || !phone) return;
    setLoading(true);
    setError(false);
    setErrorMsg('');
    setResendNotice('');

    try {
      const res = await authApi.verifyOtp(phone, code);
      setToken(res.token);
      setVerified(true);
      confirm();
      hydrateFromServer(res, phone);
      await new Promise(r => setTimeout(r, 400));
      if (res.user.isOnboarded) {
        navigate('/home', { replace: true });
      } else {
        navigate('/onboarding/privacy', { replace: true });
      }
    } catch (err) {
      const { message, requiresNewCode } = formatOtpVerifyError(err);
      setError(true);
      setErrorMsg(message);
      setOtp('');
      if (requiresNewCode) setCountdown(0);
    } finally {
      setLoading(false);
    }
  }, [navigate, hydrateFromServer, phone, loading, verified]);

  function handleChange(val) {
    setOtp(val);
    setError(false);
    setErrorMsg('');
    setResendNotice('');
    if (val.length === 6 && !loading) verify(val);
  }

  async function handleResend() {
    if (resending || countdown > 0 || verified || !phone) return;
    setResending(true);
    setOtp('');
    setError(false);
    setErrorMsg('');
    setResendNotice('');
    try {
      const res = await authApi.requestOtp(phone);
      dispatch({
        type: 'SET_AUTH',
        payload: {
          devOtp: res.devCode || null,
          otpCooldownUntil: Date.now() + OTP_RESEND_COOLDOWN_SEC * 1000,
        },
      });
      setCountdown(OTP_RESEND_COOLDOWN_SEC);
      setResendNotice('A new OTP has been sent.');
    } catch (err) {
      const { message, cooldownSec } = formatOtpRequestError(err, 'Could not resend the OTP. Please try again.');
      setErrorMsg(message);
      if (cooldownSec > 0) setCountdown(cooldownSec);
    } finally {
      setResending(false);
    }
  }

  function handleBack() {
    navigate('/phone');
  }

  const maskedPhone = maskOtpPhone(phone);

  return (
    <div className="screen screen--soft">
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--sp-6) var(--sp-6)',
        paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-6))',
      }}>
        {/* Back */}
        <motion.button
          onClick={handleBack}
          className="btn btn--ghost btn--sm"
          style={{ alignSelf: 'flex-start', color: 'var(--clr-ink-muted)', padding: 'var(--sp-2)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          aria-label="Back"
        >
          <ChevronLeft />
        </motion.button>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-8)' }}
        >
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--clr-ink)',
            lineHeight: 'var(--leading-tight)',
          }}>
            Enter the code
          </h1>
          <p style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--text-base)',
            color: 'var(--clr-ink-muted)',
            lineHeight: 'var(--leading-base)',
          }}>
            Sent to <strong style={{ color: 'var(--clr-ink)', fontWeight: 600 }}>{maskedPhone}</strong>
          </p>
        </motion.div>

        {/* OTP */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-10)' }}
        >
          <OTPInput
            value={otp}
            onChange={handleChange}
            error={error}
            disabled={loading || verified}
          />

          {/* Error */}
          {errorMsg && (
            <motion.p
              role="alert"
              aria-live="polite"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 'var(--sp-4)',
                textAlign: 'center',
                fontSize: 'var(--text-sm)',
                color: 'oklch(0.72 0.15 24)',
              }}
            >
              {errorMsg}
            </motion.p>
          )}
        </motion.div>

        {/* Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: 'var(--sp-8)' }}
        >
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-3)', color: 'var(--clr-ink-muted)' }}>
              <Spinner />
              <span style={{ fontSize: 'var(--text-sm)' }}>Verifying…</span>
            </div>
          )}
          {verified && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-3)', color: 'var(--clr-success)' }}>
              <SuccessCheck size={24} bloom={false} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Verified! Taking you in…</span>
            </div>
          )}
        </motion.div>

        <div style={{ flex: 1 }} />

        {/* Resend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            textAlign: 'center',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--sp-8))',
          }}
        >
          {countdown > 0 ? (
            <p aria-live="polite" style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
              Resend OTP in <strong style={{ color: 'var(--clr-ink-muted)' }}>{countdown}s</strong>
            </p>
          ) : (
            <button
              className="btn btn--ghost btn--sm"
              onClick={handleResend}
              disabled={resending || verified}
              style={{ color: 'var(--clr-gold)', margin: '0 auto' }}
            >
              {resending ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
          {resendNotice && !errorMsg && (
            <p role="status" style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>
              {resendNotice}
            </p>
          )}
          {devOtp && (
            <p style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>
              Dev: use <strong style={{ color: 'var(--clr-gold)', fontFamily: 'monospace' }}>{devOtp}</strong>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

