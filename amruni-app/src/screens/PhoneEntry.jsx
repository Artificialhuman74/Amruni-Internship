import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';

export default function PhoneEntry() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = /^[6-9]\d{9}$/.test(phone);

  function handleChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    dispatch({ type: 'SET_AUTH', payload: { phone } });
    setLoading(false);
    navigate('/otp');
  }

  return (
    <div className="screen screen--soft">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--sp-8) var(--sp-6)', paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-10))' }}>

        {/* Brand mark */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Logo size={40} variant="light" />
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-10)' }}
        >
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 600,
            color: 'var(--clr-ink)',
            lineHeight: 'var(--leading-tight)',
            textWrap: 'balance',
          }}>
            Your health,<br />starting here.
          </h1>
          <p style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--text-base)',
            color: 'var(--clr-ink-muted)',
            lineHeight: 'var(--leading-base)',
          }}>
            Enter your mobile number to receive a one-time code.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-10)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
          noValidate
        >
          <div className="input-group">
            <label className="input-label" style={{ color: 'var(--clr-ink-muted)' }}>
              Mobile number
            </label>
            <div className="phone-row">
              <div className="phone-prefix">
                <span style={{ fontSize: 'var(--text-base)' }}>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                className="input-field input-field--dark"
                style={{ flex: 1 }}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={phone.replace(/(\d{5})(\d{1,5})/, '$1 $2')}
                onChange={handleChange}
                aria-label="Mobile number"
                aria-describedby={error ? 'phone-error' : undefined}
                aria-invalid={!!error}
              />
            </div>
            {error && (
              <motion.p
                id="phone-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.70 0.15 24)', marginTop: 'var(--sp-1)' }}
              >
                {error}
              </motion.p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={!isValid || loading}
            style={{ marginTop: 'var(--sp-2)' }}
          >
            {loading ? <Spinner /> : 'Send OTP'}
          </button>
        </motion.form>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--clr-ink-subtle)',
            textAlign: 'center',
            lineHeight: 'var(--leading-base)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--sp-6))',
          }}
        >
          By continuing you agree to Amruni's{' '}
          <span style={{ color: 'var(--clr-ink-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
            Privacy Policy
          </span>
          . Your data is never sold.
        </motion.p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M10 2a8 8 0 018 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
