import React, { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { externalUrl } from '../lib/links';

export default function Community() {
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/public/community')
      .then(res => {
        setTelegram(res.data.telegram || '');
        setWhatsapp(res.data.whatsapp || '');
      })
      .catch(() => {});
  }, []);

  const openLink = (url) => {
    const target = externalUrl(url);
    if (!target) return toast.error('Lien bientôt disponible');
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const btnStyle = (bg) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', padding: '16px', marginBottom: 16, borderRadius: 14,
    border: 'none', background: bg, color: '#fff', fontWeight: 700, fontSize: 16,
    cursor: 'pointer',
  });

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
        <span className="page-title">Rejoindre la communauté</span>
        <Logo size="sm" style={{ marginLeft: 'auto' }} />
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(27,42,107,0.1),rgba(0,0,0,0.1))', border: '1px solid var(--border-color)', borderRadius: 14, padding: '16px', marginBottom: 24, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>
            <i className="fas fa-users" style={{ color: 'var(--green-primary)', marginRight: 8 }} />
            Rejoignez-nous
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Rejoignez notre communauté pour rester informé des dernières actualités et opportunités.
          </p>
        </div>

        <button type="button" onClick={() => openLink(telegram)} style={btnStyle('#229ED9')}>
          <i className="fab fa-telegram" style={{ fontSize: 22 }} /> REJOINDRE SUR TELEGRAM
        </button>

        <button type="button" onClick={() => openLink(whatsapp)} style={btnStyle('#25D366')}>
          <i className="fab fa-whatsapp" style={{ fontSize: 22 }} /> REJOINDRE SUR WHATSAPP
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
