import React from 'react';

export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 30, className = '' }) => (
  <span
    className={`logo-mark ${className}`}
    style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size * 0.28)) }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none">
      <path d="M13.4 2.2 4.6 13.1h6.1l-1 8.7 8.8-10.9h-6.1l1-8.7Z" fill="white" />
    </svg>
  </span>
);
