// Normalise une URL configurée côté admin : ajoute https:// si le protocole est
// absent, sinon le navigateur la traite comme un lien interne (relatif).
export function externalUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed.replace(/^\/+/, '');
}
