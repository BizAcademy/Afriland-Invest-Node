import React, { useState, useEffect, useCallback } from 'react';
import Logo from "../components/Logo";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';

// ─── Minuteur temps réel vers la prochaine heure de crédit ──────────────────
function RevenueCountdown({ nextCreditAt }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  const calc = useCallback(() => {
    if (!nextCreditAt) return 0;
    return Math.max(0, Math.floor((new Date(nextCreditAt) - Date.now()) / 1000));
  }, [nextCreditAt]);

  useEffect(() => {
    setSecondsLeft(calc());
    const t = setInterval(() => setSecondsLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [calc]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function MyOrders() {
  const [orders, setOrders]           = useState([]);
  const [nextCreditAt, setNextCreditAt] = useState(null);
  const [loading, setLoading]         = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/investment/my-orders');
      setOrders(res.data.orders || []);
      setNextCreditAt(res.data.nextCreditAt || null);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

  const getStatus = (order) => {
    const now = new Date();
    const fin = new Date(order.date_fin);
    if (order.statut === 'annule') return { label: 'Annulé',  color: 'red' };
    if (fin < now)                  return { label: 'Terminé', color: 'blue' };
    return                                  { label: 'Actif',   color: 'green' };
  };

  const getDaysLeft = (dateFin) => {
    const diff = Math.ceil((new Date(dateFin) - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const activeOrders = orders.filter(o => getStatus(o).label === 'Actif');

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/account')}>
          <i className="fas fa-arrow-left" />
        </button>
        <span className="page-title">Mes investissements</span>
        <Logo size="sm" style={{ marginLeft: 'auto' }} />
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* ── Bandeau prochain crédit ── */}
        {activeOrders.length > 0 && nextCreditAt && (
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(27,42,107,0.07), rgba(245,197,24,0.06))',
            border: '1.5px solid rgba(27,42,107,0.18)',
            marginBottom: 16,
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
              <i className="fas fa-clock" style={{ color: 'var(--secondary)', fontSize: 16 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                Prochain crédit journalier dans
              </span>
            </div>
            <RevenueCountdown nextCreditAt={nextCreditAt} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Chaque investissement est crédité <strong>toutes les 24h</strong> — vos gains sont versés automatiquement
            </p>
          </div>
        )}

        {/* ── Liste des commandes ── */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="loading-spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-chart-line" />
            <p style={{ marginBottom: 16 }}>Aucun investissement</p>
            <button className="btn btn-primary" onClick={() => navigate('/investment')}>
              Investir maintenant
            </button>
          </div>
        ) : (
          orders.map(order => {
            const status    = getStatus(order);
            const daysLeft  = getDaysLeft(order.date_fin);
            const totalGain = parseFloat(order.revenu_journalier) * order.duree_jours;
            const progress  = Math.max(0, Math.min(100,
              ((order.duree_jours - daysLeft) / order.duree_jours) * 100
            ));
            const lastDate  = order.last_revenue_date
              ? new Date(order.last_revenue_date).toLocaleDateString('fr-FR')
              : null;

            return (
              <div key={order.id} className="card" style={{ marginBottom: 12 }}>
                {/* Titre + badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{order.plan_nom}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Série {order.serie}</p>
                  </div>
                  <span className={`badge badge-${status.color}`}>
                    <span className={`status-dot ${status.color}`} />
                    {status.label}
                  </span>
                </div>

                {/* Grille chiffres clés */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Montant investi</p>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>{fmt(order.montant)} FCFA</p>
                  </div>
                  <div style={{ background: 'rgba(27,42,107,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Gain / jour</p>
                    <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--green-primary)' }}>
                      +{fmt(order.revenu_journalier)} FCFA
                    </p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Début</p>
                    <p style={{ fontWeight: 600, fontSize: 12 }}>
                      {new Date(order.date_debut).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Gain total prévu</p>
                    <p style={{ fontWeight: 700, fontSize: 12, color: 'var(--green-primary)' }}>
                      {fmt(totalGain)} FCFA
                    </p>
                  </div>
                </div>

                {/* Barre de progression (plans actifs) */}
                {status.label === 'Actif' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Progression</span>
                      <span style={{ color: 'var(--green-primary)', fontWeight: 600 }}>
                        {daysLeft} jour{daysLeft !== 1 ? 's' : ''} restant{daysLeft !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{
                        width: `${progress}%`, height: '100%',
                        background: 'linear-gradient(90deg, var(--green-primary), var(--blue-primary))',
                        borderRadius: 3, transition: 'width 0.5s',
                      }} />
                    </div>

                    {/* Dernier gain reçu + prochain gain */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'rgba(27,42,107,0.05)',
                      border: '1px solid rgba(27,42,107,0.12)',
                      borderRadius: 10, padding: '10px 12px',
                    }}>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Dernier versement</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {lastDate
                            ? <><i className="fas fa-check-circle" style={{ color: '#22c55e', marginRight: 4 }} />{lastDate}</>
                            : <span style={{ color: 'var(--text-muted)' }}>En attente du 1er crédit</span>
                          }
                        </p>
                      </div>
                      {nextCreditAt && (
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Prochain dans</p>
                          <RevenueCountdown nextCreditAt={nextCreditAt} />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Plan terminé */}
                {status.label === 'Terminé' && (
                  <div style={{
                    background: 'rgba(27,42,107,0.06)', borderRadius: 10,
                    padding: '8px 12px', textAlign: 'center',
                    fontSize: 12, color: 'var(--text-muted)',
                  }}>
                    <i className="fas fa-flag-checkered" style={{ marginRight: 6 }} />
                    Plan terminé — gain total versé : <strong>{fmt(totalGain)} FCFA</strong>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
