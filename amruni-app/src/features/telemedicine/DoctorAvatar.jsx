import React from 'react';

export default function DoctorAvatar({ doctor, size = 56, style = {} }) {
  if (!doctor) return null;

  const initials = (() => {
    const name = doctor.name || '';
    const clean = name.replace(/^(Dr\.|dr\.|DR\.|Dr|dr)\s*/i, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'DR';
  })();

  const getGradient = (name = '') => {
    const gradients = [
      'linear-gradient(135deg, oklch(0.75 0.14 330) 0%, oklch(0.65 0.16 350) 100%)', // Rose
      'linear-gradient(135deg, oklch(0.70 0.12 240) 0%, oklch(0.60 0.15 260) 100%)', // Violet
      'linear-gradient(135deg, oklch(0.75 0.10 180) 0%, oklch(0.65 0.12 210) 100%)', // Sky
      'linear-gradient(135deg, oklch(0.78 0.13 140) 0%, oklch(0.68 0.15 160) 100%)', // Sage
      'linear-gradient(135deg, oklch(0.76 0.12 80) 0%, oklch(0.66 0.14 100) 100%)',  // Gold
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return gradients[sum % gradients.length];
  };

  const hasPhoto = !!doctor.photo;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size > 40 ? 'var(--radius-lg)' : 'var(--radius-md)',
      background: hasPhoto ? 'transparent' : getGradient(doctor.name),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--clr-ink-on-dark)',
      fontSize: size * 0.38,
      fontWeight: 700,
      flexShrink: 0,
      overflow: 'hidden',
      border: '1.5px solid var(--clr-border)',
      ...style
    }}>
      {hasPhoto ? (
        <img 
          src={doctor.photo} 
          alt={doctor.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      ) : (
        initials
      )}
    </div>
  );
}
