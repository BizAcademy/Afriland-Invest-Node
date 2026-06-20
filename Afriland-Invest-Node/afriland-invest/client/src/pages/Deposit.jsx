import React, { useState, useEffect, useRef } from 'react';
import Logo from "../components/Logo";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';
import TransactionReceipt, { fmt } from '../components/TransactionReceipt';

export default function Deposit() {
  const [countries, setCountries] = useState([]);
  const [minDepot, setMinDepot] = useState(500);
  const [paysCode, setPaysCode] = useState('');
  const [operateur, setOperateur] = useState(null);
  const [montant, setMontant] = useState('');
  const [numeroPayeur, setNumeroPayeur] = useState('');
  const [otp, setOtp] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('form');
  const [pending, setPending] = useState(null); // { depot_id }
  const [receipt, setReceipt] = useState(null);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { loadData(); return () => clearInterval(pollRef.current); }, []);

  const loadData = async () => {
    try {
      const [cRes, cfgRes, histRes] = await Promise.all([
        loadCountries(),
        api.get('/deposit/config').catch(() => null),
        api.get('/deposit/list').catch(() => null),
      ]);
      const list = cRes || [];
      setCountries(list);
      if (cfgRes?.data) setMinDepot(cfgRes.data.min_depot || 500);
      if (histRes?.data) setHistory(histRes.data.depots || []);
      if (list.length > 0) {
        setPaysCode(list[0].country_code);
        setOperateur(list[0].operators[0] || null);
      } else {
        toast.error('Erreur de chargement des moyens de paiement');
      }
    } catch {
      toast.error('Erreur de chargement des moyens de paiement');
    } finally {
      setLoading(false);
    }
  };

  // Charge les pays/opérateurs avec une nouvelle tentative en cas d'échec réseau ponctuel.
  const loadCountries = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await api.get('/deposit/countries');
        return res.data.countries || [];
      } catch {
        if (attempt === 0) await new Promise(r => setTimeout(r, 800));
      }
    }
    return [];
  };

  const currentCountry = countries.find(c => c.country_code === paysCode);
  const operators = currentCountry?.operators || [];

  const handlePaysChange = (e) => {
    const code = e.target.value;
    setPaysCode(code);
    const c = countries.find(x => x.country_code === code);
    setOperateur(c?.operators[0] || null);
    setOtp('');
  };

  const selectOperateur = (op) => {
    setOperateur(op);
    setOtp('');
  };

  const montantNum = Math.round(parseFloat(montant) || 0);
  // Montant réellement débité au client : le serveur ajoute 3,5 % (frais Afribapay)
  // pour que l'utilisateur soit crédité du montant net exact. Le code USSD doit donc
  // refléter ce montant brut, sinon l'utilisateur paierait trop peu.
  const montantTotal = montantNum > 0 ? Math.round(montantNum * 1.035) : 0;

  // Code USSD à composer (pour les opérateurs à OTP), avec le montant injecté.
  const ussd = operateur?.otp_required && operateur?.ussd_code
    ? operateur.ussd_code.replace(/montant/gi, String(montantTotal || ''))
    : '';

  const isWave = (operateur?.operator_code || '').toLowerCase().includes('wave');

  const startPolling = (depotId) => {
    clearInterval(pollRef.current);
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 4;
      try {
        const res = await api.post('/deposit/status', { depot_id: depotId });
        const statut = res.data.statut;
        if (statut === 'valide') {
          clearInterval(pollRef.current);
          setPending(null);
          toast.success('Dépôt confirmé ! Votre solde a été crédité.');
          resetForm();
          loadData();
        } else if (statut === 'rejete') {
          clearInterval(pollRef.current);
          setPending(null);
          toast.error('Le paiement a échoué ou a été annulé.');
          loadData();
        }
      } catch { /* on continue le polling */ }
      if (elapsed >= 180) {
        clearInterval(pollRef.current);
        setPending(null);
        toast('Paiement toujours en attente. Vérifiez l\'historique plus tard.', { icon: '⏳' });
        loadData();
      }
    }, 4000);
  };

  const resetForm = () => {
    setMontant('');
    setNumeroPayeur('');
    setOtp('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!paysCode || !operateur || !montant || !numeroPayeur) return toast.error('Remplissez tous les champs');
    if (montantNum < minDepot) return toast.error(`Montant minimum: ${fmt(minDepot)} FCFA`);
    if (operateur.otp_required && !otp) return toast.error('Veuillez saisir le code OTP reçu');

    setSubmitting(true);
    try {
      const payload = {
        montant: montantNum,
        pays: paysCode,
        operateur: operateur.operator_code,
        numero_payeur: numeroPayeur,
      };
      if (operateur.otp_required && otp) payload.otp_code = otp;

      const res = await api.post('/deposit/request', payload);

      if (res.data.needs_otp) {
        toast(res.data.message, { icon: '🔐', duration: 8000 });
        setSubmitting(false);
        return;
      }

      if (res.data.payment_url) {
        toast.success('Redirection vers le paiement...');
        window.location.href = res.data.payment_url;
        return;
      }

      // Paiement initié : on attend la confirmation (push USSD sur le téléphone).
      setPending({ depot_id: res.data.depot_id });
      toast.success(res.data.message || 'Paiement initié, confirmez sur votre téléphone.');
      startPolling(res.data.depot_id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors du dépôt');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = { valide: 'green', en_attente: 'yellow', rejete: 'red' };
  const statusLabel = { valide: 'Validé', en_attente: 'En attente', rejete: 'Rejeté' };

  if (loading) {
    return (
      <div className="container" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
          <span className="page-title">Dépôt</span>
          <Logo size="sm" style={{ marginLeft: "auto" }} />
        </div>
        <div className="empty-state"><span className="loading-spinner" /></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><i className="fas fa-arrow-left" /></button>
        <span className="page-title">Dépôt</span>
        <Logo size="sm" style={{ marginLeft: "auto" }} />
      </div>

      <div style={{ display: 'flex', margin: '0 16px 20px', background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4 }}>
        {['form', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tab === t ? 'linear-gradient(135deg,var(--green-primary),var(--green-dark))' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text-muted)', fontWeight: tab === t ? 600 : 400, fontSize: 14,
          }}>
            {t === 'form' ? 'Nouveau dépôt' : 'Historique'}
          </button>
        ))}
      </div>

      {tab === 'form' ? (
        <div style={{ padding: '0 16px' }}>
          {pending ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
              <span className="loading-spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Paiement en cours...</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Confirmez le paiement sur votre téléphone. La page se mettra à jour automatiquement
                dès que le paiement sera validé.
              </p>
            </div>
          ) : (
          <form onSubmit={handleSubmit}>
            {/* Pays */}
            <div className="input-group">
              <label>Pays</label>
              <select value={paysCode} onChange={handlePaysChange}>
                {countries.map(c => (
                  <option key={c.country_code} value={c.country_code}>
                    {c.country_flag} {c.country_name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Opérateurs — cartes carrées arrondies avec logos */}
            <div className="input-group">
              <label>Moyen de paiement</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {operators.map(op => {
                  const selected = operateur?.operator_code === op.operator_code;
                  return (
                    <button type="button" key={op.operator_code} onClick={() => selectOperateur(op)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '12px 6px', borderRadius: 16, cursor: 'pointer',
                      border: selected ? '2px solid var(--green-primary)' : '1px solid rgba(0,0,0,0.12)',
                      background: selected ? 'rgba(27,42,107,0.06)' : '#fff',
                      boxShadow: selected ? '0 2px 8px rgba(27,42,107,0.15)' : 'none',
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: op.logo_url ? '#fff' : 'linear-gradient(135deg,var(--green-primary),var(--green-dark))',
                      }}>
                        {op.logo_url ? (
                          <img src={op.logo_url} alt={op.operator_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>
                            {op.operator_name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, textAlign: 'center', fontWeight: selected ? 700 : 500, lineHeight: 1.2 }}>
                        {op.operator_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Montant */}
            <div className="input-group">
              <label>Montant (FCFA)</label>
              <input type="number" placeholder={`Minimum ${fmt(minDepot)} FCFA`} value={montant}
                onChange={e => setMontant(e.target.value)} min={minDepot} />
            </div>

            {/* Numéro payeur */}
            <div className="input-group">
              <label>Votre numéro {currentCountry ? `(${currentCountry.country_flag} +${currentCountry.prefix})` : ''}</label>
              <input type="tel" placeholder="Ex: 600000000" value={numeroPayeur}
                onChange={e => setNumeroPayeur(e.target.value)} />
            </div>

            {/* Instructions OTP / USSD */}
            {operateur?.otp_required && (
              <div className="card" style={{ background: 'rgba(255,193,7,0.12)', border: '1px solid rgba(255,193,7,0.4)', marginBottom: 16, padding: '12px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#a07800' }}>
                  <i className="fas fa-shield-alt" style={{ marginRight: 6 }} />Code OTP requis
                </p>
                {ussd ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                    Veuillez composer <strong style={{ color: 'var(--green-primary)', fontSize: 15 }}>{ussd}</strong> sur votre
                    téléphone pour obtenir le code OTP, puis saisissez-le ci-dessous.
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                    Obtenez le code OTP auprès de votre opérateur, puis saisissez-le ci-dessous.
                  </p>
                )}
                <input type="text" placeholder="Code OTP" value={otp}
                  onChange={e => setOtp(e.target.value)} inputMode="numeric" />
              </div>
            )}

            {isWave && (
              <div className="card" style={{ background: 'rgba(0,191,255,0.10)', border: '1px solid rgba(0,191,255,0.35)', marginBottom: 16, padding: '12px 16px' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <i className="fas fa-external-link-alt" style={{ marginRight: 6, color: '#00a2c7' }} />
                  Vous serez redirigé vers l'application <strong>Wave</strong> pour valider le paiement.
                </p>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : (
                <><i className="fas fa-paper-plane" /> Déposer {montantNum > 0 ? `${fmt(montantNum)} FCFA` : ''}</>
              )}
            </button>
          </form>
          )}
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {history.length === 0 ? (
            <div className="empty-state"><i className="fas fa-history" /><p>Aucun dépôt</p></div>
          ) : (
            history.map(d => (
              <button key={d.id} onClick={() => setReceipt({
                id: `depot-${d.id}`, kind: 'depot', label: 'Dépôt',
                montant: d.montant, sens: '+', statut: d.statut, date: d.date_depot,
                details: { pays: d.pays, operateur: d.operateur, numero_payeur: d.numero_payeur },
              })} className="card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{fmt(d.montant)} FCFA</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.pays} • {d.operateur}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(d.date_depot).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <span className={`badge badge-${statusColor[d.statut] || 'yellow'}`}>
                    <span className={`status-dot ${statusColor[d.statut] || 'yellow'}`} />
                    {statusLabel[d.statut] || d.statut}
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
