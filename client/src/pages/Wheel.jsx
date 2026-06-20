import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';

// ─── Segments (doit correspondre exactement à posts.js côté serveur) ─────────
const SEGMENTS = [
  { label: '0',     value: 0,      color: '#1a1f4b' }, // 0  - navy
  { label: '×2',    value: 'x2',   color: '#F5C518' }, // 1  - gold
  { label: '100',   value: 100,    color: '#2563eb' }, // 2  - blue
  { label: '0',     value: 0,      color: '#111111' }, // 3  - black
  { label: '5000',  value: 5000,   color: '#0d9488' }, // 4  - teal
  { label: '×0.5',  value: 'x05',  color: '#475569' }, // 5  - slate
  { label: '200',   value: 200,    color: '#dc2626' }, // 6  - red
  { label: '0',     value: 0,      color: '#1a1f4b' }, // 7  - navy
  { label: '10000', value: 10000,  color: '#ea580c' }, // 8  - orange
  { label: '50',    value: 50,     color: '#d97706' }, // 9  - amber
  { label: '×10',   value: 'x10',  color: '#9333ea' }, // 10 - purple
  { label: '0',     value: 0,      color: '#111111' }, // 11 - black
  { label: '500',   value: 500,    color: '#7c3aed' }, // 12 - violet
  { label: '1000',  value: 1000,   color: '#ca8a04' }, // 13 - dark gold
  { label: '10',    value: 10,     color: '#0891b2' }, // 14 - cyan
  { label: '2000',  value: 2000,   color: '#db2777' }, // 15 - pink
];

const N = SEGMENTS.length;       // 16
const SEG_DEG = 360 / N;         // 22.5°

