import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', icon: 'fa-home', label: 'Accueil' },
  { path: '/investment', icon: 'fa-chart-line', label: 'Plans' },
  { path: '/deposit', icon: 'fa-arrow-down', label: 'Dépôt' },
  { path: '/withdrawal', icon: 'fa-hand-holding-usd', label: 'Retrait' },
  { path: '/account', icon: 'fa-user', label: 'Compte' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'var(--primary)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(245,197,24,0.35)',
      boxShadow: '0 -2px 16px rgba(27,42,107,0.35)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      zIndex: 100,
    }}>
      {navItems.map((item) => {
        const active = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: 'none', border: 'none', padding: '6px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              cursor: 'pointer', flex: 1,
              color: active ? 'var(--secondary)' : 'rgba(255,255,255,0.65)',
              transition: 'var(--transition)',
            }}
          >
            <i className={`fas ${item.icon}`} style={{ fontSize: 20 }} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
            {active && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'var(--secondary)', marginTop: 2,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
