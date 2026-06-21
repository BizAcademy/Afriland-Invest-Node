const express = require('express');
const { supabase } = require('../db');
const { adminMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const afribapay = require('../services/afribapay');
const router = express.Router();

// Dossier des fichiers uploadés. Git ne versionne pas les dossiers vides, on
// s'assure donc qu'il existe (sinon multer échoue sur les serveurs neufs).
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* déjà présent */ }

// Mot de passe d'action admin (haché — le texte clair n'est jamais stocké dans le code).
// Exigé avant toute action sensible : créditer, débiter, modifier mot de passe / mot de passe de transaction.
const ACTION_PASSWORD_HASH = '$2a$10$inS6CJa90kbuo56ZJclAf.rweAyu4HoSv1ns8UDYkFQmdmtSQqdXe';

// Vérifie le mot de passe d'action fourni dans le corps de la requête.
// Renvoie true si valide, sinon répond avec une erreur 403 et renvoie false.
async function requireActionPassword(req, res) {
  const provided = req.body?.action_password;
  if (!provided) {
    res.status(403).json({ error: "Mot de passe d'action requis" });
    return false;
  }
  const ok = await bcrypt.compare(String(provided), ACTION_PASSWORD_HASH);
  if (!ok) {
    res.status(403).json({ error: "Mot de passe d'action incorrect" });
    return false;
  }
  return true;
}

// Récupère le rôle d'un utilisateur cible (pour les protections admin-sur-admin).
async function getTargetUser(id) {
  const { data } = await supabase
    .from('utilisateurs').select('id,role').eq('id', id).maybeSingle();
  return data;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, 'annonce_' + Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const planStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, 'plan_' + Date.now() + path.extname(file.originalname)),
});
const uploadPlan = multer({ storage: planStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const faqStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, 'faq_' + Date.now() + path.extname(file.originalname)),
});
const uploadFaq = multer({ storage: faqStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// Musique de fond de la Roue (audio uniquement, max 20 Mo).
const musicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* déjà présent */ }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => cb(null, 'roue_music_' + Date.now() + (path.extname(file.originalname) || '.mp3')),
});
const uploadMusic = multer({
  storage: musicStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Sur mobile, le type MIME peut être générique (application/octet-stream) :
    // on accepte aussi selon l'extension du fichier.
    const okMime = /^audio\//.test(file.mimetype);
    const okExt = /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(file.originalname || '');
    if (okMime || okExt) cb(null, true);
    else cb(new Error('Fichier audio uniquement (MP3, WAV, OGG…)'));
  },
});

// ─── STATS ───────────────────────────────────────────────────────────────────

