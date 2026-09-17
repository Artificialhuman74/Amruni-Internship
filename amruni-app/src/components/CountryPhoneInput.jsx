import { useState, useRef, useEffect } from 'react';
import { COUNTRY_CODES, DEFAULT_COUNTRY } from '../data/countries';
import { IconPhone } from '../icons.jsx';

export default function CountryPhoneInput({
  country = DEFAULT_COUNTRY,
  onCountryChange,
  phone = '',
  onPhoneChange,
  required = false,
  placeholder,
  autoFocus = false,
  disabled = false,
  error = false,
  id = 'phone-input',
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDigitsChange = (e) => {
    // Keep only digits and slice to max length
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, country.len || 10);
    onPhoneChange(rawDigits);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--clr-surface)',
        border: error ? '1.5px solid oklch(0.55 0.18 24)' : '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2px 4px 2px 8px',
        position: 'relative',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Country Code Dropdown Trigger */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--clr-surface-2)',
            border: '1px solid var(--clr-border)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 8px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--clr-ink)',
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>{country.flag}</span>
          <span>{country.dial}</span>
          <span style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginLeft: 2 }}>▾</span>
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 100,
              background: 'var(--clr-surface)',
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              width: 220,
              maxHeight: 240,
              overflowY: 'auto',
              padding: 4,
            }}
          >
            {COUNTRY_CODES.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={c.code === country.code}
                onClick={() => {
                  onCountryChange(c);
                  setDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: c.code === country.code ? 'var(--clr-surface-2)' : 'transparent',
                  color: 'var(--clr-ink)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: c.code === country.code ? 700 : 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 16 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: 'var(--clr-ink-muted)', fontFamily: 'monospace' }}>{c.dial}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Phone Number Input */}
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={handleDigitsChange}
        placeholder={placeholder || country.placeholder || '10-digit number'}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Phone number"
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          padding: 'var(--sp-3) var(--sp-3)',
          fontSize: 'var(--text-sm)',
          color: 'var(--clr-ink)',
          outline: 'none',
          fontFamily: 'inherit',
          letterSpacing: '0.02em',
        }}
      />

      {/* Trailing Icon */}
      <span style={{ color: 'var(--clr-ink-subtle)', paddingRight: 8, display: 'inline-flex', pointerEvents: 'none' }}>
        <IconPhone size={16} />
      </span>
    </div>
  );
}
