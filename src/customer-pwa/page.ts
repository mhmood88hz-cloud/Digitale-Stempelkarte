export interface WalletPageData {
  salonName: string;
  brandColor: string;
  stampCount: number;
  stampsRequired: number;
  rewardReady: boolean;
  rewardDescription: string;
  serialNumber: string;
  showGoogleWalletLink: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the customer-facing card page. No build step, no external assets: works as a plain
 * web page and, once "walletMode" for this card is upgraded to a real Apple/Google Wallet pass
 * later, this same URL can redirect there instead -- see src/customer-pwa/routes.ts.
 */
export function renderWalletPage(data: WalletPageData): string {
  const salonName = escapeHtml(data.salonName);
  const rewardDescription = escapeHtml(data.rewardDescription);
  const progressPercent = Math.min(100, Math.round((data.stampCount / data.stampsRequired) * 100));

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${escapeHtml(data.brandColor)}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${salonName}">
<link rel="manifest" href="/wallet/${encodeURIComponent(data.serialNumber)}/manifest.webmanifest">
<title>${salonName} -- Stempelkarte</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 420px; margin: 2rem auto; padding: 0 1rem; text-align: center; }
  h1 { font-size: 1.4rem; }
  .progress { background: #e5e7eb; border-radius: 999px; height: 1.5rem; margin: 1.5rem 0; overflow: hidden; }
  .progress-bar { background: ${escapeHtml(data.brandColor)}; height: 100%; }
  .count { font-size: 2rem; font-weight: bold; }
  .reward { margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #dcfce7; color: #14532d; }
  .google-wallet-link { display: inline-block; margin-top: 1rem; }
  .google-wallet-link img { height: 48px; }
</style>
</head>
<body>
  <h1>${salonName}</h1>
  <div class="count">${data.stampCount} / ${data.stampsRequired} Stempel</div>
  <div class="progress"><div class="progress-bar" style="width: ${progressPercent}%"></div></div>
  ${data.rewardReady ? `<div class="reward">Dein Rabatt ist bereit: ${rewardDescription}</div>` : ''}
  <p>Zeig diese Seite beim nächsten Besuch dem Personal, oder füge sie über "Zum Home-Bildschirm hinzufügen" deinem Startbildschirm hinzu.</p>
  ${
    data.showGoogleWalletLink
      ? `<a class="google-wallet-link" href="/wallet/${encodeURIComponent(data.serialNumber)}/google-save-link">Zu Google Wallet hinzufügen</a>`
      : ''
  }
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/wallet/sw.js').catch(function () {});
  }
</script>
</body>
</html>`;
}
