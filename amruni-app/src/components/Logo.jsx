export default function Logo({ size = 48, variant = 'dark' }) {
  const fill = variant === 'dark' ? '#fff' : 'oklch(0.52 0.18 355)';
  const gold = 'oklch(0.72 0.09 73)';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* Camellia petals */}
      <ellipse cx="24" cy="11" rx="6" ry="10" fill={fill} opacity="0.92" transform="rotate(0 24 24)" />
      <ellipse cx="24" cy="11" rx="6" ry="10" fill={fill} opacity="0.92" transform="rotate(72 24 24)" />
      <ellipse cx="24" cy="11" rx="6" ry="10" fill={fill} opacity="0.92" transform="rotate(144 24 24)" />
      <ellipse cx="24" cy="11" rx="6" ry="10" fill={fill} opacity="0.92" transform="rotate(216 24 24)" />
      <ellipse cx="24" cy="11" rx="6" ry="10" fill={fill} opacity="0.92" transform="rotate(288 24 24)" />
      {/* Centre */}
      <circle cx="24" cy="24" r="7" fill={gold} />
      <circle cx="24" cy="24" r="3.5" fill={variant === 'dark' ? 'oklch(0.10 0.008 355)' : 'white'} />
    </svg>
  );
}

export function Wordmark({ variant = 'dark' }) {
  const color = variant === 'dark' ? 'var(--clr-ink-on-dark)' : 'var(--clr-ink)';
  const gold = 'var(--clr-gold)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Logo size={36} variant={variant} />
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.5rem',
        fontWeight: 600,
        color,
        letterSpacing: '-0.01em',
        lineHeight: 1,
      }}>
        Am<span style={{ color: gold }}>r</span>uni
      </span>
    </div>
  );
}
