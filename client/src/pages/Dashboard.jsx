import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';

const FAUX_NOTIFS = [
  'Jean C. a retiré 15,000 XAF',
  'Marie D. a investi dans le plan VIP 3',
  'Paul O. a reçu 8,500 XOF de revenus',
  'Alice B. a rejoint via parrainage',
  'Ibrahim S. a retiré 45,000 XOF',
  'Fatou N. a activé le plan VIP 5',
];

const STATIC_SLIDES = [
  { id: 's1', image: null, couleur: '#1B2A6B', titre: 'Investissez en Afrique', contenu: 'Des rendements jusqu\'à 19.5% par jour' },
  { id: 's2', image: null, couleur: '#000000', titre: 'Croissance Rapide', contenu: 'Maximisez vos revenus dès aujourd\'hui' },
  { id: 's3', image: null, couleur: '#a855f7', titre: 'Plans VIP Exclusifs', contenu: 'Accédez à des opportunités premium' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slideIdx, setSlideIdx] = useState(0);
  const [notifIdx, setNotifIdx] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [posts, setPosts] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const annTimerRef = useRef(null);
  const slideTimerRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Chargement initial en PARALLÈLE (au lieu de 3 requêtes l'une après l'autre).
    Promise.all([loadData(), loadPosts(), loadAnnonces()]);

    const notifTimer = setInterval(() => setNotifIdx(i => (i + 1) % FAUX_NOTIFS.length), 3000);
    setTimeout(() => setShowPopup(true), 1500);

    // Polling annonces toutes les 30s, mais UNIQUEMENT quand l'onglet est visible :
    // économise le réseau et ne ralentit pas l'app quand elle est en arrière-plan.
    const startAnnPolling = () => {
      if (annTimerRef.current) clearInterval(annTimerRef.current);
      annTimerRef.current = setInterval(loadAnnonces, 30000);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(annTimerRef.current);
        annTimerRef.current = null;
      } else {
        loadAnnonces();
        startAnnPolling();
      }
    };
    if (!document.hidden) startAnnPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(notifTimer);
      clearInterval(annTimerRef.current);
      clearInterval(slideTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Redémarrer le timer du slider quand les annonces changent
  useEffect(() => {
    clearInterval(slideTimerRef.current);
    const slides = annonces.length > 0 ? annonces : STATIC_SLIDES;
    slideTimerRef.current = setInterval(() => {
      setSlideIdx(i => (i + 1) % slides.length);
    }, 4000);
    return () => clearInterval(slideTimerRef.current);
  }, [annonces]);

  const loadData = async () => {
    try {
      const res = await api.get('/user/dashboard');
      setData(res.data);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  const loadPosts = async () => {
    try {
      const res = await api.get('/posts');
      setPosts(res.data.posts || []);
    } catch {}
  };

  const loadAnnonces = async () => {
    try {
      const res = await api.get('/annonces');
      const list = res.data.annonces || [];
      setAnnonces(list);
      setSlideIdx(i => list.length > 0 ? i % list.length : 0);
    } catch {}
  };

  const formatAmount = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
  const devise = data?.user?.pays === 'Cameroun' ? 'XAF' : 'XOF';

  const slides = annonces.length > 0 ? annonces : STATIC_SLIDES;
  const cur = slides[slideIdx % slides.length] || slides[0];
  const isImage = !!cur.image;

  if (loading) return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      {showPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 28, maxWidth: 340, width: '100%', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <Logo size="lg" />
            </div>
            <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 18 }}>Bienvenue sur GIFETAL PRO</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Investissez intelligemment et regardez votre placement générer automatiquement des revenus chaque jour. Rejoins notre communauté dès maintenant pour être à l'affût des actualités
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowPopup(false)} style={{ flex: 1, padding: '10px' }}>Fermer</button>
              <button className="btn btn-primary" onClick={() => { setShowPopup(false); navigate('/community'); }} style={{ flex: 1, padding: '10px' }}>REJOINDRE LA COMMUNAUTÉ</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', gap: 10 }}>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/admin')} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.3)', color: 'var(--blue-primary)', cursor: 'pointer' }}>
              <i className="fas fa-shield-alt" />
            </button>
          )}
          <button onClick={() => navigate('/account')} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <i className="fas fa-user" />
          </button>
        </div>
      </div>

      {/* Slider affiches */}
      <div style={{ margin: '0 16px 16px', borderRadius: 16, overflow: 'hidden', position: 'relative', height: 200, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        {isImage ? (
          // Affiche image admin
          <img
            src={`/uploads/${cur.image}`}
            alt="Affiche"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.4s' }}
          />
        ) : (
          // Slide texte par défaut
          <>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${cur.couleur || '#1B2A6B'}26, ${cur.couleur || '#000000'}18)`, transition: 'background 0.5s ease' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '60px 20px 20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
              <p style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{cur.titre}</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{cur.contenu}</p>
            </div>
          </>
        )}

        {/* Indicateurs */}
        <div style={{ position: 'absolute', bottom: 10, right: 14, display: 'flex', gap: 4 }}>
          {slides.map((_, i) => (
            <div key={i} onClick={() => setSlideIdx(i)} style={{
              width: i === slideIdx ? 18 : 6, height: 6, borderRadius: 3, cursor: 'pointer', transition: 'all 0.3s',
              background: i === slideIdx ? '#fff' : 'rgba(255,255,255,0.4)',
            }} />
          ))}
        </div>

        {/* Badge EN DIRECT */}
        <div style={{ position: 'absolute', top: 12, left: 12 }}>
          <span className="badge badge-green">
            <i className="fas fa-circle" style={{ fontSize: 6, marginRight: 4 }} />EN DIRECT
          </span>
        </div>
      </div>

      {/* Solde */}
      <div style={{ margin: '0 16px 16px' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(27,42,107,0.15) 0%, rgba(0,0,0,0.15) 100%)', borderColor: 'rgba(27,42,107,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>
                <i className="fas fa-wallet" style={{ marginRight: 6, color: 'var(--green-primary)' }} />Solde Principal
              </p>
              <div className="amount-large">{formatAmount(data?.user?.solde)} {devise}</div>
            </div>
            <Logo size="sm" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(27,42,107,0.2)' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Revenus totaux</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-primary)' }}>{formatAmount(data?.user?.revenus_totaux)} {devise}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Filleuls</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue-primary)' }}>{data?.user?.nombre_filleuls || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div style={{ margin: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { icon: 'fa-arrow-down', label: 'Dépôt', path: '/deposit', color: 'var(--green-primary)' },
          { icon: 'fa-hand-holding-usd', label: 'Retrait', path: '/withdrawal', color: 'var(--blue-primary)' },
          { icon: 'fa-dice', label: 'Roue', path: '/wheel', color: '#f59e0b' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            cursor: 'pointer', transition: 'var(--transition)',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${item.icon}`} style={{ fontSize: 18, color: item.color }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Menu secondaire */}
      <div style={{ margin: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[
          { icon: 'fa-chart-line', label: 'Plans', path: '/investment' },
          { icon: 'fa-receipt', label: 'Transactions', path: '/transactions' },
          { icon: 'fa-users', label: 'Filleuls', path: '/referral' },
          { icon: 'fa-crown', label: 'Salaire', path: '/salary' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 12, padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            cursor: 'pointer', transition: 'var(--transition)',
          }}>
            <i className={`fas ${item.icon}`} style={{ fontSize: 16, color: 'var(--blue-primary)' }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{item.label}</span>
          </button>
        ))}
      </div>

      <button className="btn btn-primary" onClick={() => navigate('/faq')} style={{
        margin: '0 16px 16px', width: 'calc(100% - 32px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        borderRadius: 12, padding: '14px',
      }}>
        <i className="fas fa-question-circle" style={{ fontSize: 18 }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>FAQ &amp; SUPPORT</span>
      </button>

      {/* Bandeau notifs */}
      <div style={{ margin: '0 16px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '10px 14px' }}>
        <p style={{ color: 'var(--green-primary)', fontSize: 12 }}>
          <i className="fas fa-bell" style={{ marginRight: 8 }} />{FAUX_NOTIFS[notifIdx]}
        </p>
      </div>

      {/* Plans actifs */}
      {data?.commandes_actives?.length > 0 && (
        <div style={{ margin: '0 16px 16px' }}>
          <p className="section-title"><i className="fas fa-chart-bar" style={{ marginRight: 8 }} />Plans actifs</p>
          {data.commandes_actives.map(cmd => (
            <div key={cmd.id} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{cmd.plan_nom}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Fin: {new Date(cmd.date_fin).toLocaleDateString('fr-FR')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: 'var(--green-primary)', fontWeight: 700, fontSize: 15 }}>+{formatAmount(cmd.revenu_journalier)}/j</p>
                  <span className="badge badge-green">Actif</span>
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-outline" onClick={() => navigate('/orders')} style={{ fontSize: 13 }}>
            <i className="fas fa-list" /> Voir tout
          </button>
        </div>
      )}

      {/* Posts communauté */}
      {posts.length > 0 && (
        <div style={{ margin: '0 16px 16px' }}>
          <p className="section-title"><i className="fas fa-newspaper" style={{ marginRight: 8 }} />Communauté</p>
          {posts.slice(0, 3).map(post => (
            <div key={post.id} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1B2A6B,#000000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                  {post.nom?.[0]?.toUpperCase() || 'U'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 13 }}>{post.nom}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{post.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