router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      { count: usersCount },
      { count: usersToday },
      { data: depotsValides },
      { data: depotsAttente },
      { data: retraitsValides },
      { data: retraitsAttente },
      { count: commandesCount },
      { data: soldesTotaux },
    ] = await Promise.all([
      supabase.from('utilisateurs').select('*', { count: 'exact', head: true }),
      supabase.from('utilisateurs').select('*', { count: 'exact', head: true }).gte('date_inscription', todayStart.toISOString()),
      supabase.from('depots').select('montant').eq('statut', 'valide'),
      supabase.from('depots').select('montant', { count: 'exact' }).eq('statut', 'en_attente'),
      supabase.from('retraits').select('montant').eq('statut', 'valide'),
      supabase.from('retraits').select('montant', { count: 'exact' }).eq('statut', 'en_attente'),
      supabase.from('commandes').select('*', { count: 'exact', head: true }).eq('statut', 'actif'),
      // Le solde réel de chaque compte vit dans la table `soldes` (mise à jour par
      // les RPC). La colonne `utilisateurs.solde` n'est jamais alimentée : la lire
      // donnait un total cumulé toujours faux (≈ 0). On lit donc bien `soldes`.
      supabase.from('soldes').select('solde'),
    ]);

    const totalDepots = (depotsValides || []).reduce((s, d) => s + parseFloat(d.montant || 0), 0);
    const totalRetraits = (retraitsValides || []).reduce((s, r) => s + parseFloat(r.montant || 0), 0);
    const totalAttenteDepots = (depotsAttente || []).reduce((s, d) => s + parseFloat(d.montant || 0), 0);
    const totalAttenteRetraits = (retraitsAttente || []).reduce((s, r) => s + parseFloat(r.montant || 0), 0);
    const totalSoldes = (soldesTotaux || []).reduce((s, u) => s + parseFloat(u.solde || 0), 0);

    res.json({
      users: { count: usersCount || 0, today: usersToday || 0 },
      depots: { total: totalDepots, en_attente: depotsAttente?.length || 0, total_attente: totalAttenteDepots },
      retraits: { total: totalRetraits, en_attente: retraitsAttente?.length || 0, total_attente: totalAttenteRetraits },
      commandes: { count: commandesCount || 0 },
      balance: { nette: totalDepots - totalRetraits, soldes_utilisateurs: totalSoldes },
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── STATISTIQUES ROUE DE LA FORTUNE ──────────────────────────────────────────
// Gains de la plateforme générés par la roue uniquement.
//   mise_roue : montant négatif  => entrée d'argent pour la plateforme
//   bonus     : montant positif  => sortie d'argent (gain reversé au joueur)
//   Gain net plateforme = total des mises − total des bonus reversés.
// Heure locale Cameroun (WAT, UTC+1) pour le découpage par jour / par heure.
const WAT_OFFSET_MS = 60 * 60 * 1000;

function watParts(ts) {
  const d = new Date(new Date(ts).getTime() + WAT_OFFSET_MS);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(),
    hour: d.getUTCHours(),
    dayKey: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
  };
}
// Instant UTC correspondant à minuit (heure WAT) il y a `daysAgo` jours.
function watMidnightUtc(daysAgo = 0) {
  const nowWat = new Date(Date.now() + WAT_OFFSET_MS);
  return new Date(Date.UTC(nowWat.getUTCFullYear(), nowWat.getUTCMonth(), nowWat.getUTCDate() - daysAgo, 0, 0, 0) - WAT_OFFSET_MS);
}

router.get('/wheel-stats', adminMiddleware, async (req, res) => {
  try {
    const period = ['today', 'yesterday', '7days', 'all'].includes(req.query.period)
      ? req.query.period : 'today';

    // Fenêtre de récupération (on charge un peu large puis on filtre/regroupe en JS).
    let fetchStart = null;
    if (period === 'today') fetchStart = watMidnightUtc(0);
    else if (period === 'yesterday') fetchStart = watMidnightUtc(1);
    else if (period === '7days') fetchStart = watMidnightUtc(6);

    // Garde-fou : on borne le nombre de lignes récupérées pour éviter qu'une
    // requête « Tout » ne devienne trop lourde avec la croissance des données.
    // On prend les plus récentes en priorité (largement suffisant à cette échelle).
    const MAX_ROWS = 100000;
    let query = supabase
      .from('historique_revenus')
      .select('user_id, montant, type, date_paiement')
      .in('type', ['mise_roue', 'bonus'])
      .order('date_paiement', { ascending: false })
      .limit(MAX_ROWS);
    if (fetchStart) query = query.gte('date_paiement', fetchStart.toISOString());
    const { data: rows, error } = await query;
    if (error) throw error;

    // Bornes de la période sélectionnée.
    let periodStart = null, periodEnd = null;
    if (period === 'today') { periodStart = watMidnightUtc(0); periodEnd = new Date(); }
    else if (period === 'yesterday') { periodStart = watMidnightUtc(1); periodEnd = watMidnightUtc(0); }
    else if (period === '7days') { periodStart = watMidnightUtc(6); periodEnd = new Date(); }

    const inPeriod = (rows || []).filter(r => {
      if (!periodStart) return true;
      const t = new Date(r.date_paiement).getTime();
      return t >= periodStart.getTime() && t < periodEnd.getTime();
    });

    // Regroupement pour la courbe : par heure (jour) ou par jour (7 jours / tout).
    const byHour = period === 'today' || period === 'yesterday';
    const buckets = new Map(); // key -> { label, mises, bonus, net }
    const ensure = (key, label) => {
      if (!buckets.has(key)) buckets.set(key, { key, label, mises: 0, bonus: 0, net: 0 });
      return buckets.get(key);
    };
    if (byHour) {
      for (let h = 0; h < 24; h++) ensure(String(h), `${String(h).padStart(2, '0')}h`);
    }

    let totalMises = 0, totalBonus = 0, paidPlays = 0;
    const players = new Map(); // user_id -> { plays, totalMise, totalBonus, net }
    for (const r of inPeriod) {
      const montant = parseFloat(r.montant || 0);
      const p = watParts(r.date_paiement);
      const key = byHour ? String(p.hour) : p.dayKey;
      const label = byHour ? `${String(p.hour).padStart(2, '0')}h` : p.dayKey.slice(5);
      const b = ensure(key, label);
      const pl = players.get(r.user_id) || { user_id: r.user_id, plays: 0, totalMise: 0, totalBonus: 0, net: 0 };

      if (r.type === 'mise_roue') {
        const mise = Math.abs(montant);
        totalMises += mise; paidPlays += 1;
        b.mises += mise; b.net += mise;
        pl.plays += 1; pl.totalMise += mise; pl.net += mise;
      } else { // bonus
        totalBonus += montant;
        b.bonus += montant; b.net -= montant;
        pl.totalBonus += montant; pl.net -= montant;
      }
      players.set(r.user_id, pl);
    }

    // Pour 7 jours / tout : garantir l'ordre chronologique des points.
    let chart = Array.from(buckets.values());
    if (byHour) chart.sort((a, b) => Number(a.key) - Number(b.key));
    else chart.sort((a, b) => (a.key < b.key ? -1 : 1));
    chart = chart.map(({ label, mises, bonus, net }) => ({
      label, mises: Math.round(mises), bonus: Math.round(bonus), net: Math.round(net),
    }));

    // Top joueurs (par nombre de parties payantes, puis montant misé).
    const topRaw = Array.from(players.values())
      .filter(p => p.plays > 0 || p.totalBonus > 0)
      .sort((a, b) => b.plays - a.plays || b.totalMise - a.totalMise)
      .slice(0, 10);
    const ids = topRaw.map(p => p.user_id);
    let nameMap = {};
    if (ids.length) {
      const { data: us } = await supabase
        .from('utilisateurs').select('id, nom, telephone').in('id', ids);
      nameMap = Object.fromEntries((us || []).map(u => [u.id, u]));
    }
    const topPlayers = topRaw.map(p => ({
      id: p.user_id,
      nom: nameMap[p.user_id]?.nom || 'Inconnu',
      telephone: nameMap[p.user_id]?.telephone || '',
      plays: p.plays,
      totalMise: Math.round(p.totalMise),
      totalBonus: Math.round(p.totalBonus),
      net: Math.round(p.net),
    }));

    res.json({
      period,
      summary: {
        totalMises: Math.round(totalMises),
        totalBonus: Math.round(totalBonus),
        netGain: Math.round(totalMises - totalBonus),
        paidPlays,
        joueurs: players.size,
      },
      chart,
      topPlayers,
    });
  } catch (err) {
    console.error('wheel-stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── UTILISATEURS ─────────────────────────────────────────────────────────────

router.get('/users', adminMiddleware, async (req, res) => {
  try {
    // Recherche (nom / téléphone / code parrainage) et filtre par pays. La
    // recherche se fait côté base pour rester rapide même avec beaucoup d'users.
    const q = (req.query.q || '').trim();
    const pays = (req.query.pays || '').trim();

    let query = supabase
      .from('utilisateurs')
      .select('id,nom,telephone,pays,date_inscription,role')
      .order('date_inscription', { ascending: false })
      .limit(100);

    if (pays) query = query.eq('pays', pays);
    if (q) {
      // On neutralise les caractères qui casseraient la syntaxe du filtre `or`.
      const term = `%${q.replace(/[,()]/g, ' ')}%`;
      query = query.or(`nom.ilike.${term},telephone.ilike.${term},code_parrainage.ilike.${term}`);
    }

    const { data: users } = await query;
    const ids = (users || []).map(u => u.id);
    let soldeMap = {};
    if (ids.length) {
      const { data: soldes } = await supabase
        .from('soldes').select('user_id,solde').in('user_id', ids);
      soldeMap = Object.fromEntries((soldes || []).map(s => [s.user_id, parseFloat(s.solde || 0)]));
    }
    const result = (users || []).map(u => ({
      ...u, solde: soldeMap[u.id] || 0,
    }));

    // Liste des pays distincts (pour alimenter le menu déroulant du filtre).
    const { data: paysRows } = await supabase.from('utilisateurs').select('pays');
    const pays_list = [...new Set((paysRows || []).map(p => p.pays).filter(Boolean))].sort();

    res.json({ users: result, pays_list });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/users/:id/credit', adminMiddleware, async (req, res) => {
  try {
    const { montant } = req.body;
    const userId = parseInt(req.params.id);
    if (!montant || isNaN(montant)) return res.status(400).json({ error: 'Montant invalide' });
    if (!(await requireActionPassword(req, res))) return;
    const { data: result, error } = await supabase.rpc('credit_user', {
      p_user_id: userId, p_montant: parseFloat(montant),
    });
    if (error) throw error;
    if (result?.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Crédit effectué' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Activer / désactiver un plan d'investissement (commande) d'un utilisateur.
// Désactivé => le plan est EXCLU de credit_daily_revenues() (qui ne crédite que
// les commandes 'actif') : il ne reçoit donc plus aucun revenu journalier tant
// qu'il n'est pas réactivé. En réactivant, on remet l'ancre de versement à
// maintenant (last_revenue_at = now) afin qu'AUCUN revenu rétroactif ne soit
// versé pour la période de désactivation ; le prochain revenu tombera 24h après.
router.put('/commandes/:id/toggle', adminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Plan invalide' });
    if (!(await requireActionPassword(req, res))) return;

    const { data: cmd, error: e1 } = await supabase
      .from('commandes').select('id, statut, date_fin').eq('id', id).maybeSingle();
    if (e1) throw e1;
    if (!cmd) return res.status(404).json({ error: 'Plan introuvable' });
    if (cmd.statut !== 'actif' && cmd.statut !== 'desactive') {
      return res.status(400).json({ error: `Ce plan ne peut pas être modifié (statut : ${cmd.statut})` });
    }

    const nextStatut = cmd.statut === 'actif' ? 'desactive' : 'actif';

    // Réactivation : on refuse si le plan est déjà arrivé à échéance. On reproduit
    // la logique du cron (credit_daily_revenues) : la prochaine échéance après
    // réactivation tomberait à now()+24h ; si sa date dépasse date_fin, le cron
    // clôturerait aussitôt la commande sans aucun versement → réactiver est inutile.
    if (nextStatut === 'actif' && cmd.date_fin) {
      const nextDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (nextDueDate > cmd.date_fin) {
        return res.status(400).json({ error: 'Ce plan est arrivé à échéance (date de fin atteinte) : il ne peut plus être réactivé.' });
      }
    }

    const patch = { statut: nextStatut };
    if (nextStatut === 'actif') patch.last_revenue_at = new Date().toISOString();

    const { error: e2 } = await supabase.from('commandes').update(patch).eq('id', id);
    if (e2) throw e2;

    res.json({
      success: true,
      statut: nextStatut,
      message: nextStatut === 'desactive' ? 'Plan désactivé — il ne reçoit plus de revenu journalier' : 'Plan réactivé',
    });
  } catch (err) {
    console.error('toggle commande error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des plans VIP ACTIFS (tous les investissements en cours), avec le
// détenteur, le type de plan, le capital, le revenu/jour et le temps restant.
router.get('/active-plans', adminMiddleware, async (req, res) => {
  try {
    const { data: cmds, error } = await supabase
      .from('commandes')
      .select('id, user_id, montant, revenu_journalier, date_debut, date_fin, statut, planinvestissement(nom, duree_jours)')
      .eq('statut', 'actif')
      .order('date_fin', { ascending: true })
      .range(0, 9999); // éviter le plafond Supabase par défaut (1000 lignes)
    if (error) throw error;

    const ids = [...new Set((cmds || []).map(c => c.user_id))];
    let userMap = {};
    if (ids.length) {
      const { data: us } = await supabase
        .from('utilisateurs').select('id, nom, telephone, pays').in('id', ids).range(0, 9999);
      userMap = Object.fromEntries((us || []).map(u => [u.id, u]));
    }

    const todayMs = Date.parse(new Date().toISOString().slice(0, 10)); // minuit UTC du jour
    const plans = (cmds || []).map(c => {
      const u = userMap[c.user_id] || {};
      const finMs = c.date_fin ? Date.parse(c.date_fin) : null;
      const jours_restants = finMs != null ? Math.max(0, Math.round((finMs - todayMs) / 86400000)) : null;
      return {
        id: c.id,
        user_id: c.user_id,
        nom: u.nom || 'Inconnu',
        telephone: u.telephone || '',
        pays: u.pays || '',
        plan_nom: c.planinvestissement?.nom || 'Plan',
        duree_jours: c.planinvestissement?.duree_jours || null,
        montant: parseFloat(c.montant || 0),
        revenu_journalier: parseFloat(c.revenu_journalier || 0),
        date_debut: c.date_debut,
        date_fin: c.date_fin,
        jours_restants,
      };
    });

    const summary = {
      total: plans.length,
      utilisateurs: ids.length,
      capital_investi: Math.round(plans.reduce((s, p) => s + p.montant, 0)),
      revenu_journalier_total: Math.round(plans.reduce((s, p) => s + p.revenu_journalier, 0)),
    };

    res.json({ plans, summary });
  } catch (err) {
    console.error('active-plans error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── SUPPORT : messagerie utilisateurs ↔ administrateur ───

// Liste des conversations (groupées par numéro) + total de messages non lus.
router.get('/support', adminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, telephone, nom, expediteur, message, lu, date_creation')
      .order('date_creation', { ascending: true })
      .range(0, 9999);
    if (error) throw error;

    const convoMap = new Map();
    for (const m of data || []) {
      let c = convoMap.get(m.telephone);
      if (!c) {
        c = { telephone: m.telephone, nom: m.nom || null, total: 0, non_lus: 0, dernier_message: '', derniere_date: null };
        convoMap.set(m.telephone, c);
      }
      c.total++;
      if (m.nom) c.nom = m.nom;
      if (m.expediteur === 'user' && !m.lu) c.non_lus++;
      c.dernier_message = m.message;
      c.derniere_date = m.date_creation;
    }
    const conversations = [...convoMap.values()].sort(
      (a, b) => new Date(b.derniere_date) - new Date(a.derniere_date)
    );
    const total_non_lus = conversations.reduce((s, c) => s + c.non_lus, 0);

    res.json({ conversations, total_non_lus });
  } catch (err) {
    console.error('admin support list error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fil d'une conversation + marque les messages utilisateur comme lus.
router.get('/support/thread', adminMiddleware, async (req, res) => {
  try {
    const tel = req.query.telephone;
    if (!tel) return res.status(400).json({ error: 'Numéro requis' });

    const { data, error } = await supabase
      .from('support_messages')
      .select('id, expediteur, message, lu, date_creation')
      .eq('telephone', tel)
      .order('date_creation', { ascending: true })
      .range(0, 9999);
    if (error) throw error;

    await supabase
      .from('support_messages')
      .update({ lu: true })
      .eq('telephone', tel).eq('expediteur', 'user').eq('lu', false);

    res.json({ telephone: tel, messages: data || [] });
  } catch (err) {
    console.error('admin support thread error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Répondre à un utilisateur.
router.post('/support/reply', adminMiddleware, async (req, res) => {
  try {
    const { telephone, message } = req.body;
    if (!telephone) return res.status(400).json({ error: 'Numéro requis' });
    if (!message || !message.trim()) return res.status(400).json({ error: 'Le message est vide' });

    const { data, error } = await supabase
      .from('support_messages')
      .insert({ telephone, nom: null, expediteur: 'admin', message: message.trim().slice(0, 2000), lu: true })
      .select()
      .single();
    if (error) throw error;

    res.json({ message: data });
  } catch (err) {
    console.error('admin support reply error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détails complets d'un utilisateur (admin)
router.get('/users/:id', adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const { data: user, error: uErr } = await supabase
      .from('utilisateurs')
      .select('id,nom,telephone,pays,role,code_parrainage,date_inscription,parrain_id')
      .eq('id', userId)
      .single();
    if (uErr || !user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { data: soldeRow } = await supabase
      .from('soldes').select('solde').eq('user_id', userId).maybeSingle();

    // Parrain (sponsor direct)
    let parrain = null;
    if (user.parrain_id) {
      const { data: p } = await supabase
        .from('utilisateurs')
        .select('id,nom,telephone,code_parrainage')
        .eq('id', user.parrain_id)
        .maybeSingle();
      parrain = p || null;
    }

    // Filleuls niveaux 1 / 2 / 3
    const { data: lvl1 } = await supabase.from('utilisateurs').select('id').eq('parrain_id', userId);
    const ids1 = (lvl1 || []).map((u) => u.id);
    let ids2 = [];
    if (ids1.length) {
      const { data: lvl2 } = await supabase.from('utilisateurs').select('id').in('parrain_id', ids1);
      ids2 = (lvl2 || []).map((u) => u.id);
    }
    let count3 = 0;
    if (ids2.length) {
      const { count } = await supabase
        .from('utilisateurs')
        .select('*', { count: 'exact', head: true })
        .in('parrain_id', ids2);
      count3 = count || 0;
    }

    // Gains de parrainage (commissions reçues)
    const { data: comm } = await supabase
      .from('historique_revenus')
      .select('montant')
      .eq('user_id', userId)
      .eq('type', 'parrainage');
    const gains_parrainage = (comm || []).reduce((s, r) => s + parseFloat(r.montant || 0), 0);

    // Plans d'investissement achetés
    const { data: orders } = await supabase
      .from('commandes')
      .select('id,montant,statut,date_debut,date_fin, planinvestissement(nom)')
      .eq('user_id', userId)
      .order('date_debut', { ascending: false });
    const plans = (orders || []).map((o) => ({
      id: o.id,
      nom: o.planinvestissement?.nom || 'Plan',
      montant: o.montant,
      statut: o.statut,
      date_debut: o.date_debut,
      date_fin: o.date_fin,
    }));

    // Totaux dépôts / retraits validés
    const { data: depots } = await supabase
      .from('depots').select('montant').eq('user_id', userId).eq('statut', 'valide');
    const { data: retraits } = await supabase
      .from('retraits').select('montant').eq('user_id', userId).eq('statut', 'valide');
    const total_depots = (depots || []).reduce((s, d) => s + parseFloat(d.montant || 0), 0);
    const total_retraits = (retraits || []).reduce((s, r) => s + parseFloat(r.montant || 0), 0);

    // Mot de passe de transaction (4 chiffres)
    const { data: tp } = await supabase
      .from('transaction_passwords').select('password').eq('user_id', userId).maybeSingle();

    res.json({
      user: {
        id: user.id,
        nom: user.nom,
        telephone: user.telephone,
        pays: user.pays,
        role: user.role,
        code_parrainage: user.code_parrainage,
        date_inscription: user.date_inscription,
        solde: parseFloat(soldeRow?.solde || 0),
      },
      parrain,
      filleuls: { niveau1: ids1.length, niveau2: ids2.length, niveau3: count3 },
      gains_parrainage,
      plans,
      total_depots,
      total_retraits,
      transaction_password_set: !!tp,
    });
  } catch (err) {
    console.error('User detail error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Transactions complètes d'un utilisateur, avec solde AVANT / APRÈS chaque ligne.
// Le solde courant (table `soldes`) fait foi : on reconstruit l'historique en
// remontant le temps depuis ce solde, ce qui garantit que la dernière ligne
// retombe exactement sur le solde réel, même si d'anciens mouvements manquent.
router.get('/users/:id/transactions', adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const [{ data: soldeRow }, depotsRes, retraitsRes, commandesRes, revenusRes] = await Promise.all([
      supabase.from('soldes').select('solde').eq('user_id', userId).maybeSingle(),
      supabase.from('depots').select('*').eq('user_id', userId),
      supabase.from('retraits').select('*').eq('user_id', userId),
      supabase.from('commandes').select('*, planinvestissement(nom)').eq('user_id', userId),
      supabase.from('historique_revenus').select('*').eq('user_id', userId),
    ]);
    const currentSolde = parseFloat(soldeRow?.solde || 0);

    const REVENU_LABELS = {
      parrainage: 'Commission parrainage',
      revenu_journalier: 'Revenu investissement',
      revenu: 'Revenu investissement',
      bonus: 'Bonus roue',
      gain_roue: 'Gain roue',
      mise_roue: 'Mise roue',
      cadeau_vip: 'Cadeau VIP',
      credit_admin: 'Crédit administrateur',
      debit_admin: 'Débit administrateur',
    };

    const entries = [];

    // Dépôts — crédités au solde uniquement une fois validés.
    for (const d of depotsRes.data || []) {
      const montant = parseFloat(d.montant || 0);
      const effectif = d.statut === 'valide';
      entries.push({
        id: `depot-${d.id}`, kind: 'depot', label: 'Dépôt',
        montant, sens: '+', statut: d.statut,
        date: (effectif && d.date_traitement) ? d.date_traitement : d.date_depot,
        delta: effectif ? montant : 0,
        details: { pays: d.pays, operateur: d.operateur },
      });
    }

    // Retraits — déduits dès la demande ; un retrait rejeté est remboursé (net 0).
    for (const r of retraitsRes.data || []) {
      const montant = parseFloat(r.montant || 0);
      const rembourse = r.statut === 'rejete';
      entries.push({
        id: `retrait-${r.id}`, kind: 'retrait', label: 'Retrait',
        montant, sens: '-', statut: r.statut,
        date: r.date_demande,
        delta: rembourse ? 0 : -montant,
        details: { methode: r.methode, numero_compte: r.numero_compte },
      });
    }

    // Investissements — le principal est déduit à l'achat (aucun remboursement).
    for (const c of commandesRes.data || []) {
      const montant = parseFloat(c.montant || 0);
      const inactif = c.statut === 'annule' || c.statut === 'refuse';
      entries.push({
        id: `commande-${c.id}`, kind: 'investissement', label: 'Investissement',
        montant, sens: '-', statut: c.statut,
        date: c.date_debut,
        delta: inactif ? 0 : -montant,
        details: { plan_nom: c.planinvestissement?.nom || null },
      });
    }

    // Revenus & mouvements divers. On déduit le sens du TYPE, pas du signe
    // stocké : d'anciennes lignes `mise_roue` ont été enregistrées en positif
    // alors qu'une mise est toujours un débit. On normalise donc par sémantique.
    const DEBIT_TYPES = new Set(['mise_roue', 'debit_admin']);
    for (const rev of revenusRes.data || []) {
      const montant = Math.abs(parseFloat(rev.montant || 0));
      const isDebit = DEBIT_TYPES.has(rev.type);
      // Parrainage : on précise le niveau (1/2/3) reçu quand il est connu.
      const niveau = rev.niveau || null;
      const label = (rev.type === 'parrainage' && niveau)
        ? `Commission de parrainage niveau ${niveau}`
        : (REVENU_LABELS[rev.type] || 'Revenu');
      entries.push({
        id: `revenu-${rev.id}`, kind: rev.type,
        label,
        montant, sens: isDebit ? '-' : '+', statut: 'valide',
        date: rev.date_paiement,
        delta: isDebit ? -montant : montant,
        details: { type_revenu: rev.type, niveau },
      });
    }

    // Ordre chronologique croissant pour la reconstruction.
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    let running = currentSolde;
    for (let i = entries.length - 1; i >= 0; i--) {
      entries[i].solde_apres = round2(running);
      entries[i].solde_avant = round2(running - entries[i].delta);
      running = running - entries[i].delta;
    }

    // Plus récent en premier pour l'affichage.
    entries.reverse();

    res.json({ transactions: entries, solde_actuel: round2(currentSolde) });
  } catch (err) {
    console.error('User transactions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Réduire le solde d'un utilisateur (admin)
router.put('/users/:id/debit', adminMiddleware, async (req, res) => {
  try {
    const { montant } = req.body;
    const userId = parseInt(req.params.id);
    if (!montant || isNaN(montant) || parseFloat(montant) <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }
    if (!(await requireActionPassword(req, res))) return;
    const { data: result, error } = await supabase.rpc('debit_user', {
      p_user_id: userId, p_montant: parseFloat(montant),
    });
    if (error) throw error;
    if (result?.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Solde réduit' });
  } catch (err) {
    console.error('Debit error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier le mot de passe de connexion d'un utilisateur (admin)
router.put('/users/:id/password', adminMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    const userId = parseInt(req.params.id);
    const target = await getTargetUser(userId);
    if (target && target.role === 'admin' && Number(target.id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Vous ne pouvez pas modifier le mot de passe d'un autre administrateur" });
    }
    if (!(await requireActionPassword(req, res))) return;
    const hashed = await bcrypt.hash(String(password), 10);
    const { error } = await supabase
      .from('utilisateurs').update({ mot_de_passe: hashed }).eq('id', userId);
    if (error) throw error;
    res.json({ success: true, message: 'Mot de passe modifié' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier le mot de passe de transaction d'un utilisateur (admin)
router.put('/users/:id/transaction-password', adminMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!/^\d{4}$/.test(String(password || ''))) {
      return res.status(400).json({ error: 'Le mot de passe de transaction doit comporter 4 chiffres' });
    }
    const userId = parseInt(req.params.id);
    const target = await getTargetUser(userId);
    if (target && target.role === 'admin' && Number(target.id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Vous ne pouvez pas modifier les informations d'un autre administrateur" });
    }
    if (!(await requireActionPassword(req, res))) return;
    const { error } = await supabase
      .from('transaction_passwords')
      .upsert({ user_id: userId, password: String(password) }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true, message: 'Mot de passe de transaction modifié' });
  } catch (err) {
    console.error('Tx password change error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DÉPÔTS ───────────────────────────────────────────────────────────────────

router.get('/depots', adminMiddleware, async (req, res) => {
  try {
    const { data: depots } = await supabase
      .from('depots')
      .select('*, utilisateurs(nom, telephone)')
      .order('date_depot', { ascending: false })
      .limit(100);
    const result = (depots || []).map(d => ({
      ...d, nom: d.utilisateurs?.nom, telephone: d.utilisateurs?.telephone, utilisateurs: undefined,
    }));
    res.json({ depots: result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/depots/:id/validate', adminMiddleware, async (req, res) => {
  try {
    const { data: result, error } = await supabase.rpc('validate_depot', { p_depot_id: parseInt(req.params.id) });
    if (error) throw error;
    if (result?.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Dépôt validé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/depots/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('depots')
      .update({ statut: 'rejete', date_traitement: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Dépôt rejeté' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── RETRAITS ────────────────────────────────────────────────────────────────

router.get('/retraits', adminMiddleware, async (req, res) => {
  try {
    const { data: retraits } = await supabase
      .from('retraits')
      .select('*, utilisateurs(nom, telephone, pays)')
      .order('date_demande', { ascending: false })
      .limit(100);
    const result = (retraits || []).map(r => ({
      ...r,
      nom: r.utilisateurs?.nom,
      telephone: r.utilisateurs?.telephone,
      pays: r.utilisateurs?.pays,
      frais: r.frais != null ? parseFloat(r.frais) : 0,
      // Montant NET (frais déjà appliqués) = ce que l'admin doit payer.
      montant_net: r.montant_net != null ? parseFloat(r.montant_net) : parseFloat(r.montant),
      utilisateurs: undefined,
    }));
    res.json({ retraits: result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/retraits/:id/validate', adminMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('retraits')
      .update({ statut: 'valide', date_traitement: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Retrait validé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/retraits/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const { data: result, error } = await supabase.rpc('reject_retrait', { p_retrait_id: parseInt(req.params.id) });
    if (error) throw error;
    if (result?.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Retrait rejeté, solde remboursé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── CADEAUX VIP ──────────────────────────────────────────────────────────────

router.get('/cadeaux', adminMiddleware, async (req, res) => {
  try {
    const { data: cadeaux } = await supabase
      .from('cadeaux_vip')
      .select('*, utilisateurs(nom, telephone)')
      .order('date_demande', { ascending: false })
      .limit(100);
    const result = (cadeaux || []).map(c => ({
      ...c, nom: c.utilisateurs?.nom, telephone: c.utilisateurs?.telephone, utilisateurs: undefined,
    }));
    res.json({ cadeaux: result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/cadeaux/:id/validate', adminMiddleware, async (req, res) => {
  try {
    const { data: result, error } = await supabase.rpc('validate_cadeau_vip', { p_cadeau_id: parseInt(req.params.id) });
    if (error) throw error;
    if (result?.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Cadeau validé et crédité' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/cadeaux/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cadeaux_vip')
      .update({ statut: 'rejete', date_traitement: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('statut', 'en_attente')
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Cadeau non trouvé ou déjà traité' });
    }
    res.json({ success: true, message: 'Cadeau rejeté' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POSTS ────────────────────────────────────────────────────────────────────

router.get('/posts', adminMiddleware, async (req, res) => {
  try {
    const { data: posts } = await supabase
      .from('posts')
      .select('*, utilisateurs(nom)')
      .order('date_creation', { ascending: false })
      .limit(50);
    const result = (posts || []).map(p => ({
      ...p, nom: p.utilisateurs?.nom, utilisateurs: undefined,
    }));
    res.json({ posts: result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/posts/:id/:action', adminMiddleware, async (req, res) => {
  try {
    const statut = req.params.action === 'validate' ? 'valide' : 'refuse';
    const { error } = await supabase.from('posts').update({ statut }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PARAMÈTRES ───────────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS = {
  min_depot: '500',
  commission_niveau1: '10',
  commission_niveau2: '5',
  commission_niveau3: '2',
  support_telegram: 'https://t.me/gifetalpro',
  communaute_telegram: '',
  communaute_whatsapp: '',
  roue_music_url: '',
};

router.get('/settings', adminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('cle,valeur,description');
    if (error) {
      // Table peut ne pas encore exister
      return res.json({ settings: { ...SETTINGS_DEFAULTS } });
    }
    const map = { ...SETTINGS_DEFAULTS };
    (data || []).forEach(s => { map[s.cle] = s.valeur; });
    res.json({ settings: map });
  } catch (err) {
    res.json({ settings: { ...SETTINGS_DEFAULTS } });
  }
});

router.put('/settings', adminMiddleware, async (req, res) => {
  try {
    const { cle, valeur } = req.body;
    if (!cle || valeur === undefined) return res.status(400).json({ error: 'Données invalides' });

    // Validation des pourcentages de commission : numérique, entre 0 et 100
    if (['commission_niveau1', 'commission_niveau2', 'commission_niveau3'].includes(cle)) {
      const num = Number(valeur);
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        return res.status(400).json({ error: 'Le pourcentage doit être un nombre entre 0 et 100' });
      }
    }

    // Tentative d'upsert
    const { error } = await supabase
      .from('settings')
      .upsert(
        { cle, valeur: String(valeur), date_maj: new Date().toISOString() },
        { onConflict: 'cle' }
      );

    if (error) {
      console.error('Settings upsert error:', JSON.stringify(error));
      return res.status(500).json({ error: `Erreur: ${error.message || error.code || 'Table settings manquante — exécuter fixes.sql'}` });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Settings catch:', err);
    res.status(500).json({ error: 'Erreur serveur — vérifiez que fixes.sql a été exécuté dans Supabase' });
  }
});

// ─── MUSIQUE DE FOND DE LA ROUE ──────────────────────────────────────────────

// URL de la musique actuellement configurée.
router.get('/roue-music', adminMiddleware, async (req, res) => {
  try {
    const { data } = await supabase
      .from('settings').select('valeur').eq('cle', 'roue_music_url').maybeSingle();
    res.json({ url: data?.valeur || '' });
  } catch {
    res.json({ url: '' });
  }
});

// Upload / remplacement de la musique de fond.
// On enveloppe multer pour renvoyer un message propre (400/413) en cas d'erreur.
function handleMusicUpload(req, res, next) {
  uploadMusic.single('music')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Fichier trop volumineux (20 Mo maximum)' });
      }
      return res.status(400).json({ error: err.message || 'Fichier audio invalide' });
    }
    next();
  });
}

router.post('/roue-music', adminMiddleware, handleMusicUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier audio reçu' });
    const url = `/uploads/${req.file.filename}`;
    const { error } = await supabase
      .from('settings')
      .upsert({ cle: 'roue_music_url', valeur: url, date_maj: new Date().toISOString() }, { onConflict: 'cle' });
    if (error) throw error;
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// Suppression de la musique configurée.
router.delete('/roue-music', adminMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({ cle: 'roue_music_url', valeur: '', date_maj: new Date().toISOString() }, { onConflict: 'cle' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── LOGOS DES OPÉRATEURS (moyens de paiement) ───────────────────────────────

// Liste de TOUS les moyens de paiement disponibles (fusionnés avec leurs logos).
router.get('/operators', adminMiddleware, async (req, res) => {
  try {
    const [countries, logosRes] = await Promise.all([
      afribapay.getCountries(),
      supabase.from('operateur_logos').select('operator_code, label, logo_url'),
    ]);
    const logoMap = {};
    for (const l of logosRes.data || []) logoMap[l.operator_code] = l;

    const seen = new Map();
    for (const c of countries) {
      for (const o of c.operators || []) {
        if (!seen.has(o.operator_code)) {
          seen.set(o.operator_code, {
            operator_code: o.operator_code,
            operator_name: logoMap[o.operator_code]?.label || o.operator_name,
            logo_url: logoMap[o.operator_code]?.logo_url || null,
          });
        }
      }
    }
    const operators = Array.from(seen.values()).sort((a, b) =>
      a.operator_name.localeCompare(b.operator_name));
    res.json({ operators });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Admin operators error');
    res.status(502).json({ error: 'Impossible de charger les moyens de paiement' });
  }
});

router.get('/operator-logos', adminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('operateur_logos')
      .select('operator_code, label, logo_url')
      .order('operator_code', { ascending: true });
    if (error) return res.json({ logos: [] });
    res.json({ logos: data || [] });
  } catch (err) {
    res.json({ logos: [] });
  }
});

router.post('/operator-logos', adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { operator_code, label } = req.body;
    if (!operator_code) return res.status(400).json({ error: "Le code de l'opérateur est obligatoire" });

    const update = { operator_code: String(operator_code).trim().toLowerCase(), date_maj: new Date().toISOString() };
    if (label !== undefined) update.label = label;
    if (req.file) update.logo_url = `/uploads/${req.file.filename}`;

    const { error } = await supabase
      .from('operateur_logos')
      .upsert(update, { onConflict: 'operator_code' });

    if (error) {
      return res.status(500).json({ error: `Erreur: ${error.message || 'Table operateur_logos manquante — exécuter afribapay-deposit.sql'}` });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Operator logo error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du logo' });
  }
});

// ─── PLANS D'INVESTISSEMENT ───────────────────────────────────────────────────

router.get('/plans', adminMiddleware, async (req, res) => {
  try {
    const { data: plans } = await supabase
      .from('planinvestissement')
      .select('*')
      .order('serie', { ascending: true });
    res.json({ plans: plans || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/plans', adminMiddleware, uploadPlan.single('image'), async (req, res) => {
  try {
    const { nom, prix, duree_jours, rendement_journalier, serie, description } = req.body;
    if (!nom || !prix || !duree_jours || !rendement_journalier) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    const insert = {
      nom,
      prix: parseFloat(prix),
      duree_jours: parseInt(duree_jours),
      rendement_journalier: parseFloat(rendement_journalier),
      serie: serie || 'X',
      description: description || '',
    };
    if (req.file) insert.image_url = req.file.filename;
    const { data, error } = await supabase
      .from('planinvestissement')
      .insert(insert)
      .select().single();
    if (error) throw error;
    res.json({ success: true, plan: data });
  } catch (err) {
    console.error('Plan create error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/plans/:id', adminMiddleware, uploadPlan.single('image'), async (req, res) => {
  try {
    const { nom, prix, duree_jours, rendement_journalier, serie, description } = req.body;
    const update = {
      nom,
      prix: parseFloat(prix),
      duree_jours: parseInt(duree_jours),
      rendement_journalier: parseFloat(rendement_journalier),
    };
    if (serie !== undefined) update.serie = serie;
    if (description !== undefined) update.description = description;
    if (req.file) update.image_url = req.file.filename;
    const { error } = await supabase
      .from('planinvestissement')
      .update(update)
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Plan update error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/plans/:id', adminMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('planinvestissement').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── ANNONCES (images) ────────────────────────────────────────────────────────

router.get('/annonces', adminMiddleware, async (req, res) => {
  try {
    const { data: annonces, error } = await supabase
      .from('annonces')
      .select('*')
      .order('date_creation', { ascending: false });
    if (error) return res.json({ annonces: [] });
    res.json({ annonces: annonces || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload image d'annonce
router.post('/annonces', adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    const image = req.file ? req.file.filename : null;
    const couleur = req.body.couleur || '#22c55e';
    const actif = req.body.actif !== 'false';

    const { data, error } = await supabase
      .from('annonces')
      .insert({ titre: '', contenu: '', image, couleur, actif })
      .select().single();

    if (error) {
      console.error('Annonce insert error:', JSON.stringify(error));
      return res.status(500).json({ error: `Erreur: ${error.message || 'fixes.sql non exécuté'}` });
    }
    res.json({ success: true, annonce: data });
  } catch (err) {
    console.error('Annonce catch:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/annonces/:id', adminMiddleware, async (req, res) => {
  try {
    const { actif, couleur } = req.body;
    const updates = { date_maj: new Date().toISOString() };
    if (actif !== undefined) updates.actif = actif;
    if (couleur !== undefined) updates.couleur = couleur;
    const { error } = await supabase.from('annonces').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/annonces/:id', adminMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('annonces').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── FAQ (questions fréquentes) ────────────────────────────────────────────────

router.get('/faq', adminMiddleware, async (req, res) => {
  try {
    const { data: faqs, error } = await supabase
      .from('faq')
      .select('*')
      .order('ordre', { ascending: true })
      .order('id', { ascending: true });
    if (error) return res.json({ faqs: [] });
    res.json({ faqs: faqs || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/faq', adminMiddleware, uploadFaq.single('image'), async (req, res) => {
  try {
    const question = (req.body.question || '').trim();
    const reponse = (req.body.reponse || '').trim();
    if (!question) return res.status(400).json({ error: 'La question est requise' });
    const image = req.file ? req.file.filename : null;
    const ordre = req.body.ordre !== undefined && req.body.ordre !== '' ? parseInt(req.body.ordre, 10) : 0;

    const { data, error } = await supabase
      .from('faq')
      .insert({ question, reponse, image, ordre, actif: true })
      .select().single();

    if (error) {
      console.error('FAQ insert error:', JSON.stringify(error));
      return res.status(500).json({ error: `Erreur: ${error.message || 'faq.sql non exécuté'}` });
    }
    res.json({ success: true, faq: data });
  } catch (err) {
    console.error('FAQ catch:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/faq/:id', adminMiddleware, uploadFaq.single('image'), async (req, res) => {
  try {
    const updates = { date_maj: new Date().toISOString() };
    if (req.body.question !== undefined) updates.question = String(req.body.question).trim();
    if (req.body.reponse !== undefined) updates.reponse = String(req.body.reponse).trim();
    if (req.body.ordre !== undefined && req.body.ordre !== '') updates.ordre = parseInt(req.body.ordre, 10);
    if (req.body.actif !== undefined) updates.actif = req.body.actif === 'true' || req.body.actif === true;
    if (req.file) updates.image = req.file.filename;
    else if (req.body.remove_image === 'true') updates.image = null;

    const { error } = await supabase.from('faq').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/faq/:id', adminMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('faq').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── RECHARGES DÉMO (Roue) ────────────────────────────────────────────────────
// Seules les demandes de rechargement du solde démo apparaissent ici.
// Les mises et gains du mode démo ne sont JAMAIS exposés à l'admin.
const SOLDE_DEMO_INITIAL = 100000;

router.get('/demo-recharges', adminMiddleware, async (req, res) => {
  try {
    const { data: recharges } = await supabase
      .from('roue_demo_recharges')
      .select('*, utilisateurs(nom, telephone, pays)')
      .order('date_demande', { ascending: false })
      .limit(100);
    const result = (recharges || []).map(r => ({
      ...r,
      nom: r.utilisateurs?.nom,
      telephone: r.utilisateurs?.telephone,
      pays: r.utilisateurs?.pays,
      utilisateurs: undefined,
    }));
    res.json({ recharges: result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/demo-recharges/:id/validate', adminMiddleware, async (req, res) => {
  try {
    const { data: recharge } = await supabase
      .from('roue_demo_recharges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!recharge) return res.status(404).json({ error: 'Demande introuvable' });
    if (recharge.statut !== 'en_attente') {
      return res.status(409).json({ error: 'Demande déjà traitée' });
    }

    // Marque la demande comme traitée d'abord (garde anti double-traitement).
    const { data: claimed } = await supabase
      .from('roue_demo_recharges')
      .update({ statut: 'approuve', date_traitement: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('statut', 'en_attente')
      .select('id');
    if (!claimed || claimed.length === 0) {
      return res.status(409).json({ error: 'Demande déjà traitée' });
    }

    // Remet le solde démo à 100 000 FCFA.
    const { error: upErr } = await supabase
      .from('roue_demo')
      .upsert({ user_id: recharge.user_id, solde: SOLDE_DEMO_INITIAL, date_maj: new Date().toISOString() }, { onConflict: 'user_id' });
    if (upErr) throw upErr;

    res.json({ success: true, message: 'Solde démo rechargé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/demo-recharges/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const { data: claimed, error } = await supabase
      .from('roue_demo_recharges')
      .update({ statut: 'rejete', date_traitement: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('statut', 'en_attente')
      .select('id');
    if (error) throw error;
    if (!claimed || claimed.length === 0) {
      return res.status(409).json({ error: 'Demande introuvable ou déjà traitée' });
    }
    res.json({ success: true, message: 'Demande rejetée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
