import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import OTPInput from '../components/OTPInput';
import SuccessCheck from '../components/SuccessCheck';
import { confirm } from '../lib/haptics';

const DEV_OTP = '123456';
const RESEND_SEC = 30;

export default function OTPVerify() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const phone = state.auth.phone;

  const [otp, setOtp] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SEC);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verify = useCallback(async (code) => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(false);
    setErrorMsg('');
    await new Promise(r => setTimeout(r, 900));

    const isMatch = (code === DEV_OTP) || (phone === '6767676767' && code === '676767');

    if (isMatch) {
      setVerified(true);
      confirm();
      dispatch({ type: 'SET_AUTH', payload: { isAuthenticated: true } });
      await new Promise(r => setTimeout(r, 400));
      if (state.user.isOnboarded) {
        navigate('/home', { replace: true });
      } else {
        navigate('/onboarding/stage', { replace: true });
      }
    } else {
      setError(true);
      setErrorMsg("That code didn't match. Try again or request a new one.");
      setOtp('');
    }
    setLoading(false);
  }, [navigate, dispatch, state.user.isOnboarded, phone]);

  function handleChange(val) {
    setOtp(val);
    setError(false);
    setErrorMsg('');
    if (val.length === 6 && !loading) verify(val);
  }

  async function handleResend() {
    setResending(true);
    setOtp('');
    setError(false);
    setErrorMsg('');
    await new Promise(r => setTimeout(r, 800));
    setCountdown(RESEND_SEC);
    setResending(false);
  }

  function handleBack() {
    navigate('/phone');
  }

  const maskedPhone = phone ? `+91 ${phone.slice(0, 2)}••• •••${phone.slice(-3)}` : '';

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

        {/* Status / verify button */}
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
          {!loading && !verified && otp.length === 6 && error && (
            <button
              className="btn btn--primary"
              onClick={() => verify(otp)}
              disabled={otp.length !== 6}
            >
              Try again
            </button>
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
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
              Resend code in <strong style={{ color: 'var(--clr-ink-muted)' }}>{countdown}s</strong>
            </p>
          ) : (
            <button
              className="btn btn--ghost btn--sm"
              onClick={handleResend}
              disabled={resending}
              style={{ color: 'var(--clr-gold)', margin: '0 auto' }}
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
          <p style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>
            Dev: use <strong style={{ color: 'var(--clr-gold)', fontFamily: 'monospace' }}>{phone === '6767676767' ? '676767' : '123456'}</strong>
          </p>
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

