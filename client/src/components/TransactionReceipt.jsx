import React from 'react';
import Logo from './Logo';

export const KIND_CONFIG = {
  depot: { label: 'Dépôt', icon: 'fa-arrow-down', color: '#16a34a' },
  retrait: { label: 'Retrait', icon: 'fa-hand-holding-usd', color: '#1B2A6B' },
  investissement: { label: 'Investissement', icon: 'fa-chart-line', color: '#2563eb' },
  parrainage: { label: 'Commission parrainage', icon: 'fa-users', color: '#9333ea' },
  revenu: { label: 'Revenu investissement', icon: 'fa-coins', color: '#16a34a' },
  bonus: { label: 'Bonus roue', icon: 'fa-dice', color: '#f59e0b' },
  credit_admin: { label: 'Crédit administrateur', icon: 'fa-gift', color: '#0891b2' },
  debit_admin: { label: 'Retrait Administrateur', icon: 'fa-hand-holding-usd', color: '#ef4444' },
  cadeau_vip: { label: 'Cadeau VIP', icon: 'fa-gift', color: '#f59e0b' },
  mise_roue: { label: 'Mise roue', icon: 'fa-dice', color: '#ef4444' },
  gain_roue: { label: 'Gain roue', icon: 'fa-dice', color: '#16a34a' },
};

export const STATUT_LABEL = {
  valide: 'Validé', en_attente: 'En attente', rejete: 'Rejeté',
  actif: 'Actif', termine: 'Terminé', annule: 'Annulé', refuse: 'Refusé',
};
export const STATUT_BADGE = {
  valide: 'badge-green', actif: 'badge-green', termine: 'badge-green',
  en_attente: 'badge-yellow', rejete: 'badge-red', annule: 'badge-red', refuse: 'badge-red',
};

export const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
export const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Libellé d'une transaction. Pour une commission de parrainage, on précise le
// niveau (1/2/3) quand il est connu ; sinon on garde le libellé générique.
export const txLabel = (t) => {
  if (!t) return '';
  if (t.kind === 'parrainage' && t.details?.niveau) {
    return `Commission de parrainage niveau ${t.details.niveau}`;
  }
  return (KIND_CONFIG[t.kind] || {}).label || t.label || '';
};

function ReceiptRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

export default function TransactionReceipt({ receipt, onClose }) {
  if (!receipt) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 24, maxWidth: 360, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Logo size="md" /></div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>Reçu de transaction</p>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{txLabel(receipt)}</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: receipt.sens === '+' ? 'var(--green-primary)' : 'var(--text-primary)' }}>
            {receipt.sens}{fmt(receipt.montant)} FCFA
          </p>
          <span className={`badge ${STATUT_BADGE[receipt.statut] || 'badge-yellow'}`}>
            {STATUT_LABEL[receipt.statut] || receipt.statut}
          </span>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
          <ReceiptRow label="Référence" value={receipt.id} />
          <ReceiptRow label="Date" value={fmtDate(receipt.date)} />
          {receipt.details?.pays && <ReceiptRow label="Pays" value={receipt.details.pays} />}
          {receipt.details?.operateur && <ReceiptRow label="Opérateur" value={receipt.details.operateur} />}
          {receipt.details?.numero_payeur && <ReceiptRow label="Numéro payeur" value={receipt.details.numero_payeur} />}
          {receipt.details?.methode && <ReceiptRow label="Méthode" value={receipt.details.methode} />}
          {receipt.details?.numero_compte && <ReceiptRow label="Compte" value={receipt.details.numero_compte} />}
          {receipt.details?.frais != null && <ReceiptRow label="Frais de retrait" value={`${fmt(receipt.details.frais)} FCFA`} />}
          {receipt.details?.montant_net != null && <ReceiptRow label="Montant net reçu" value={`${fmt(receipt.details.montant_net)} FCFA`} />}
          {receipt.details?.plan_nom && <ReceiptRow label="Plan" value={receipt.details.plan_nom} />}
          {receipt.details?.revenu_journalier > 0 && <ReceiptRow label="Revenu/jour" value={`${fmt(receipt.details.revenu_journalier)} FCFA`} />}
          {receipt.details?.date_fin && <ReceiptRow label="Fin" value={fmtDate(receipt.details.date_fin)} />}
        </div>

        <button className="btn btn-primary" onClick={onClose} style={{ width: '100%', marginTop: 18, padding: 12 }}>Fermer</button>
      </div>
    </div>
  );
}
