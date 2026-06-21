import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';
import TransactionReceipt, { KIND_CONFIG, STATUT_LABEL, STATUT_BADGE, fmt, fmtDate, txLabel } from '../components/TransactionReceipt';

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');
  const [receipt, setReceipt] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/transactions');
      setTransactions(res.data.transactions || []);
    } catch { toast.error('Erreur de chargement des transactions'); }
    finally { setLoading(false); }
  };

  const filtered = transactions.filter(t =>
    (typeFilter === 'all' || t.kind === typeFilter) &&
    (statutFilter === 'all' || t.statut === statutFilter)
  );

  const selectStyle = {
    flex: 1, padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    color: 'var(--text-primary)', fontSize: 13,
  };

  return (
    <div className="container" style={{ paddingBottom: 90 }}>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
        <span className="page-title">Transactions</span>
        <Logo size="sm" style={{ marginLeft: 'auto' }} />
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, margin: '0 0 16px' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="all">Tous les types</option>
          <option value="depot">Dépôt</option>
          <option value="retrait">Retrait</option>
          <option value="investissement">Investissement</option>
          <option value="parrainage">Commission parrainage</option>
          <option value="revenu">Revenu investissement</option>
          <option value="bonus">Bonus roue</option>
          <option value="credit_admin">Crédit administrateur</option>
          <option value="debit_admin">Retrait Administrateur</option>
          <option value="cadeau_vip">Cadeau VIP</option>
          <option value="mise_roue">Mise roue</option>
          <option value="gain_roue">Gain roue</option>
        </select>
        <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)} style={selectStyle}>
          <option value="all">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="en_attente">En attente</option>
          <option value="rejete">Rejeté</option>
          <option value="actif">Actif</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <i className="fas fa-receipt" style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }} />
          <p>Aucune transaction</p>
        </div>
      ) : (
        filtered.map(t => {
          const cfg = KIND_CONFIG[t.kind] || { label: t.label, icon: 'fa-exchange-alt', color: '#6b7280' };
          return (
            <button key={t.id} onClick={() => setReceipt(t)} style={{
              width: '100%', textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${cfg.icon}`} style={{ color: cfg.color, fontSize: 16 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{txLabel(t)}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{fmtDate(t.date)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: t.sens === '+' ? 'var(--green-primary)' : 'var(--text-primary)' }}>
                  {t.sens}{fmt(t.montant)}
                </p>
                <span className={`badge ${STATUT_BADGE[t.statut] || 'badge-yellow'}`} style={{ fontSize: 10 }}>
                  {STATUT_LABEL[t.statut] || t.statut}
                </span>
              </div>
            </button>
          );
        })
      )}

      <TransactionReceipt receipt={receipt} onClose={() => setReceipt(null)} />

      <BottomNav />
    </div>
  );
}
