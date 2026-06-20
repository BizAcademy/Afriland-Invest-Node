import React from 'react';
import logoUrl from '../assets/logo.png';

export default function Logo({ size = 'md', style }) {
  const heights = { sm: 30, md: 42, lg: 58 };
  const h = heights[size] || heights.md;
  return (
    <img
      src={logoUrl}
      alt="GIFETAL PRO"
      style={{ height: h, width: 'auto', objectFit: 'contain', display: 'block', ...style }}
    />
  );
}
