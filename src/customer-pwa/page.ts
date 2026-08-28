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
  #enable-reminders { margin-top: 1rem; padding: 0.6rem 1rem; font-size: 0.95rem; cursor: pointer; }
  #reminder-status { margin-top: 0.5rem; font-size: 0.85rem; color: #555; }
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
  <button id="enable-reminders" type="button">Erinnerungen aktivieren</button>
  <div id="reminder-status"></div>
<script>
(function () {
  var serialNumber = ${JSON.stringify(data.serialNumber)};
  var statusBox = document.getElementById('reminder-status');

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  var registrationPromise = ('serviceWorker' in navigator)
    ? navigator.serviceWorker.register('/wallet/sw.js').catch(function () { return null; })
    : Promise.resolve(null);

  document.getElementById('enable-reminders').addEventListener('click', function () {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      var isStandalone = window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      if (isIOS && !isStandalone) {
        statusBox.textContent = 'Bitte diese Seite zuerst ueber "Teilen" -> "Zum Home-Bildschirm hinzufuegen" speichern und dann von dort (nicht in Safari) oeffnen -- erst dann sind Erinnerungen moeglich.';
      } else {
        statusBox.textContent = 'Erinnerungen werden von diesem Browser nicht unterstützt.';
      }
      return;
    }
    Notification.requestPermission().then(function (permission) {
      if (permission !== 'granted') {
        statusBox.textContent = 'Erlaubnis für Benachrichtigungen wurde nicht erteilt.';
        return;
      }
      Promise.all([registrationPromise, fetch('/push/vapid-public-key').then(function (r) { return r.json(); })])
        .then(function (results) {
          var registration = results[0];
          var vapid = results[1];
          if (!registration || !vapid.publicKey) {
            statusBox.textContent = 'Erinnerungen sind aktuell nicht verfügbar.';
            return;
          }
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
          }).then(function (subscription) {
            return fetch('/wallet/' + encodeURIComponent(serialNumber) + '/push-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(subscription.toJSON()),
            });
          });
        })
        .then(function () {
          statusBox.textContent = 'Erinnerungen sind jetzt aktiv.';
        })
        .catch(function () {
          statusBox.textContent = 'Erinnerungen konnten nicht aktiviert werden.';
        });
    });
  });
})();
</script>
</body>
</html>`;
}
