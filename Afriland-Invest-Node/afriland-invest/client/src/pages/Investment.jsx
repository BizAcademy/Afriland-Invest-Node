import React, { useState, useEffect } from 'react';
import Logo from "../components/Logo";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';

export default function Investment() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [modal, setModal] = useState(null);
  const [txPassword, setTxPassword] = useState('');
  const [eligibility, setEligibility] = useState({ canInvest: true, checked: false });
  const navigate = useNavigate();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [plansRes, depotsRes] = await Promise.all([
        api.get('/investment/plans'),
        api.get('/deposit/list'),
      ]);
      setPlans(plansRes.data.plans);

      const depots = depotsRes.data.depots || [];
      const hasValidatedDeposit = depots.some(d => d.statut === 'valide');
      setEligibility({ canInvest: hasValidatedDeposit, checked: true, hasDeposit: hasValidatedDeposit });
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!txPassword) return toast.error('Mot de passe requis');
    setBuying(modal.id);
    try {
      const res = await api.post('/investment/buy', { plan_id: modal.id, transaction_password: txPassword });
      toast.success(res.data.message);
      setModal(null); setTxPassword('');
      setEligibility(prev => ({ ...prev, canInvest: true }));
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Erreur';
      toast.error(errMsg);
      if (err.response?.data?.code === 'NO_DEPOSIT') {
        setModal(null); setTxPassword('');
      }
    } finally { setBuying(null); }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
  const COLORS = ['#1B2A6B', '#000000', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#8b5cf6'];

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px 20px 16px 16px', padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700 }}>Activer {modal.nom}</h3>
              <button onClick={() => { setModal(null); setTxPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ background: 'rgba(27,42,107,0.08)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Prix</span>
                <span style={{ fontWeight: 700, color: 'var(--green-primary)' }}>{fmt(modal.prix)} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Rendement/jour</span>
                <span style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>{fmt(modal.revenu_journalier)} FCFA ({modal.rendement_journalier}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Durée</span>
                <span style={{ fontWeight: 700 }}>{modal.duree_jours} jours</span>
              </div>
            </div>
            <div className="input-group">
              <label>Mot de passe de transaction (4 chiffres)</label>
              <input type="password" placeholder="••••" maxLength={4} value={txPassword}
                onChange={e => setTxPassword(e.target.value)} style={{ textAlign: 'center', letterSpacing: 8, fontSize: 20 }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              <i className="fas fa-info-circle" style={{ color: 'var(--blue-primary)', marginRight: 6 }} />
              Configurez votre mot de passe dans Compte si ce n'est pas encore fait.
            </p>
            <button className="btn btn-primary" onClick={handleBuy} disabled={!!buying}>
              {buying ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : (
                <><i className="fas fa-lock-open" /> Confirmer l'investissement</>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
        <span className="page-title">Plans d'investissement VIP</span>
        <Logo size="sm" style={{ marginLeft: "auto" }} />
      </div>

      {/* Bannière d'éligibilité */}
      {eligibility.checked && !eligibility.canInvest && (
        <div style={{ margin: '0 16px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b', marginBottom: 6 }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />Dépôt requis avant d'investir
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            Les gains de parrainage ne peuvent pas être utilisés directement pour souscrire à un plan.
            Vous devez d'abord effectuer un dépôt validé par l'administrateur.
          </p>
          <button onClick={() => navigate('/deposit')} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--green-primary),var(--green-dark))', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <i className="fas fa-arrow-down" style={{ marginRight: 6 }} />Effectuer un dépôt
          </button>
        </div>
      )}

      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(27,42,107,0.1), rgba(0,0,0,0.1))', border: '1px solid var(--border-color)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <i className="fas fa-star" style={{ color: '#f59e0b', marginTop: 2 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            Achetez un plan VIP et recevez des revenus journaliers automatiques pendant toute la durée du plan.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><div className="loading-spinner" /></div>
      ) : (
        <div style={{ padding: '0 16px', display: 'grid', gap: 12 }}>
          {plans.map((plan, idx) => {
            const color = COLORS[idx % COLORS.length];
            const blocked = eligibility.checked && !eligibility.canInvest;
            return (
              <div key={plan.id} style={{
                background: 'var(--bg-card)', border: `1px solid ${color}30`,
                borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden',
                opacity: blocked ? 0.7 : 1,
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: color, borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: 8 }}>
                  {plan.image_url && (
                    <img src={`/uploads/${plan.image_url}`} alt={plan.nom} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>{plan.nom}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Série {plan.serie} • {plan.duree_jours} jours</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color, fontWeight: 800, fontSize: 18 }}>{plan.rendement_journalier}%</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>par jour</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Prix</p>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{new Intl.NumberFormat('fr-FR').format(plan.prix)} FCFA</p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Gain/jour</p>
                      <p style={{ fontWeight: 700, fontSize: 14, color }}>+{new Intl.NumberFormat('fr-FR').format(Math.round(plan.revenu_journalier))} FCFA</p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 12px', gridColumn: '1/-1' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Gain total sur {plan.duree_jours} jours</p>
                      <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--green-primary)' }}>+{new Intl.NumberFormat('fr-FR').format(Math.round(plan.revenu_total))} FCFA</p>
                    </div>
                  </div>
                  {blocked ? (
                    <button onClick={() => navigate('/deposit')} style={{
                      width: '100%', padding: '12px', borderRadius: 10, border: '1px dashed #f59e0b',
                      background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}>
                      <i className="fas fa-lock" style={{ marginRight: 8 }} />Déposer d'abord pour investir
                    </button>
                  ) : (
                    <button onClick={() => setModal(plan)} style={{
                      width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                      background: `linear-gradient(135deg, ${color}, ${color}bb)`,
                      color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}>
                      <i className="fas fa-rocket" style={{ marginRight: 8 }} />Investir maintenant
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
