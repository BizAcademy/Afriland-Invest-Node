import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
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

const LS_IND = 'support_indicatif';
const LS_TEL = 'support_telephone';

export default function Support() {
  const [pays, setPays] = useState(PAYS_FALLBACK);
  const [indicatif, setIndicatif] = useState(localStorage.getItem(LS_IND) || '+237');
  const [telephone, setTelephone] = useState(localStorage.getItem(LS_TEL) || '');
  const [nom, setNom] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [identified, setIdentified] = useState(!!localStorage.getItem(LS_TEL));
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

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

  const loadThread = async (ind, tel) => {
    try {
      const res = await api.get('/support/thread', { params: { indicatif: ind, telephone: tel } });
      setMessages(res.data.messages || []);
    } catch { /* silencieux : on réessaie au prochain rafraîchissement */ }
  };

  useEffect(() => {
    if (!identified) return;
    loadThread(indicatif, telephone);
    const id = setInterval(() => loadThread(indicatif, telephone), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (texte, isFirst) => {
    setSending(true);
    try {
      await api.post('/support', { indicatif, telephone, nom, message: texte });
      if (isFirst) {
        localStorage.setItem(LS_IND, indicatif);
        localStorage.setItem(LS_TEL, telephone);
        setIdentified(true);
      }
      setMessage('');
      await loadThread(indicatif, telephone);
    } catch (err) {
      toast.error(err.response?.data?.error || "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleFirstSubmit = (e) => {
    e.preventDefault();
    if (!telephone.trim()) return toast.error('Entrez votre numéro de téléphone');
    if (!message.trim()) return toast.error('Écrivez votre message');
    send(message.trim(), true);
  };

  const handleReply = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    send(message.trim(), false);
  };

  const changeNumber = () => {
    localStorage.removeItem(LS_IND);
    localStorage.removeItem(LS_TEL);
    setIdentified(false);
    setMessages([]);
    setMessage('');
  };

  return (
    <div className="container" style={{ padding: '0 16px', paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', padding: '48px 0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo size="md" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>
          <i className="fas fa-headset" style={{ color: 'var(--green-primary)', marginRight: 8 }} />
          Assistance
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
          Mot de passe oublié ou autre problème ? Écrivez-nous, l'administrateur vous répondra ici.
        </p>
      </div>

      {!identified ? (
        <form onSubmit={handleFirstSubmit}>
          <div className="input-group">
            <label>Pays</label>
            <select value={indicatif} onChange={e => setIndicatif(e.target.value)}>
              {pays.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Numéro de téléphone</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--green-primary)', fontSize: 14, fontWeight: 600, pointerEvents: 'none'
              }}>{indicatif}</span>
              <input
                type="tel" placeholder="600000000"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                style={{ paddingLeft: 60 }}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Votre nom (facultatif)</label>
            <input type="text" placeholder="Nom et prénom" value={nom} onChange={e => setNom(e.target.value)} />
          </div>

          <div className="input-group">
            <label>Votre message</label>
            <textarea
              rows={4}
              placeholder="Ex : Bonjour, j'ai oublié mon mot de passe, merci de m'aider à le réinitialiser."
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={sending} style={{ marginTop: 8 }}>
            {sending ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : (
              <><i className="fas fa-paper-plane" /> Envoyer le message</>
            )}
          </button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              <i className="fas fa-phone" style={{ marginRight: 6 }} />{indicatif}{telephone}
            </p>
            <button onClick={changeNumber} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
              Changer de numéro
            </button>
          </div>

          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14,
            padding: 14, minHeight: 240, maxHeight: 460, overflowY: 'auto', marginBottom: 12,
          }}>
            {messages.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
                Aucun message pour le moment.
              </p>
            ) : messages.map(m => {
              const mine = m.expediteur === 'user';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    maxWidth: '80%', padding: '9px 13px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.45,
                    background: mine ? 'linear-gradient(135deg,var(--green-primary),var(--green-dark))' : 'rgba(0,0,0,0.06)',
                    color: mine ? '#fff' : 'var(--text-primary)',
                    borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
                  }}>
                    {!mine && <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, marginBottom: 3 }}>Support Afriland</p>}
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</p>
                    <p style={{ fontSize: 9, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                      {new Date(m.date_creation).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleReply} style={{ display: 'flex', gap: 8 }}>
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Écrire un message…"
              style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14 }}
            />
            <button type="submit" disabled={sending || !message.trim()} style={{
              padding: '12px 18px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,var(--green-primary),var(--green-dark))',
              color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}>
              <i className="fas fa-paper-plane" />
            </button>
          </form>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-secondary)', fontSize: 14 }}>
        <Link to="/login" style={{ color: 'var(--green-primary)', fontWeight: 600 }}>
          <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
