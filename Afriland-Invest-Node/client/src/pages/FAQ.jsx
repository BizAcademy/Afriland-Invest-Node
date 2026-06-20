import React, { useState, useEffect } from 'react';
import Logo from "../components/Logo";
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../lib/api';
import { externalUrl } from '../lib/links';

export default function FAQ() {
  const [open, setOpen] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [supportLink, setSupportLink] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/faq')
      .then(res => {
        setFaqs(res.data.faqs || []);
        setSupportLink(res.data.support_telegram || '');
      })
      .catch(() => setFaqs([]));
  }, []);

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
        <span className="page-title">FAQ et Support</span>
        <Logo size="sm" style={{ marginLeft: "auto" }} />
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(27,42,107,0.1),rgba(0,0,0,0.1))', border: '1px solid var(--border-color)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>
            <i className="fas fa-question-circle" style={{ color: 'var(--green-primary)', marginRight: 8 }} />
            Besoin d'aide ?
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Consultez nos réponses ci-dessous ou contactez notre support.</p>
          {supportLink && (
            <a href={externalUrl(supportLink)} target="_blank" rel="noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 14px',
              background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.3)',
              borderRadius: 8, color: 'var(--blue-primary)', fontWeight: 600, fontSize: 13, textDecoration: 'none',
            }}>
              <i className="fab fa-telegram" /> Support Telegram
            </a>
          )}
        </div>

        {faqs.map((faq, i) => (
          <div key={faq.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, marginBottom: 10, overflow: 'hidden',
          }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: '100%', padding: '16px', background: 'none', border: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                color: 'var(--text-primary)', cursor: 'pointer', gap: 12,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14, textAlign: 'left', flex: 1 }}>{faq.question}</span>
              <i className={`fas fa-chevron-${open === i ? 'up' : 'down'}`} style={{ color: 'var(--green-primary)', flexShrink: 0 }} />
            </button>
            {open === i && (
              <div style={{ padding: '0 16px 16px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, borderTop: '1px solid var(--border-color)' }}>
                {faq.reponse && <p style={{ paddingTop: 12, whiteSpace: 'pre-wrap' }}>{faq.reponse}</p>}
                {faq.image && (
                  <img
                    src={`/uploads/${faq.image}`}
                    alt={faq.question}
                    style={{ width: '100%', borderRadius: 10, marginTop: 12, display: 'block' }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
        {faqs.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-question-circle" />
            <p>Aucune question pour le moment.</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
