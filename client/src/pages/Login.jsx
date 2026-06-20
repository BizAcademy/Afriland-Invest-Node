import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';
import Logo from '../components/Logo';
import api from '../lib/api';

// Liste de secours si l'API des pays est momentanément indisponible.
const PAYS_FALLBACK = [
  { code: '+237', label: '🇨🇲 Cameroun (+237)' },
  { code: '+225', label: "🇨🇮 Côte d'Ivoire (+225)" },
  { code: '+221', label: '🇸🇳 Sénégal (+221)' },
  { code: '+223', label: '🇲🇱 Mali (+223)' },
  { code: '+229', label: '🇧🇯 Bénin (+229)' },
  { code: '+226', label: '🇧🇫 Burkina Faso (+226)' },
  { code: '+228', label: '🇹🇬 Togo (+228)' },
];

export default function Login() {
  const [form, setForm] = useState({ indicatif: '+237', telephone: '', mot_de_passe: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pays, setPays] = useState(PAYS_FALLBACK);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/public/countries')
      .then(res => {
        const list = (res.data.countries || []).map(c => ({
          code: `+${c.prefix}`,
          label: `${c.country_flag} ${c.country_name} (+${c.prefix})`,
        }));
        if (list.length > 0) setPays(list);
      })
      .catch(() => { /* on garde la liste de secours */ });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.telephone || !form.mot_de_passe) return toast.error('Remplissez tous les champs');
    setLoading(true);
    try {
      await login(form.indicatif, form.telephone, form.mot_de_passe);
      toast.success('Connexion réussie');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '0 16px', paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', padding: '60px 0 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logo size="lg" />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Connectez-vous à votre compte
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Pays</label>
          <select value={form.indicatif} onChange={e => setForm({ ...form, indicatif: e.target.value })}>
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
            <input
              type="tel" placeholder="600000000"
              value={form.telephone}
              onChange={e => setForm({ ...form, telephone: e.target.value })}
              style={{ paddingLeft: 60 }}
            />
          </div>
        </div>

        <div className="input-group">
          <label>Mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.mot_de_passe}
              onChange={e => setForm({ ...form, mot_de_passe: e.target.value })}
              style={{ paddingRight: 44 }}
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <i className={`fas fa-eye${showPass ? '-slash' : ''}`} />
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 10 }}>
          <Link to="/support" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Mot de passe oublié ?</Link>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : (
            <><i className="fas fa-sign-in-alt" /> Se connecter</>
          )}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-secondary)', fontSize: 14 }}>
        Pas encore de compte ?{' '}
        <Link to="/register" style={{ color: 'var(--green-primary)', fontWeight: 600 }}>S'inscrire</Link>
      </div>
    </div>
  );
}
