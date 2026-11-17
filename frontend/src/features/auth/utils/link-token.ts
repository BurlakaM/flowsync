/**
 * The one-time token of an emailed link, from the URL fragment (`#token=...`). The link keeps it in the
 * fragment because browsers never send a fragment to a server or in a Referer header.
 */
export function readLinkToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token && /^[A-Za-z0-9_-]{20,128}$/.test(token) ? token : null;
}
