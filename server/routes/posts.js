const express = require('express');
const { supabase } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
// Sécurité : images uniquement. Empêche d'envoyer des fichiers .svg/.html/.js qui,
// servis publiquement depuis /uploads, pourraient exécuter du code (risque XSS).
const imageOnly = (req, file, cb) => {
  if (/\.(jpe?g|png|webp|gif|hei[cf]|bmp)$/i.test(file.originalname || '')) cb(null, true);
  else cb(new Error('Image uniquement (JPG, PNG, WEBP, GIF)'));
};
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageOnly });

// ─── Roue de la fortune ──────────────────────────────────────────────────────
// Toute la logique (cycle de 10 tours, tirage, débit/crédit, historique) est
// exécutée dans des fonctions SQL atomiques (FOR UPDATE) côté Supabase :
//   • spin_wheel_free(p_user_id)         → spin gratuit (48h)
//   • spin_wheel_paid(p_user_id, p_mise) → spin payant riggé
// Voir server/spin-functions.sql. Aucune logique de gain en JS → zéro
// race-condition, zéro double-débit, cycle garanti cohérent.

// ─── Posts ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { data: posts } = await supabase
      .from('posts')
      .select('*, utilisateurs(nom)')
      .eq('statut', 'valide')
      .order('date_creation', { ascending: false })
      .limit(20);
    const result = (posts || []).map(p => ({
      ...p, nom: p.utilisateurs?.nom, utilisateurs: undefined,
    }));
    res.json({ posts: result });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const message = (req.body.message || '').trim();
    const image = req.file ? req.file.filename : '';
    // Une publication doit contenir au minimum une capture d'écran OU un message.
    if (!message && !image) {
      return res.status(400).json({ error: "Ajoutez une capture d'écran ou un message" });
    }
    const { error } = await supabase
      .from('posts')
      .insert({ user_id: req.user.id, message, image, statut: 'en_attente' });
    if (error) throw error;
    res.json({ success: true, message: 'Publication soumise, en attente de validation' });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ─── Statut roue (lecture seule) ─────────────────────────────────────────────

router.get('/spin', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('utilisateurs')
      .select('last_spin_time, spin_cycle_pos')
      .eq('id', req.user.id)
      .single();

    const lastSpin = user?.last_spin_time;
    let canSpin = true, remainingSeconds = 0;
    if (lastSpin) {
      const elapsed = (Date.now() - new Date(lastSpin).getTime()) / 1000;
      if (elapsed < 48 * 3600) {
        canSpin = false;
        remainingSeconds = Math.ceil(48 * 3600 - elapsed);
      }
    }

    const { data: soldeRow } = await supabase
      .from('soldes').select('solde').eq('user_id', req.user.id).maybeSingle();

    res.json({
      canSpin,
      remainingSeconds,
      solde:    parseFloat(soldeRow?.solde || 0),
      cyclePos: user?.spin_cycle_pos || 0,
    });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ─── Spin gratuit ─────────────────────────────────────────────────────────────

router.post('/spin', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('spin_wheel_free', {
      p_user_id: req.user.id,
    });
    if (error) throw error;

    if (data?.error === 'COOLDOWN') {
      return res.status(400).json({
        error: 'Vous devez attendre 48h entre chaque spin gratuit',
        remainingSeconds: data.remainingSeconds,
      });
    }

    res.json({ success: true, gain: data.gain, index: data.index });
  } catch (err) {
    console.error('Free spin error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Spin payant ──────────────────────────────────────────────────────────────

router.post('/spin-bet', authMiddleware, async (req, res) => {
  try {
    const mise = parseInt(req.body.mise);
    if (!mise || mise < 100) {
      return res.status(400).json({ error: 'La mise minimum est de 100 FCFA' });
    }

    const { data, error } = await supabase.rpc('spin_wheel_paid', {
      p_user_id: req.user.id,
      p_mise:    mise,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('SOLDE_INSUFFISANT')) {
        return res.status(400).json({ error: 'Solde insuffisant' });
      }
      if (msg.includes('MISE_MIN')) {
        return res.status(400).json({ error: 'La mise minimum est de 100 FCFA' });
      }
      throw error;
    }

    res.json({
      success:     true,
      gain:        data.gain,
      index:       data.index,
      mise:        data.mise,
      outcomeType: data.outcomeType,
      newSolde:    data.newSolde,
      cyclePos:    data.cyclePos,
    });
  } catch (err) {
    console.error('Spin bet error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
