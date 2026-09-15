import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { authApi, apiError } from '../services/api';
import CamelliaBloom from '../components/CamelliaBloom';
import {
  CUES, MOTION, clamp, DESIGN_W, DESIGN_H, FLOWER_BOX, FLOWER_SPAN, FLOWER_SETTLED, LOGO_SCALE, OUTWARD,
} from '../lib/bloomMotion';
import { doctorAppHref } from '../lib/siteLinks';
import { FlagIN } from '../icons.jsx';

/**
 * Sign-in, opened by the camellia bloom.
 *
 * The sequence is the "Camellia Bloom Login Animation" design, scene for
 * scene: the flower unfurls in the middle of the screen (Bloom), rests while
 * the wordmark settles under it (Hold), glides up and shrinks into the logo
 * position (Relocate), and the heading, number field and footer rise in behind
 * it (Reveal). Only the flower, its placement and that choreography come from
 * the design; the form, its validation and the Send OTP button are this
 * screen's own and behave exactly as before.
 *
 * Played once per browser session. Coming back from the OTP screen should not
 * mean watching seven seconds of flower again, and neither should anyone who
 * has asked the operating system to reduce motion. A tap anywhere during the
 * bloom jumps straight to the glide.
 */

const SEEN_KEY = 'amruni_bloom_seen';
const END = CUES.Rest;
const REVEAL_AT = CUES.Reveal - 0.45;

function shouldPlay() {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}

/** Fades and rises in at `at` seconds, on the design's reveal curve. */
function Reveal({ t, at, k, as: Tag = 'div', style, children, ...rest }) {
  const p = clamp(MOTION.fade(at, at + 0.55)(t), 0, 1);
  return (
    <Tag
      {...rest}
      style={{
        ...style,
        opacity: p,
        transform: p < 1 ? `translateY(${(1 - p) * 26 * k}px)` : undefined,
        // Invisible means untouchable and unannounced, so nothing can be
        // tapped or read out before it has appeared.
        visibility: p === 0 ? 'hidden' : undefined,
      }}
    >
      {children}
    </Tag>
  );
}

export default function PhoneEntry() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = /^[6-9]\d{9}$/.test(phone);

  // ── the bloom clock ─────────────────────────────────────────────
  const [play] = useState(shouldPlay);
  const [t, setT] = useState(() => (play ? 0 : END));
  const startRef = useRef(0);
  const wrapRef = useRef(null);
  const slotRef = useRef(null);
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    if (!play) return undefined;
    let raf;
    startRef.current = performance.now();
    const tick = (now) => {
      const next = Math.min((now - startRef.current) / 1000, END);
      setT(next);
      if (next < END) raf = requestAnimationFrame(tick);
      else { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ } }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play]);

  // The flower's start and end points come from the real layout — the middle
  // of this screen, and wherever the logo slot actually sits — so the glide
  // lands on the slot at any width and after any resize.
  useEffect(() => {
    const wrap = wrapRef.current;
    const slot = slotRef.current;
    if (!wrap || !slot) return undefined;
    const measure = () => {
      const k = Math.min(wrap.clientWidth, 520) / DESIGN_W;
      const span = FLOWER_SPAN * LOGO_SCALE * k;
      setGeo({
        w: wrap.clientWidth,
        h: window.innerHeight,
        k,
        span,
        cx: slot.offsetLeft + span / 2,
        cy: slot.offsetTop + span / 2,
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  function skip() {
    if (!play || t >= CUES.Relocate) return;
    startRef.current = performance.now() - CUES.Relocate * 1000;
  }

  const k = geo?.k ?? 390 / DESIGN_W;
  const mStart = CUES.Relocate;
  const mEnd = CUES.Relocate + 1.25;
  const flowerStyle = geo && {
    transform: `translate(${MOTION.glide(geo.w / 2, geo.cx, mStart, mEnd)(t)}px, ${MOTION.glide(geo.h * 0.42, geo.cy, mStart, mEnd)(t)}px)`
      + ` scale(${MOTION.glide(1, LOGO_SCALE, mStart, mEnd)(t) * MOTION.glide(1.07, 1, 0, CUES.Hold)(t)})`
      + ` rotate(${MOTION.glide(OUTWARD.spin[0], OUTWARD.spin[1], 0, CUES.Hold)(t)}deg)`,
  };
  const wordIn = clamp(MOTION.fade(CUES.Bloom + 2.5, CUES.Bloom + 3.3)(t), 0, 1);
  const wordOut = 1 - clamp(MOTION.fade(CUES.Relocate - 0.1, CUES.Relocate + 0.45)(t), 0, 1);
  const wordOpacity = wordIn * wordOut;

  function handleChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    setLoading(true);
    try {
      const res = await authApi.requestOtp(phone);
      dispatch({ type: 'SET_AUTH', payload: { phone, devOtp: res.devCode || null } });
      navigate('/otp');
    } catch (err) {
      setError(apiError(err, 'Could not send the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen screen--soft">
      <div
        ref={wrapRef}
        onPointerDown={skip}
        style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--sp-8) var(--sp-6)', paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-10))' }}
      >

        {/* The flower. Drawn once at full size and moved with a transform, so
            the bloom, the glide and the final logo are one continuous object. */}
        <div className="bloom-flower" style={{ ...flowerStyle, opacity: geo ? 1 : 0 }} aria-hidden="true">
          <div style={{ transform: 'translate(-50%, -50%)' }}>
            <CamelliaBloom t={Math.min(t, FLOWER_SETTLED)} size={FLOWER_BOX * k} halo={t < CUES.Reveal} />
          </div>
        </div>

        {/* The wordmark under the open bloom, gone before the flower moves. */}
        {play && wordOpacity > 0 && geo && (
          <div
            className="bloom-wordmark"
            aria-hidden="true"
            style={{ top: geo.h * (1240 / DESIGN_H), opacity: wordOpacity, transform: `translateY(${(1 - wordIn) * 22 * k}px)` }}
          >
            <div className="bloom-wordmark__name" style={{ fontSize: 104 * k }}>
              Am<span>r</span>uni
            </div>
            <div className="bloom-wordmark__tag" style={{ fontSize: 30 * k, marginTop: 16 * k }}>
              Women’s Health · Your Way
            </div>
          </div>
        )}

        {/* Where the flower lands. Holds the logo's space in the layout so
            nothing below shifts when it arrives. */}
        <div ref={slotRef} style={{ width: geo?.span ?? 32, height: geo?.span ?? 32, flexShrink: 0 }} />

        {/* Heading */}
        <Reveal t={t} at={REVEAL_AT} k={k} style={{ marginTop: 'var(--sp-10)' }}>
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
        </Reveal>

        {/* Form */}
        <Reveal
          as="form"
          t={t}
          at={REVEAL_AT + 0.22}
          k={k}
          onSubmit={handleSubmit}
          style={{ marginTop: 'var(--sp-10)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
          noValidate
        >
          <div className="input-group">
            <label className="input-label" style={{ color: 'var(--clr-ink-muted)' }}>
              Mobile number
            </label>
            <div className="phone-row">
              <div className="phone-prefix">
                <FlagIN size={20} />
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
        </Reveal>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <Reveal
          as="p"
          t={t}
          at={REVEAL_AT + 0.6}
          k={k}
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
          <br />
          <a
            href={doctorAppHref}
            style={{ color: 'var(--clr-ink-muted)', textDecoration: 'underline', fontSize: 'inherit', marginTop: 'var(--sp-2)', display: 'inline-block' }}
          >
            Practitioner? Sign in here
          </a>
        </Reveal>
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
