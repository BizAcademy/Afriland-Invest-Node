import React, { useState, useEffect } from 'react';
import Logo from "../components/Logo";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';

export default function Referral() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openLevel, setOpenLevel] = useState(1);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try { const res = await api.get('/referral/data'); setData(res.data); }
    catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copié !'));
  };

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

  const lienParrainage = data?.code_parrainage
    ? `${window.location.origin}?p=${data.code_parrainage}`
    : '';

  const NIVEAUX = [
    { num: 1, label: 'Niveau 1', commission: `${data?.commissions?.niveau1 ?? '10'}%`, color: 'var(--green-primary)' },
    { num: 2, label: 'Niveau 2', commission: `${data?.commissions?.niveau2 ?? '5'}%`, color: 'var(--blue-primary)' },
    { num: 3, label: 'Niveau 3', commission: `${data?.commissions?.niveau3 ?? '2'}%`, color: '#a855f7' },
  ];

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
        <span className="page-title">Programme de parrainage</span>
        <Logo size="sm" style={{ marginLeft: "auto" }} />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><div className="loading-spinner" /></div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          <div className="card" style={{ background: 'linear-gradient(135deg,rgba(27,42,107,0.15),rgba(0,0,0,0.15))', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Gains de parrainage</p>
            <p className="amount-large">{fmt(data?.gains_parrainage)} FCFA</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
              {NIVEAUX.map(n => (
                <div key={n.num} style={{ textAlign: 'center', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 4px' }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: n.color }}>{data?.[`niveau${n.num}`]?.count || 0}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{n.label}</p>
                  <p style={{ fontSize: 11, color: n.color, fontWeight: 600 }}>{n.commission}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              <i className="fas fa-link" style={{ marginRight: 8, color: 'var(--green-primary)' }} />
              Mon lien de parrainage
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                {lienParrainage || '—'}
              </p>
              <button onClick={() => copy(lienParrainage)} style={{
                padding: '8px 12px', borderRadius: 8, background: 'rgba(27,42,107,0.15)', border: '1px solid rgba(27,42,107,0.3)', color: 'var(--green-primary)', cursor: 'pointer', flexShrink: 0,
              }}>
                <i className="fas fa-copy" />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Code parrainage</p>
                <p style={{ fontWeight: 700, color: 'var(--green-primary)', letterSpacing: 2 }}>{data?.code_parrainage || '—'}</p>
              </div>
              <button onClick={() => copy(data?.code_parrainage || '')} style={{
                padding: '0 16px', borderRadius: 10, background: 'rgba(27,42,107,0.15)', border: '1px solid rgba(27,42,107,0.3)', color: 'var(--green-primary)', cursor: 'pointer',
              }}>
                <i className="fas fa-copy" />
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--blue-primary)' }}>
              <i className="fas fa-info-circle" style={{ marginRight: 8 }} />Commissions
            </p>
            {NIVEAUX.map(n => (
              <div key={n.num} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{n.label}</span>
                <span style={{ color: n.color, fontWeight: 600 }}>{n.commission} des investissements</span>
              </div>
            ))}
          </div>

          {NIVEAUX.map(n => {
            const levelData = data?.[`niveau${n.num}`];
            const isOpen = openLevel === n.num;
            return (
              <div key={n.num} className="card" style={{ marginBottom: 10, borderColor: `${n.color}30` }}>
                <button onClick={() => setOpenLevel(isOpen ? 0 : n.num)} style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: 'var(--text-primary)', padding: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${n.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fas fa-users" style={{ color: n.color, fontSize: 14 }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontWeight: 600 }}>{n.label} · {n.commission}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{levelData?.count || 0} filleul(s)</p>
                    </div>
                  </div>
                  <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ color: 'var(--text-muted)' }} />
                </button>
                {isOpen && levelData?.filleuls?.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                    {levelData.filleuls.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${n.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: n.color, flexShrink: 0 }}>
                          {f.nom?.[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{f.nom}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.pays} • {new Date(f.date_inscription).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isOpen && (!levelData?.filleuls || levelData.filleuls.length === 0) && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
                    Aucun filleul à ce niveau
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
