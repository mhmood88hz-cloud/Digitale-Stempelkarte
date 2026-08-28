import { renderBaseStyles } from '../shared/styles';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Public, salon-wide self-service form -- meant to be reached via one QR code posted in the
 * shop (not per-customer). No login, no staff involved: customer types their name, gets their
 * own card immediately. Plain HTML/JS, no build step.
 */
export function renderJoinPage(salonName: string, slug: string): string {
  const safeName = escapeHtml(salonName);
  const safeSlug = escapeHtml(slug);
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeName} -- Stempelkarte</title>
<style>
  ${renderBaseStyles()}
  .card { max-width: 360px; text-align: center; }
  input { margin-top: 1rem; }
</style>
</head>
<body>
  <div class="card">
  <h1>${safeName}</h1>
  <p class="hint">Trag deinen Namen ein und bekomm deine digitale Stempelkarte.</p>
  <div id="error"></div>
  <form id="join-form">
    <input id="customer-name" type="text" placeholder="Dein Name" required autofocus>
    <input id="customer-phone" type="tel" placeholder="Telefonnummer (optional)">
    <button type="submit">Stempelkarte holen</button>
  </form>
  </div>
<script>
(function () {
  var errorBox = document.getElementById('error');

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  // Asking for push permission on this page (instead of leaving it for the wallet page) matters
  // because customers going straight to Google Wallet never see the wallet page at all -- if we
  // didn't ask here, that whole group would silently never get reminders. Best-effort: any
  // failure (unsupported browser, permission denied, network) just falls through to the redirect.
  function enablePushThenRedirect(serialNumber, redirectUrl) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      window.location.href = redirectUrl;
      return;
    }
    var statusBox = document.getElementById('error');
    statusBox.style.display = 'none';
    var goToWallet = function () { window.location.href = redirectUrl; };
    Notification.requestPermission().then(function (permission) {
      if (permission !== 'granted') {
        goToWallet();
        return;
      }
      Promise.all([
        navigator.serviceWorker.register('/wallet/sw.js').catch(function () { return null; }),
        fetch('/push/vapid-public-key').then(function (r) { return r.json(); }),
      ]).then(function (results) {
        var registration = results[0];
        var vapid = results[1];
        if (!registration || !vapid.publicKey) {
          goToWallet();
          return;
        }
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
        }).then(function (subscription) {
          return fetch('/wallet/' + encodeURIComponent(serialNumber) + '/push-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription.toJSON()),
          });
        }).then(goToWallet).catch(goToWallet);
      }).catch(goToWallet);
    }).catch(goToWallet);
  }

  document.getElementById('join-form').addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.style.display = 'none';
    fetch('/salons/${safeSlug}/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('customer-name').value,
        phone: document.getElementById('customer-phone').value,
      }),
    }).then(function (response) {
      return response.json().then(function (body) { return { status: response.status, body: body }; });
    }).then(function (res) {
      if (res.status === 201) {
        var redirectUrl = res.body.redirectUrl || ('/wallet/' + encodeURIComponent(res.body.serialNumber));
        enablePushThenRedirect(res.body.serialNumber, redirectUrl);
      } else {
        errorBox.textContent = 'Bitte einen Namen eingeben.';
        errorBox.style.display = 'block';
      }
    }).catch(function () {
      errorBox.textContent = 'Netzwerkfehler, bitte nochmal versuchen.';
      errorBox.style.display = 'block';
    });
  });
})();
</script>
</body>
</html>`;
}
