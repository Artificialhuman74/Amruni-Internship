import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function OTPInput({ value, onChange, length = 6, error, disabled }) {
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function handleKey(e, idx) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[idx]) {
        const next = value.split('');
        next[idx] = '';
        onChange(next.join(''));
      } else if (idx > 0) {
        inputs.current[idx - 1]?.focus();
        const next = value.split('');
        next[idx - 1] = '';
        onChange(next.join(''));
      }
      return;
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      inputs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault();
      inputs.current[idx + 1]?.focus();
    }
  }

  function handleChange(e, idx) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    // Handle paste of full code into one box
    if (raw.length > 1) {
      const next = raw.slice(0, length).padEnd(length, '').split('');
      onChange(next.join(''));
      const focusIdx = Math.min(raw.length, length - 1);
      inputs.current[focusIdx]?.focus();
      return;
    }
    const next = value.split('');
    next[idx] = raw[0];
    onChange(next.join(''));
    if (idx < length - 1) inputs.current[idx + 1]?.focus();
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, ''));
    const focusIdx = Math.min(pasted.length, length - 1);
    inputs.current[focusIdx]?.focus();
  }

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <motion.div
      className="otp-input"
      animate={error ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={el => (inputs.current[idx] = el)}
          className={[
            'otp-input__box',
            digit ? 'otp-input__box--filled' : '',
            error ? 'otp-input__box--error' : '',
          ].join(' ').trim()}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(e, idx)}
          onKeyDown={e => handleKey(e, idx)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${idx + 1} of ${length}`}
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
        />
      ))}
    </motion.div>
  );
}
