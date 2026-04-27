/**
 * Entrega configuración pública para Push.
 * VAPID public key es segura para exponer en cliente.
 */

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const fallbackKey = 'BMxdhgSVCuO4Vad8c_Wj8a-nAC3AgUBqjDhGKJb6Fm1ZvJ1ZFvNd1VzeF1KZsl2kvJYMbC6hBjaK93dH9jeGFqg';
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || fallbackKey;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json({ vapidPublicKey });
}
