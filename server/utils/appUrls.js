/**
 * Resolve public URLs for payment redirects and gateway callbacks.
 * Vercel: set CLIENT_URL + SERVER_URL in the **server** project env (Production).
 * Optional fallbacks: FRONTEND_URL, VERCEL_URL (https://<deployment-host>).
 */

function stripTrailingSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getClientUrl() {
  const raw =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    process.env.VITE_APP_URL ||
    '';
  const normalized = stripTrailingSlash(raw);
  if (normalized) return normalized;

  return '';
}

function getServerUrl() {
  const explicit = stripTrailingSlash(process.env.SERVER_URL);
  if (explicit) return explicit;

  const vercel = stripTrailingSlash(process.env.VERCEL_URL);
  if (vercel) {
    const host = vercel.startsWith('http') ? vercel : `https://${vercel}`;
    return host;
  }

  return '';
}

function assertPaymentUrls() {
  const clientUrl = getClientUrl();
  const serverUrl = getServerUrl();

  if (!clientUrl) {
    throw new Error(
      'CLIENT_URL is not configured. Set CLIENT_URL to your live frontend (e.g. https://ogpv1.vercel.app) on the API host.'
    );
  }
  if (!serverUrl) {
    throw new Error(
      'SERVER_URL is not configured. Set SERVER_URL to your public API origin or deploy on Vercel with VERCEL_URL available.'
    );
  }

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  if (isProd && /localhost|127\.0\.0\.1/i.test(clientUrl)) {
    throw new Error(
      `CLIENT_URL points to localhost (${clientUrl}) in production. Update Vercel server env to your live frontend URL and redeploy.`
    );
  }

  return { clientUrl, serverUrl };
}

module.exports = { getClientUrl, getServerUrl, assertPaymentUrls, stripTrailingSlash };
