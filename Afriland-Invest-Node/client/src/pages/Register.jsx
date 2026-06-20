import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';
import Logo from '../components/Logo';
import api from '../lib/api';
import { getRefCode } from '../lib/cookies';

// Liste de secours si l'API des pays est momentanément indisponible.
const PAYS_FALLBACK = [
  { code: '+237', label: '🇨🇲 Cameroun (+237)', pays: 'Cameroun' },
  { code: '+225', label: "🇨🇮 Côte d'Ivoire (+225)", pays: "Côte d'Ivoire" },
  { code: '+221', label: '🇸🇳 Sénégal (+221)', pays: 'Sénégal' },
  { code: '+223', label: '🇲🇱 Mali (+223)', pays: 'Mali' },
  { code: '+229', label: '🇧🇯 Bénin (+229)', pays: 'Bénin' },
  { code: '+226', label: '🇧🇫 Burkina Faso (+226)', pays: 'Burkina Faso' },
  { code: '+228', label: '🇹🇬 Togo (+228)', pays: 'Togo' },
];

export default function Register() {
  const [searchParams] = useSearchParams();
  const refFromLink = (searchParams.get('p') || getRefCode() || '').toUpperCase();
  const codeLocked = !!refFromLink;
  const [form, setForm] = useState({
    nom: '', indicatif: '+237', telephone: '', pays: 'Cameroun',
    mot_de_passe: '', confirm: '', code_parrain: refFromLink,
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pays, setPays] = useState(PAYS_FALLBACK);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/public/countries')
      .then(res => {
        const list = (res.data.countries || []).map(c => ({
          code: `+${c.prefix}`,
          label: `${c.country_flag} ${c.country_name} (+${c.prefix})`,
          pays: c.country_name,
        }));
        if (list.length > 0) setPays(list);
      })
      .catch(() => { /* on garde la liste de secours */ });
  }, []);

  const handlePaysChange = (e) => {
    const selected = pays.find(p => p.code === e.target.value);
    setForm({ ...form, indicatif: e.target.value, pays: selected?.pays || '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom || !form.telephone || !form.mot_de_passe) return toast.error('Remplissez tous les champs obligatoires');
    if (form.mot_de_passe !== form.confirm) return toast.error('Les mots de passe ne correspondent pas');
    if (form.mot_de_passe.length < 6) return toast.error('Mot de passe trop court (6 caractères min)');
    setLoading(true);
    try {
      await register(form);
      toast.success('Compte créé avec succès !');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '0 16px', paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', padding: '50px 0 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size="lg" />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Créez votre compte d'investissement</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Nom complet</label>
          <input type="text" placeholder="Jean Dupont" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
        </div>

        <div className="input-group">
          <label>Pays</label>
          <select value={form.indicatif} onChange={handlePaysChange}>
            {pays.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label>Numéro de téléphone</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--green-primary)', fontSize: 14, fontWeight: 600, pointerEvents: 'none'
            }}>{form.indicatif}</span>
            <input type="tel" placeholder="600000000" value={form.telephone}
              onChange={e => setForm({ ...form, telephone: e.target.value })} style={{ paddingLeft: 60 }} />
          </div>
        </div>

        <div className="input-group">
          <label>Mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} placeholder="Minimum 6 caractères"
              value={form.mot_de_passe} onChange={e => setForm({ ...form, mot_de_passe: e.target.value })}
              style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <i className={`fas fa-eye${showPass ? '-slash' : ''}`} />
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>Confirmer le mot de passe</label>
          <input type="password" placeholder="Répétez votre mot de passe"
            value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />
        </div>

        <div className="input-group">
          <label>
            Code de parrainage{' '}
            {codeLocked
              ? <span style={{ color: 'var(--success)', fontWeight: 600 }}><i className="fas fa-lock" style={{ marginLeft: 4, marginRight: 2 }} />appliqué</span>
              : '(optionnel)'}
          </label>
          <input type="text" placeholder="Ex: ABC123" value={form.code_parrain}
            readOnly={codeLocked}
            onChange={e => { if (!codeLocked) setForm({ ...form, code_parrain: e.target.value.toUpperCase() }); }}
            style={codeLocked ? { background: 'rgba(27,42,107,0.06)', cursor: 'not-allowed', fontWeight: 700, letterSpacing: 1, color: 'var(--primary)' } : undefined} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : (
            <><i className="fas fa-user-plus" /> Créer mon compte</>
          )}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-secondary)', fontSize: 14 }}>
        Déjà inscrit ?{' '}
        <Link to="/login" style={{ color: 'var(--green-primary)', fontWeight: 600 }}>Se connecter</Link>
      </div>
    </div>
  );
}
