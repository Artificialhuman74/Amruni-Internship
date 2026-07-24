import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doctorApi, doctorApiError, getDoctorToken } from '../../services/doctorApi';
import OTPInput from '../../components/OTPInput';
import Logo from '../../components/Logo';
import { confirm as confirmHaptic } from '../../lib/haptics';
import { patientAppHref } from '../../lib/siteLinks';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // phone | otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);

  if (getDoctorToken()) {
    return <Navigate to="/today" replace />;
  }

  async function sendOtp(e) {
    e?.preventDefault();
    if (!isValidPhone) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await doctorApi.requestOtp(phone);
      setDevOtp(res.devCode || null);
      setStep('otp');
      setOtp('');
    } catch (err) {
      setError(doctorApiError(err, 'Could not send the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function verify(code) {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError('');
    try {
      await doctorApi.verifyOtp(phone, code);
      confirmHaptic();
      navigate('/today', { replace: true });
    } catch (err) {
      setError(doctorApiError(err, "That code didn't match. Try again."));
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen screen--soft">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--sp-8) var(--sp-6)', paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-10))' }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
          <Logo size={40} variant="light" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-10)' }}
        >
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-gold)', marginBottom: 'var(--sp-2)' }}>
            Practitioner console
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)', textWrap: 'balance' }}>
            {step === 'phone' ? 'Welcome back, doctor.' : 'Enter the code'}
          </h1>
          <p style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)' }}>
            {step === 'phone'
              ? 'Sign in with your registered practice number.'
              : <>Sent to <strong style={{ color: 'var(--clr-ink)' }}>+91 {phone.slice(0, 2)}••• •••{phone.slice(-3)}</strong></>}
          </p>
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 'phone' ? (
            <motion.form
              key="phone"
              onSubmit={sendOtp}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 'var(--sp-10)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
              noValidate
            >
              <div className="input-group">
                <label className="input-label">Registered mobile number</label>
                <div className="phone-row">
                  <div className="phone-prefix"><span style={{ fontSize: 'var(--text-base)' }}>🇮🇳</span><span>+91</span></div>
                  <input
                    className="input-field input-field--dark"
                    style={{ flex: 1 }}
                    type="tel"
                    inputMode="tel"
                    placeholder="98765 43210"
                    value={phone.replace(/(\d{5})(\d{1,5})/, '$1 $2')}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                    aria-label="Registered mobile number"
                    aria-invalid={!!error}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn--primary" disabled={!isValidPhone || loading}>
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 'var(--sp-10)' }}
            >
              <OTPInput
                value={otp}
                onChange={(val) => { setOtp(val); setError(''); if (val.length === 6) verify(val); }}
                error={!!error}
                disabled={loading}
              />
              {devOtp && (
                <p style={{ marginTop: 'var(--sp-4)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>
                  Dev: use <strong style={{ color: 'var(--clr-gold)', fontFamily: 'monospace' }}>{devOtp}</strong>
                </p>
              )}
              <button
                className="btn btn--ghost btn--sm"
                style={{ margin: 'var(--sp-4) auto 0', display: 'block' }}
                onClick={() => { setStep('phone'); setError(''); }}
              >
                Change number
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--text-sm)', color: 'oklch(0.55 0.18 24)', textAlign: 'center' }}>
            {error}
          </motion.p>
        )}

        <div style={{ flex: 1 }} />
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', textAlign: 'center', paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--sp-6))' }}>
          Looking for care instead?{' '}
          <a href={patientAppHref} style={{ color: 'var(--clr-ink-muted)', textDecoration: 'underline', fontSize: 'inherit' }}>
            Go to the patient app
          </a>
        </p>
      </div>
    </div>
  );
}
