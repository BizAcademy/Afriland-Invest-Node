const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// node-cron est optionnel : si le module est absent ou incompatible avec la
// version de Node de l'hébergeur, on ne fait PAS planter tout le serveur.
let cron = null;
try {
  cron = require('node-cron');
} catch (e) {
  console.warn('[REVENUS] node-cron indisponible, cron désactivé :', e.message);
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const investmentRoutes = require('./routes/investment');
const depositRoutes = require('./routes/deposit');
const withdrawalRoutes = require('./routes/withdrawal');
const referralRoutes = require('./routes/referral');
const adminRoutes = require('./routes/admin');
const postRoutes = require('./routes/posts');
const annoncesRoutes = require('./routes/annonces');
const transactionsRoutes = require('./routes/transactions');
const faqRoutes = require('./routes/faq');
const publicRoutes = require('./routes/public');
const demoRoutes = require('./routes/demo');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/investment', investmentRoutes);
app.use('/api/deposit', depositRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/annonces', annoncesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/demo', demoRoutes);

const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route non trouvée' });
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

const { supabase } = require('./db');

// ─── Revenus journaliers (1 versement par tranche de 24h, par investissement) ──
// Appelle la fonction SQL atomique qui crédite tous les plans actifs éligibles.
// Chaque commande est créditée EXACTEMENT une fois toutes les 24h, à la même
// heure que l'achat (ancre `last_revenue_at`, voir server/revenus-24h.sql).
// La fonction est idempotente et concurrente-safe (FOR UPDATE SKIP LOCKED) :
// l'appeler souvent ne provoque jamais de double versement.

async function runDailyRevenues() {
  try {
    const { data: credited, error } = await supabase.rpc('credit_daily_revenues');
    if (error) {
      console.error('[REVENUS] Erreur lors du crédit journalier :', error.message);
    } else {
      console.log(`[REVENUS] ${credited || 0} plan(s) crédité(s) à ${new Date().toISOString()}`);
    }
  } catch (err) {
    console.error('[REVENUS] Exception :', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`AFRILAND INVEST server running on port ${PORT}`);

  // Tout le reste (vérif Supabase, crédit journalier, cron) est exécuté en
  // arrière-plan et entièrement protégé : une erreur ici ne doit JAMAIS
  // empêcher le serveur de servir les pages (login, etc.).
  (async () => {
    try {
      const { count } = await supabase
        .from('utilisateurs')
        .select('*', { count: 'exact', head: true });
      console.log(`✅ Supabase connecté — ${count || 0} utilisateur(s) en base`);
    } catch (err) {
      console.error('[STARTUP] Vérification Supabase échouée :', err.message);
    }

    // Préchauffe le cache des pays/opérateurs (mémoire + disque) pour que la
    // page Dépôt et la config portefeuille restent stables même si l'API tombe.
    try {
      const afribapay = require('./services/afribapay');
      const list = await afribapay.getCountries();
      console.log(`[STARTUP] Cache moyens de paiement chargé — ${list.length} pays`);
    } catch (err) {
      console.error('[STARTUP] Préchauffe moyens de paiement échouée :', err.message);
    }

    // ── Vérification au démarrage ────────────────────────────────────────────
    // Rattrape les revenus dus si le serveur a redémarré.
    console.log('[REVENUS] Vérification au démarrage...');
    await runDailyRevenues();

    // ── Cron : toutes les 15 minutes ────────────────────────────────────────
    // La fonction SQL ne crédite chaque commande qu'une fois par tranche de 24h
    // (ancre `last_revenue_at`). Tourner souvent permet de verser chaque revenu
    // au plus près de son heure d'échéance (~à la minute près), sans jamais
    // doubler. Format cron : minute heure jour mois jourSemaine.
    if (cron) {
      try {
        cron.schedule('*/15 * * * *', runDailyRevenues, { timezone: 'UTC' });
        console.log('[REVENUS] Cron planifié — vérification toutes les 15 min');
      } catch (err) {
        console.error('[REVENUS] Impossible de planifier le cron :', err.message);
      }
    }
  })();
});

// Les rejets de promesses non gérés (souvent des tâches d'arrière-plan) sont
// loggués sans tuer le serveur — les routes critiques ont déjà leur try/catch.
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
// En revanche, après une exception non capturée l'état de Node est indéfini :
// on logge puis on quitte proprement pour laisser l'hébergeur redémarrer le
// process dans un état sain (fail-fast, pratique standard en production).
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});
