import React, { useState, useEffect } from 'react';
import Logo from "../components/Logo";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';
import TransactionReceipt from '../components/TransactionReceipt';

// Normalise un nom de méthode pour le rapprochement avec les logos.
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function Withdrawal() {
  const [form, setForm] = useState({ montant: '', transaction_password: '' });
  const [history, setHistory] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [logoMap, setLogoMap] = useState({});
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('form');
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const [eligibility, setEligibility] = useState({ checked: false, canWithdraw: true, reason: null });
  const [retirable, setRetirable] = useState(0);

  const loadData = async () => {
    try {
      const [dashRes, histRes, walletRes, countriesRes] = await Promise.all([
        api.get('/user/dashboard'),
        api.get('/withdrawal/list'),
        api.get('/user/wallet').catch(() => null),
        api.get('/deposit/countries').catch(() => null),
      ]);
      setUserInfo(dashRes.data.user);
      setHistory(histRes.data.retraits);
      setWallet(walletRes?.data?.wallets?.[0] || null);

      const map = {};
      for (const c of countriesRes?.data?.countries || []) {
        for (const o of c.operators || []) {
          if (o.logo_url) map[norm(o.operator_name)] = o.logo_url;
        }
      }
      setLogoMap(map);

      const dispo = parseFloat(histRes.data.retirable || 0);
      setRetirable(dispo);

      const canWithdraw = dispo >= 2000;
      const reason = canWithdraw ? null
        : "Vous n'avez pas encore de gains retirables suffisants (minimum 2 000 FCFA). Seuls les gains d'investissement, les gains de la roue et les commissions de parrainage sont retirables — l'argent déposé ne l'est pas.";

      setEligibility({ checked: true, canWithdraw, reason });
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.montant || !form.transaction_password) return toast.error('Remplissez tous les champs');
    if (parseFloat(form.montant) < 2000) return toast.error('Retrait minimum: 2000 FCFA');
    setSubmitting(true);
    try {
      const res = await api.post('/withdrawal/request', form);
      toast.success(res.data.message);
      setForm({ montant: '', transaction_password: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    } finally { setSubmitting(false); }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
  const devise = userInfo?.pays === 'Cameroun' ? 'XAF' : 'XOF';
  const statusColor = { valide: 'green', en_attente: 'yellow', rejete: 'red' };
  const statusLabel = { valide: 'Validé', en_attente: 'En attente', rejete: 'Rejeté' };

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
        <span className="page-title">Retrait</span>
        <Logo size="sm" style={{ marginLeft: "auto" }} />
      </div>

      {userInfo && (
        <div style={{ margin: '0 16px 16px', background: 'linear-gradient(135deg,rgba(27,42,107,0.15),rgba(0,0,0,0.15))', border: '1px solid var(--border-color)', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Solde retirable</p>
          <p className="amount-large">{fmt(retirable)} {devise}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Gains d'investissement, gains de la roue et commissions de parrainage. Solde total : {fmt(userInfo.solde)} {devise}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', margin: '0 16px 20px', background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4 }}>
        {['form', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tab === t ? 'linear-gradient(135deg,var(--blue-primary),var(--blue-dark))' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text-muted)', fontWeight: tab === t ? 600 : 400, fontSize: 14,
          }}>
            {t === 'form' ? 'Nouveau retrait' : 'Historique'}
          </button>
        ))}
      </div>

      {tab === 'form' ? (
        <div style={{ padding: '0 16px' }}>
          {/* Bannière de blocage si conditions non remplies */}
          {eligibility.checked && !eligibility.canWithdraw && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', marginBottom: 6 }}>
                <i className="fas fa-ban" style={{ marginRight: 8 }} />Retrait non disponible
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                {eligibility.reason}
              </p>
              <button onClick={() => navigate('/investment')} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--green-primary),var(--green-dark))', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <i className="fas fa-chart-line" style={{ marginRight: 6 }} />Voir les plans d'investissement
              </button>
            </div>
          )}

          <div className="card" style={{ background: 'rgba(0,0,0,0.08)', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--blue-primary)' }}>
              <i className="fas fa-info-circle" style={{ marginRight: 8 }} />Conditions de retrait
            </p>
            <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 16 }}>
              <li>Lundi au samedi de 7h à 20h (GMT)</li>
              <li>Minimum de retrait : 2 000 FCFA</li>
              <li>Frais de retrait : 10%</li>
              <li>Maximum 2 retraits par 24h</li>
              <li>Seuls les gains (investissement, roue, parrainage) sont retirables</li>
              <li>L'argent déposé n'est pas retirable</li>
              <li>Parrainage retirable uniquement après au moins un investissement</li>
              <li>Portefeuille configuré obligatoire</li>
            </ul>
          </div>

          {wallet ? (
            <div className="card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: logoMap[norm(wallet.methode_paiement)] ? '#fff' : 'linear-gradient(135deg,#1B2A6B,#000000)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {logoMap[norm(wallet.methode_paiement)] ? (
                  <img src={logoMap[norm(wallet.methode_paiement)]} alt={wallet.methode_paiement} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <i className="fas fa-wallet" style={{ color: '#fff' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{wallet.methode_paiement}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{wallet.numero_telephone}</p>
              </div>
              <button onClick={() => navigate('/wallet')} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.06)', border: '1px solid var(--border-color)', color: 'var(--blue-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <i className="fas fa-pen" />
              </button>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Portefeuille</p>
                <p style={{ fontWeight: 600, fontSize: 14 }}>Configurer mon portefeuille</p>
              </div>
              <button onClick={() => navigate('/wallet')} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.3)', color: 'var(--blue-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <i className="fas fa-wallet" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Montant (FCFA)</label>
              <input type="number" placeholder="Minimum 2000 FCFA" value={form.montant}
                onChange={e => setForm({ ...form, montant: e.target.value })} min="2000" />
            </div>
            {parseFloat(form.montant) >= 2000 && (
              <div style={{ background: 'rgba(27,42,107,0.08)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Montant déduit du solde</span><strong>{fmt(form.montant)} FCFA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Frais (10%)</span><span>− {fmt(parseFloat(form.montant) * 0.10)} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: 'var(--green-primary)', fontWeight: 700 }}>
                  <span>Vous recevez</span><span>{fmt(parseFloat(form.montant) * 0.90)} FCFA</span>
                </div>
              </div>
            )}
            <div className="input-group">
              <label>Mot de passe de transaction (4 chiffres)</label>
              <input type="password" placeholder="••••" maxLength={4} value={form.transaction_password}
                onChange={e => setForm({ ...form, transaction_password: e.target.value })}
                style={{ textAlign: 'center', letterSpacing: 8, fontSize: 20 }} />
            </div>
            <button type="submit" className="btn btn-blue" disabled={submitting || (eligibility.checked && !eligibility.canWithdraw)}>
              {submitting ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : (
                <><i className="fas fa-hand-holding-usd" /> Demander le retrait</>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {history.length === 0 ? (
            <div className="empty-state"><i className="fas fa-history" /><p>Aucun retrait</p></div>
          ) : (
            history.map(r => (
              <button key={r.id} onClick={() => setReceipt({
                id: `retrait-${r.id}`, kind: 'retrait', label: 'Retrait',
                montant: r.montant, sens: '-', statut: r.statut, date: r.date_demande,
                details: { methode: r.methode, numero_compte: r.numero_compte, frais: r.frais, montant_net: r.montant_net },
              })} className="card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{fmt(r.montant_net)} FCFA <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>reçus</span></p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>Brut {fmt(r.montant)} • Frais {fmt(r.frais)}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.methode} • {r.numero_compte}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(r.date_demande).toLocaleString('fr-FR')}</p>
                  </div>
                  <span className={`badge badge-${statusColor[r.statut] || 'yellow'}`}>
                    <span className={`status-dot ${statusColor[r.statut] || 'yellow'}`} />
                    {statusLabel[r.statut] || r.statut}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <TransactionReceipt receipt={receipt} onClose={() => setReceipt(null)} />

      <BottomNav />
    </div>
  );
}
