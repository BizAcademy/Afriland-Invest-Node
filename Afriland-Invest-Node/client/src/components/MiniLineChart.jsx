import React from 'react';

// Petite courbe SVG (sans dépendance) : trace une ligne + zone remplie.
// data : [{ label, value }]
export default function MiniLineChart({ data = [], color = 'var(--green-primary)', height = 180 }) {
  if (!data.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Aucune donnée pour cette période
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padL = 44, padR = 12, padT = 14, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = data.map(d => Number(d.value) || 0);
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const span = maxV - minV || 1;

  const x = (i) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => padT + innerH - ((v - minV) / span) * innerH;

  const linePts = data.map((d, i) => `${x(i)},${y(Number(d.value) || 0)}`).join(' ');
  const areaPts = `${padL},${y(minV)} ${linePts} ${x(data.length - 1)},${y(minV)}`;
  const zeroY = y(0);

  // Étiquettes X allégées si trop de points.
  const step = Math.ceil(data.length / 8);
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  // 3 graduations Y.
  const yTicks = [maxV, (maxV + minV) / 2, minV];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="mlcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {yTicks.map((tv, i) => (
        <g key={i}>
          <line x1={padL} y1={y(tv)} x2={W - padR} y2={y(tv)} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
          <text x={padL - 6} y={y(tv) + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">{fmt(tv)}</text>
        </g>
      ))}

      {minV < 0 && maxV > 0 && (
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="rgba(0,0,0,0.25)" strokeWidth="1" strokeDasharray="3 3" />
      )}

      <polygon points={areaPts} fill="url(#mlcFill)" />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(Number(d.value) || 0)} r="3" fill={color} />
      ))}

      {data.map((d, i) => (
        (i % step === 0 || i === data.length - 1) ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{d.label}</text>
        ) : null
      ))}
    </svg>
  );
}