// ─── Overlay WIN avec feux d'artifice ────────────────────────────────────────
function WinOverlay({ result, onClose }) {
  const gainLabel = useMemo(() => {
    if (result?.outcomeType === 'x2') return `×2 — ${result.gain?.toLocaleString('fr-FR')} FCFA`;
    if (result?.outcomeType === 'x05') return `×0.5 récupéré — ${result.gain?.toLocaleString('fr-FR')} FCFA`;
    return `+${result?.gain?.toLocaleString('fr-FR')} FCFA`;
  }, [result]);

  const bursts = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i,
    color: ['#F5C518','#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#06b6d4'][i % 8],
    size: 6 + (i % 5) * 2,
    dx: Math.round(Math.cos(i * 0.45) * (80 + (i % 3) * 60)),
    dy: Math.round(Math.sin(i * 0.45) * (80 + (i % 3) * 60)),
    delay: (i % 12) * 0.12,
    dur: 0.8 + (i % 4) * 0.2,
    round: i % 3 !== 0,
  })), []);

  const confetti = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${(i * 2.5) % 100}%`,
    color: ['#F5C518','#ef4444','#3b82f6','#22c55e','#a855f7'][i % 5],
    size: 6 + (i % 4) * 2,
    dur: 2 + (i % 4) * 0.5,
    delay: (i % 10) * 0.2,
    round: i % 2 === 0,
  })), []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes burst {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--bdx),var(--bdy)) scale(0); opacity: 0; }
        }
        @keyframes fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
        }
        @keyframes winPulse {
          0%,100% { transform: scale(1);    text-shadow: 0 0 40px rgba(245,197,24,0.8),0 0 80px rgba(245,197,24,0.4); }
          50%      { transform: scale(1.10); text-shadow: 0 0 60px rgba(245,197,24,1),  0 0 120px rgba(245,197,24,0.6); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(30px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* Burst particles */}
      {bursts.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: '50%', top: '42%',
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.round ? '50%' : '2px',
          '--bdx': `${p.dx}px`, '--bdy': `${p.dy}px`,
          animation: `burst ${p.dur}s ${p.delay}s ease-out forwards`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Confetti tombant */}
      {confetti.map(c => (
        <div key={c.id} style={{
          position: 'absolute', left: c.left, top: '-20px',
          width: c.size, height: c.size,
          background: c.color,
          borderRadius: c.round ? '50%' : '2px',
          animation: `fall ${c.dur}s ${c.delay}s ease-in forwards`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Texte WIN */}
      <div style={{
        fontSize: 96, fontWeight: 900, color: '#F5C518',
        lineHeight: 1, letterSpacing: -2,
        animation: 'winPulse 0.7s infinite',
        fontFamily: 'Inter, sans-serif',
      }}>
        WIN!
      </div>

      <div style={{
        fontSize: 26, fontWeight: 800, color: '#ffffff',
        marginTop: 12,
        animation: 'slideUp 0.4s 0.1s ease both',
        textShadow: '0 2px 12px rgba(0,0,0,0.6)',
      }}>
        {gainLabel}
      </div>

      <div style={{
        fontSize: 13, color: 'rgba(255,255,255,0.4)',
        marginTop: 36,
        padding: '10px 28px',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 24,
        animation: 'slideUp 0.4s 0.3s ease both',
      }}>
        Touchez pour continuer
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Wheel() {
  const [canSpin, setCanSpin]             = useState(false);
  const [spinning, setSpinning]           = useState(false);
  const [rotation, setRotation]           = useState(0);
  const [result, setResult]               = useState(null);
  const [showWin, setShowWin]             = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [loading, setLoading]             = useState(true);
  const [solde, setSolde]                 = useState(0);
  const [mise, setMise]                   = useState(100);
  const [cyclePos, setCyclePos]           = useState(0);
  const [mode, setMode]                   = useState('reel'); // 'reel' | 'demo'
  const [pendingRecharge, setPendingRecharge] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const rotRef = useRef(0);
  const audioRef = useRef(null);

  // ── Taille responsive : s'adapte à l'écran sans dépasser 260px ──────────
  const WHEEL_SIZE = useMemo(
    () => Math.min(260, (typeof window !== 'undefined' ? window.innerWidth : 320) - 56),
    []
  );

  useEffect(() => { loadStatus(); }, [mode]);

  // ── Musique de fond : démarre à l'entrée dans la Roue ────────────────────────
  useEffect(() => {
    let cancelled = false;
    let startOnGesture = null;
    (async () => {
      try {
        const res = await api.get('/public/roue-music');
        const url = res.data?.url;
        if (!url || cancelled) return;
        const audio = new Audio(url);
        audio.loop = true;
        audio.volume = 0.6;
        audioRef.current = audio;
        // Tentative de lecture immédiate ; si bloquée par le navigateur,
        // on démarre au premier geste de l'utilisateur sur la page.
        audio.play().catch(() => {
          if (cancelled) return; // composant démonté entre-temps : ne pas attacher
          startOnGesture = () => {
            audio.play().catch(() => {});
            document.removeEventListener('pointerdown', startOnGesture);
            document.removeEventListener('keydown', startOnGesture);
          };
          document.addEventListener('pointerdown', startOnGesture);
          document.addEventListener('keydown', startOnGesture);
        });
      } catch { /* pas de musique configurée */ }
    })();
    return () => {
      cancelled = true;
      if (startOnGesture) {
        document.removeEventListener('pointerdown', startOnGesture);
        document.removeEventListener('keydown', startOnGesture);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    rotRef.current = rotation;
    drawWheel(rotation);
  }, [rotation]);

  useEffect(() => {
    if (!canSpin && remainingTime > 0) {
      const t = setInterval(() => setRemainingTime(s => Math.max(0, s - 1)), 1000);
      return () => clearInterval(t);
    }
  }, [canSpin, remainingTime]);

  const loadStatus = async () => {
    setLoading(true);
    setResult(null);
    setShowWin(false);
    try {
      if (mode === 'demo') {
        const res = await api.get('/demo/status');
        setSolde(res.data.solde || 0);
        setCyclePos(res.data.cyclePos || 0);
        setPendingRecharge(!!res.data.pendingRecharge);
        setCanSpin(false);           // pas de tour gratuit en mode démo
        setRemainingTime(0);
      } else {
        const res = await api.get('/posts/spin');
        setCanSpin(res.data.canSpin);
        setRemainingTime(res.data.remainingSeconds);
        setSolde(res.data.solde || 0);
        setCyclePos(res.data.cyclePos || 0);
      }
    } catch {}
    finally { setLoading(false); }
  };

  // ── Demande de rechargement du solde démo ────────────────────────────────
  const handleRecharge = async () => {
    try {
      const res = await api.post('/demo/recharge');
      toast.success(res.data?.message || 'Demande envoyée');
      setPendingRecharge(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    }
  };

  // ── Dessin de la roue ────────────────────────────────────────────────────
  const drawWheel = useCallback((rot = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = cx - 6;
    const segAngle = (2 * Math.PI) / N;
    const rotRad = (rot * Math.PI) / 180;

    ctx.clearRect(0, 0, size, size);

    // Segments
    SEGMENTS.forEach((seg, i) => {
      const start = rotRad + i * segAngle;
      const end   = start + segAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, start, end);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      // Séparateur doré
      ctx.strokeStyle = '#F5C518';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Texte du segment
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + segAngle / 2);
      ctx.fillStyle = '#ffffff';
      const fs = seg.label.length >= 5 ? 9 : seg.label.length === 4 ? 10 : 12;
      ctx.font = `bold ${fs}px Inter,sans-serif`;
      ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 5;
      ctx.fillText(seg.label, outerR - 8, 4);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Anneau doré extérieur
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = '#F5C518';
    ctx.lineWidth = 10;
    ctx.shadowColor = 'rgba(245,197,24,0.5)';
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Petites gemmes sur l'anneau (aux jonctions de segments)
    for (let i = 0; i < N; i++) {
      const angle = rotRad + i * segAngle;
      const gx = cx + Math.cos(angle) * (outerR + 1);
      const gy = cy + Math.sin(angle) * (outerR + 1);
      ctx.beginPath();
      ctx.arc(gx, gy, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#F5C518';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Hub central doré
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    const hubGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 22);
    hubGrad.addColorStop(0, '#ffe066');
    hubGrad.addColorStop(1, '#b8860b');
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Texte du hub
    ctx.fillStyle = '#1B2A6B';
    ctx.font = 'bold 9px Inter,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPIN', cx, cy + 3);
  }, []);

  // ── Animation vers un index cible ────────────────────────────────────────
  const animateToIndex = (index, onDone) => {
    const target = (((270 - (index + 0.5) * SEG_DEG) % 360) + 360) % 360;
    const current = ((rotRef.current % 360) + 360) % 360;
    const delta = (((target - current) % 360) + 360) % 360;
    const finalRot = rotRef.current + 7 * 360 + delta;

    const startRot = rotRef.current;
    const totalDelta = finalRot - startRot;
    const duration = 4800;
    let startTs = null;

    const frame = (ts) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const newRot = startRot + totalDelta * eased;
      rotRef.current = newRot;
      setRotation(newRot);
      if (progress < 1) requestAnimationFrame(frame);
      else onDone();
    };
    requestAnimationFrame(frame);
  };

  // ── Spin gratuit ─────────────────────────────────────────────────────────
  const handleFreeSpin = async () => {
    if (!canSpin || spinning) return;
    setSpinning(true);
    setResult(null);
    setShowWin(false);
    try {
      const res = await api.post('/posts/spin');
      const { gain, index } = res.data;
      animateToIndex(index, () => {
        const r = { gain, outcomeType: gain > 0 ? 'win' : 'zero' };
        setResult(r);
        setCanSpin(false);
        setRemainingTime(48 * 3600);
        setSpinning(false);
        if (gain > 0) {
          setSolde(s => s + gain);
          setShowWin(true);
        } else {
          toast('Pas de chance cette fois...', { icon: '😔' });
        }
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
      setSpinning(false);
    }
  };

  // ── Spin payant ───────────────────────────────────────────────────────────
  const handleBetSpin = async () => {
    if (spinning) return;
    const m = parseInt(mise) || 0;
    if (m < 100)    { toast.error('La mise minimum est de 100 FCFA'); return; }
    if (m > solde)  { toast.error('Solde insuffisant'); return; }
    setSpinning(true);
    setResult(null);
    setShowWin(false);
    setSolde(s => s - m);
    try {
      const endpoint = mode === 'demo' ? '/demo/spin-bet' : '/posts/spin-bet';
      const res = await api.post(endpoint, { mise: m });
      const { gain, index, outcomeType, cyclePos: newCyclePos } = res.data;
      setCyclePos(newCyclePos || 0);
      animateToIndex(index, () => {
        const r = { gain, outcomeType, mise: m };
        setResult(r);
        setSpinning(false);
        if (gain > 0) {
          setSolde(s => s + gain);
          setShowWin(true);
        } else {
          toast('Perdu ! Retentez votre chance.', { icon: '😔' });
        }
      });
    } catch (err) {
      setSolde(s => s + m); // remboursement local
      toast.error(err.response?.data?.error || 'Erreur');
      setSpinning(false);
    }
  };

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
  };

  const adjustMise = (delta) => {
    setMise(prev => Math.max(100, Math.min(parseInt(prev || 0) + delta, solde)));
  };
  const setMaxMise = () => setMise(Math.max(100, Math.floor(solde / 100) * 100));

  // ── Étoiles de fond (mémorisées) ─────────────────────────────────────────
  const stars = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${(i * 4.2 + 1) % 100}%`,
    top:  `${(i * 7.3 + 2) % 65}%`,
    delay: `${(i * 0.31) % 2}s`,
    dur:   `${1.5 + (i * 0.17) % 1.5}s`,
    size:  i % 3 === 0 ? 3 : 2,
  })), []);

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #04081a 0%, #0d163a 55%, #1B2A6B 100%)',
      paddingBottom: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity:.25; transform:scale(.8); }
          50%      { opacity:1;   transform:scale(1.3); }
        }
        @keyframes spinBtn {
          0%,100% { box-shadow: 0 4px 24px rgba(22,163,74,0.4), 0 0 0 0 rgba(22,163,74,0.3); }
          50%      { box-shadow: 0 4px 32px rgba(22,163,74,0.6), 0 0 0 8px rgba(22,163,74,0); }
        }
        @keyframes bannerGlow {
          0%,100% { text-shadow: 0 0 16px rgba(245,197,24,0.5); }
          50%      { text-shadow: 0 0 32px rgba(245,197,24,0.9); }
        }
      `}</style>

      {/* Étoiles de fond */}
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size,
          background: '#F5C518', borderRadius: '50%',
          animation: `twinkle ${s.dur} ${s.delay} infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Overlay WIN */}
      {showWin && result && (
        <WinOverlay result={result} onClose={() => setShowWin(false)} />
      )}

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 6px',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
            border: '1px solid rgba(245,197,24,0.35)',
            background: 'rgba(245,197,24,0.10)',
            color: '#F5C518', fontSize: 15,
          }}
        >
          <i className="fas fa-arrow-left" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, textTransform: 'uppercase' }}>
            Roue de la Fortune
          </div>
        </div>

        {/* Solde */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(245,197,24,0.12)',
          border: '1px solid rgba(245,197,24,0.4)',
          borderRadius: 20, padding: '6px 12px',
        }}>
          <i className="fas fa-coins" style={{ color: '#F5C518', fontSize: 12 }} />
          <span style={{ color: '#F5C518', fontWeight: 700, fontSize: 13 }}>
            {solde.toLocaleString('fr-FR')}
          </span>
        </div>
      </div>

      {/* ── Sélecteur de mode Réel / Démo ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '4px 16px 0' }}>
        {[
          { key: 'reel', label: 'Réel', icon: 'fa-wallet' },
          { key: 'demo', label: 'Démo', icon: 'fa-flask' },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => { if (!spinning && mode !== m.key) setMode(m.key); }}
            disabled={spinning}
            style={{
              flex: 1, maxWidth: 160, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
              border: mode === m.key ? '1.5px solid rgba(245,197,24,0.7)' : '1px solid rgba(255,255,255,0.12)',
              background: mode === m.key ? 'rgba(245,197,24,0.16)' : 'rgba(255,255,255,0.04)',
              color: mode === m.key ? '#F5C518' : 'rgba(255,255,255,0.55)',
              fontWeight: 700, fontSize: 13,
            }}
          >
            <i className={`fas ${m.icon}`} style={{ marginRight: 6 }} />{m.label}
          </button>
        ))}
      </div>

      {/* Badge mode démo */}
      {mode === 'demo' && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{
            display: 'inline-block', padding: '3px 14px', borderRadius: 20,
            background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.4)',
            color: '#F5C518', fontWeight: 700, fontSize: 11, letterSpacing: 1.5,
          }}>
            MODE DÉMO — SOLDE FICTIF
          </span>
        </div>
      )}

      {/* ── Bandeau SUPER SPIN ── */}
      <div style={{ textAlign: 'center', margin: '6px 0 10px' }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 28px',
          borderTop: '1px solid rgba(245,197,24,0.45)',
          borderBottom: '1px solid rgba(245,197,24,0.45)',
          background: 'linear-gradient(90deg, transparent, rgba(245,197,24,0.10), transparent)',
        }}>
          <span style={{
            color: '#F5C518', fontWeight: 900, fontSize: 15,
            letterSpacing: 2.5, textTransform: 'uppercase',
            animation: 'bannerGlow 2s infinite',
          }}>
            ★ SUPER SPIN ★ LUCKY DAY ★
          </span>
        </div>
      </div>

      {/* ── Roue ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', width: '100%',
      }}>
        {/* Pointeur */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', top: -18, left: '50%',
            transform: 'translateX(-50%)', zIndex: 10,
            filter: 'drop-shadow(0 3px 8px rgba(245,197,24,0.7))',
          }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '15px solid transparent',
              borderRight: '15px solid transparent',
              borderTop: '30px solid #F5C518',
            }} />
          </div>

          {/* Anneau extérieur lumineux */}
          <div style={{
            borderRadius: '50%', padding: 7,
            background: 'linear-gradient(135deg, #ffe066 0%, #ca8a04 50%, #ffe066 100%)',
            boxShadow: '0 0 28px rgba(245,197,24,0.55), 0 0 60px rgba(245,197,24,0.22)',
          }}>
            <canvas
              ref={canvasRef}
              width={WHEEL_SIZE}
              height={WHEEL_SIZE}
              style={{ borderRadius: '50%', display: 'block' }}
            />
          </div>
        </div>

      </div>

      {/* ── Message perte ── */}
      {result !== null && !showWin && result.gain === 0 && (
        <div style={{
          margin: '10px 16px 0',
          padding: '10px 16px',
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.22)',
          borderRadius: 12, textAlign: 'center',
          color: '#fca5a5', fontWeight: 600, fontSize: 14,
        }}>
          😔 Pas de chance — Réessayez !
        </div>
      )}

      {/* ── Contrôles ── */}
      <div style={{ padding: '12px 16px 0' }}>

        {/* Tour gratuit disponible — bannière cliquable qui lance le tour */}
        {!loading && canSpin && (
          <button
            type="button"
            onClick={handleFreeSpin}
            disabled={spinning}
            style={{
              display: 'block', width: '100%',
              background: 'rgba(245,197,24,0.10)',
              border: '1px solid rgba(245,197,24,0.30)',
              borderRadius: 12, padding: '8px 14px',
              marginBottom: 10, textAlign: 'center',
              color: '#F5C518', fontSize: 13, fontWeight: 600,
              cursor: spinning ? 'default' : 'pointer',
              opacity: spinning ? 0.6 : 1,
            }}
          >
            <i className="fas fa-gift" style={{ marginRight: 6 }} />
            {spinning ? 'Rotation en cours...' : 'Tour gratuit disponible — Cliquez pour jouer !'}
          </button>
        )}

        {/* Compte à rebours */}
        {!loading && !canSpin && remainingTime > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '7px 14px',
            marginBottom: 10, textAlign: 'center',
            color: 'rgba(255,255,255,0.45)', fontSize: 12,
          }}>
            <i className="fas fa-clock" style={{ marginRight: 6 }} />
            Prochain gratuit dans{' '}
            <span style={{ color: '#F5C518', fontWeight: 700 }}>
              {formatTime(remainingTime)}
            </span>
          </div>
        )}

        {/* Rechargement du solde démo (quand on ne peut plus miser) */}
        {!loading && mode === 'demo' && solde < 100 && (
          pendingRecharge ? (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '10px 14px',
              marginBottom: 10, textAlign: 'center',
              color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600,
            }}>
              <i className="fas fa-hourglass-half" style={{ marginRight: 6 }} />
              Demande de rechargement en attente de validation…
            </div>
          ) : (
            <button
              onClick={handleRecharge}
              style={{
                width: '100%', padding: '12px', borderRadius: 12, cursor: 'pointer',
                marginBottom: 10, border: '1.5px solid rgba(245,197,24,0.7)',
                background: 'rgba(245,197,24,0.16)',
                color: '#F5C518', fontWeight: 800, fontSize: 14,
              }}
            >
              <i className="fas fa-rotate-right" style={{ marginRight: 6 }} />
              Demander un rechargement (100 000)
            </button>
          )
        )}

        {/* Mise */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => adjustMise(-100)}
            disabled={spinning || parseInt(mise) <= 100}
            style={{
              width: 46, height: 46, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              border: '2px solid rgba(245,197,24,0.4)',
              background: 'rgba(245,197,24,0.08)',
              color: '#F5C518', fontSize: 22, fontWeight: 700,
              opacity: parseInt(mise) <= 100 ? 0.35 : 1,
            }}
          >−</button>

          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12, padding: '8px 10px',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 1, letterSpacing: 1 }}>MISE</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                {(parseInt(mise) || 0).toLocaleString('fr-FR')}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>FCFA</span>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
              Win up to{' '}
              <span style={{ color: '#F5C518', fontWeight: 600 }}>
                {((parseInt(mise) || 0) * 10).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>

          <button
            onClick={() => adjustMise(+100)}
            disabled={spinning || parseInt(mise) >= solde}
            style={{
              width: 46, height: 46, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              border: '2px solid rgba(245,197,24,0.4)',
              background: 'rgba(245,197,24,0.08)',
              color: '#F5C518', fontSize: 22, fontWeight: 700,
              opacity: parseInt(mise) >= solde ? 0.35 : 1,
            }}
          >+</button>
        </div>

        {/* Boutons Spin */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* MAX BET */}
          <button
            onClick={setMaxMise}
            disabled={spinning}
            style={{
              padding: '14px 12px', borderRadius: 14, cursor: 'pointer', flexShrink: 0,
              border: '2px solid rgba(245,197,24,0.35)',
              background: 'rgba(245,197,24,0.08)',
              color: '#F5C518', fontWeight: 700, fontSize: 11,
              letterSpacing: 0.5,
            }}
          >
            MAX<br/>BET
          </button>

          {/* Gratuit */}
          {canSpin && (
            <button
              onClick={handleFreeSpin}
              disabled={spinning}
              style={{
                flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
                border: '2px solid rgba(245,197,24,0.55)',
                background: 'rgba(245,197,24,0.13)',
                color: '#F5C518', fontWeight: 800, fontSize: 14,
                opacity: spinning ? 0.5 : 1,
              }}
            >
              {spinning
                ? <i className="fas fa-spinner fa-spin" />
                : <><i className="fas fa-gift" style={{ marginRight: 6 }} />Gratuit</>}
            </button>
          )}

          {/* SPIN payant */}
          <button
            onClick={handleBetSpin}
            disabled={spinning || (parseInt(mise) || 0) > solde || (parseInt(mise) || 0) < 100}
            style={{
              flex: canSpin ? 2 : 3, padding: '14px', borderRadius: 14,
              border: 'none', cursor: 'pointer',
              background: ((parseInt(mise)||0) > solde || spinning)
                ? 'rgba(22,163,74,0.25)'
                : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff', fontWeight: 900, fontSize: 18,
              letterSpacing: 1.5,
              animation: !spinning && (parseInt(mise)||0) <= solde ? 'spinBtn 2s infinite' : 'none',
              opacity: ((parseInt(mise)||0) > solde || (parseInt(mise)||0) < 100) ? 0.45 : 1,
            }}
          >
            {spinning ? (
              <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Rotation...</>
            ) : (
              <>
                SPIN!
                <span style={{ fontSize: 10, fontWeight: 400, display: 'block', opacity: 0.7, letterSpacing: 0 }}>
                  Parier &amp; Tourner
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
