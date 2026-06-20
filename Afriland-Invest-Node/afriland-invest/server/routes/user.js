const express = require('express');
const { supabase } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      { data: user },
      { data: soldeRow },
      { data: vipRow },
      { count: filleulsCount },
    ] = await Promise.all([
      supabase.from('utilisateurs').select('id,nom,telephone,pays,code_parrainage,lien_parrainage,date_inscription').eq('id', userId).single(),
      supabase.from('soldes').select('solde').eq('user_id', userId).maybeSingle(),
      supabase.from('vip').select('niveau,pourcentage,invitations_requises,invitations_actuelles').eq('user_id', userId).maybeSingle(),
      supabase.from('utilisateurs').select('*', { count: 'exact', head: true }).eq('parrain_id', userId),
    ]);

    // Revenus totaux — somme cumulée de ce que l'utilisateur a RÉELLEMENT gagné :
    //   • revenu_journalier : revenus d'investissement
    //   • parrainage        : commissions d'affiliation
    //   • bonus / gain_roue : gains à la roue (tour gratuit + tour payant)
    // On exclut volontairement les mises (`mise_roue`) et tout débit : ainsi ce
    // total ne fait que croître et représente le cumul des gains de l'utilisateur.
    const { data: revenus } = await supabase
      .from('historique_revenus')
      .select('montant')
      .eq('user_id', userId)
      .in('type', ['revenu_journalier', 'parrainage', 'bonus', 'gain_roue']);
    const revenus_totaux = (revenus || []).reduce((sum, r) => sum + parseFloat(r.montant || 0), 0);

    // Commandes actives
    const today = new Date().toISOString().split('T')[0];
    const { data: commandes } = await supabase
      .from('commandes')
      .select('*, planinvestissement(nom, rendement_journalier, duree_jours)')
      .eq('user_id', userId)
      .eq('statut', 'actif')
      .gte('date_fin', today)
      .order('date_debut', { ascending: false })
      .limit(3);

    const commandes_actives = (commandes || []).map(c => ({
      ...c,
      plan_nom: c.planinvestissement?.nom,
      rendement_journalier: c.planinvestissement?.rendement_journalier,
      duree_jours: c.planinvestissement?.duree_jours,
      planinvestissement: undefined,
    }));

    res.json({
      user: { ...user, solde: soldeRow?.solde || 0, revenus_totaux, nombre_filleuls: filleulsCount || 0 },
      vip: vipRow || { niveau: 0, pourcentage: 0, invitations_requises: 3, invitations_actuelles: 0 },
      commandes_actives,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [{ data: user }, { data: soldeRow }] = await Promise.all([
      supabase.from('utilisateurs').select('id,nom,telephone,pays,code_parrainage,lien_parrainage,date_inscription').eq('id', userId).single(),
      supabase.from('soldes').select('solde').eq('user_id', userId).maybeSingle(),
    ]);
    res.json({ user, solde: soldeRow?.solde || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/transaction-password', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || !/^\d{4}$/.test(password)) {
      return res.status(400).json({ error: 'Le mot de passe doit être composé de 4 chiffres' });
    }
    const { error } = await supabase
      .from('transaction_passwords')
      .upsert({ user_id: req.user.id, password }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true, message: 'Mot de passe de transaction mis à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const { data: wallets } = await supabase
      .from('portefeuilles')
      .select('*')
      .eq('user_id', req.user.id);
    res.json({ wallets: wallets || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/wallet', authMiddleware, async (req, res) => {
  try {
    const { nom_portefeuille, pays, methode_paiement, numero_telephone } = req.body;
    if (!nom_portefeuille || !pays || !methode_paiement || !numero_telephone) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }
    const { error } = await supabase
      .from('portefeuilles')
      .upsert({ user_id: req.user.id, nom_portefeuille, pays, methode_paiement, numero_telephone }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true, message: 'Portefeuille enregistré' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune photo fournie' });
    const { error } = await supabase
      .from('photos_profil')
      .insert({ user_id: req.user.id, nom_fichier: req.file.filename });
    if (error) throw error;
    res.json({ success: true, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
