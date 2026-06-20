import React, { useState, useEffect } from 'react';
import Logo from "../components/Logo";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';
import BottomNav from '../components/BottomNav';

export default function Account() {
  const [txPassword, setTxPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try { const res = await api.get('/user/profile'); setUserInfo(res.data); }
    catch {}
  };

  const handleTxPassword = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(txPassword)) return toast.error('4 chiffres requis');
    setLoading(true);
    try {
      await api.put('/user/transaction-password', { password: txPassword });
      toast.success('Mot de passe de transaction défini');
      setTxPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Déconnecté');
  };

  const menuItems = [
    { icon: 'fa-briefcase', label: 'Mes investissements', path: '/orders', color: 'var(--green-primary)' },
    { icon: 'fa-wallet', label: 'Mon portefeuille', path: '/wallet', color: 'var(--blue-primary)' },
    { icon: 'fa-users', label: 'Mes filleuls', path: '/referral', color: '#a855f7' },
    { icon: 'fa-crown', label: 'Salaire VIP', path: '/salary', color: '#f59e0b' },
    { icon: 'fa-dice', label: 'Roue de la fortune', path: '/wheel', color: '#ef4444' },
    { icon: 'fa-question-circle', label: 'FAQ et Support', path: '/faq', color: 'var(--blue-light)' },
  ];

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <span className="page-title">Mon compte</span>
        <Logo size="sm" style={{ marginLeft: "auto" }} />
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg,rgba(27,42,107,0.1),rgba(0,0,0,0.1))', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#1B2A6B,#000000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {user?.nom?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 17 }}>{user?.nom}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user?.telephone}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{userInfo?.user?.pays}</p>
            </div>
          </div>
          {user?.role === 'admin' && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(27,42,107,0.2)' }}>
              <span className="badge badge-blue"><i className="fas fa-shield-alt" style={{ marginRight: 4 }} />Administrateur</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Solde</p>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--green-primary)' }}>{new Intl.NumberFormat('fr-FR').format(Math.round(userInfo?.solde || 0))}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>FCFA</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Code parrain</p>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--blue-primary)', letterSpacing: 1 }}>{userInfo?.user?.code_parrainage || '—'}</p>
            <button onClick={() => navigator.clipboard.writeText(userInfo?.user?.code_parrainage || '').then(() => toast.success('Copié!'))}
              style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <i className="fas fa-copy" /> Copier
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            <i className="fas fa-lock" style={{ marginRight: 8, color: 'var(--blue-primary)' }} />
            Mot de passe de transaction
          </p>
          <form onSubmit={handleTxPassword}>
            <div className="input-group">
              <label>Définir / modifier (4 chiffres)</label>
              <input type="password" placeholder="••••" maxLength={4} value={txPassword}
                onChange={e => setTxPassword(e.target.value)} style={{ textAlign: 'center', letterSpacing: 8, fontSize: 20 }} />
            </div>
            <button type="submit" className="btn btn-blue" disabled={loading} style={{ padding: '12px' }}>
              {loading ? <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Enregistrer'}
            </button>
          </form>
        </div>

        <div style={{ marginBottom: 16 }}>
          {menuItems.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              color: 'var(--text-primary)', cursor: 'pointer', marginBottom: 8, transition: 'var(--transition)',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fas ${item.icon}`} style={{ color: item.color, fontSize: 15 }} />
              </div>
              <span style={{ fontWeight: 500, flex: 1, textAlign: 'left' }}>{item.label}</span>
              <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </button>
          ))}
        </div>

        {user?.role === 'admin' && (
          <button onClick={() => navigate('/admin')} className="btn btn-blue" style={{ marginBottom: 12 }}>
            <i className="fas fa-shield-alt" /> Panneau d'administration
          </button>
        )}

        <button onClick={handleLogout} style={{
          width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(234,179,8,0.4)',
          background: 'rgba(234,179,8,0.12)', color: '#ca8a04', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <i className="fas fa-sign-out-alt" /> Se déconnecter
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
