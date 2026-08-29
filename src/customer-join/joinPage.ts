import { renderBaseStyles } from '../shared/styles';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Public, salon-wide self-service page -- meant to be reached via one QR code posted in the
 * shop (not per-customer). Two modes, toggled client-side: a brand-new customer registers with
 * just their name, and a returning one can find their own card again (by their short customer
 * number, or name+phone) without ever having saved a link on their phone. No login, no staff
 * involved. Plain HTML/JS, no build step.
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
  #mode-toggle { display: flex; gap: 0.5rem; margin-top: 1rem; }
  #mode-toggle button { margin-top: 0; flex: 1; }
  #mode-toggle button.inactive { background: var(--color-bg); color: var(--color-muted); }
  .or-divider { margin: 0.75rem 0 0; font-size: 0.8rem; color: var(--color-muted); }
</style>
</head>
<body>
  <div class="card">
  <h1>${safeName}</h1>

  <div id="mode-toggle">
    <button id="mode-new" type="button">Neuer Kunde</button>
    <button id="mode-existing" type="button" class="inactive">Ich bin schon Kunde</button>
  </div>

  <div id="error"></div>

  <div id="new-view">
    <p class="hint">Trag deinen Namen ein und bekomm deine digitale Stempelkarte.</p>
    <form id="join-form">
      <input id="customer-name" type="text" placeholder="Dein Name" required autofocus>
      <input id="customer-phone" type="tel" placeholder="Telefonnummer (optional)">
      <button type="submit">Stempelkarte holen</button>
    </form>
  </div>

  <div id="existing-view" style="display:none">
    <p class="hint">Gib deine Kundennummer ein, oder Name + Telefonnummer.</p>
    <form id="lookup-form">
      <input id="lookup-number" type="number" min="1" placeholder="Kundennummer">
      <p class="or-divider">-- oder --</p>
      <input id="lookup-name" type="text" placeholder="Name">
      <input id="lookup-phone" type="tel" placeholder="Telefonnummer">
      <button type="submit">Karte anzeigen</button>
    </form>
  </div>
  </div>
<script>
(function () {
  var errorBox = document.getElementById('error');
  var newView = document.getElementById('new-view');
  var existingView = document.getElementById('existing-view');
  var modeNewButton = document.getElementById('mode-new');
  var modeExistingButton = document.getElementById('mode-existing');

  function showError(text) {
    errorBox.textContent = text;
    errorBox.style.display = 'block';
  }

  function setMode(mode) {
    errorBox.style.display = 'none';
    var isNew = mode === 'new';
    newView.style.display = isNew ? 'block' : 'none';
    existingView.style.display = isNew ? 'none' : 'block';
    modeNewButton.className = isNew ? '' : 'inactive';
    modeExistingButton.className = isNew ? 'inactive' : '';
  }

  modeNewButton.addEventListener('click', function () { setMode('new'); });
  modeExistingButton.addEventListener('click', function () { setMode('existing'); });

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
        showError('Bitte einen Namen eingeben.');
      }
    }).catch(function () {
      showError('Netzwerkfehler, bitte nochmal versuchen.');
    });
  });

  document.getElementById('lookup-form').addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.style.display = 'none';

    var numberValue = document.getElementById('lookup-number').value.trim();
    var nameValue = document.getElementById('lookup-name').value.trim();
    var phoneValue = document.getElementById('lookup-phone').value.trim();

    var body;
    if (numberValue) {
      body = { customerNumber: Number(numberValue) };
    } else if (nameValue && phoneValue) {
      body = { name: nameValue, phone: phoneValue };
    } else {
      showError('Bitte Kundennummer eingeben, oder Name UND Telefonnummer.');
      return;
    }

    fetch('/salons/${safeSlug}/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.json().then(function (respBody) { return { status: response.status, body: respBody }; });
    }).then(function (res) {
      if (res.status === 200) {
        window.location.href = res.body.redirectUrl;
      } else if (res.status === 429) {
        showError('Zu viele Versuche, bitte in ein paar Minuten nochmal probieren.');
      } else {
        showError('Nicht gefunden. Bitte Angaben prüfen, oder als neuer Kunde registrieren.');
      }
    }).catch(function () {
      showError('Netzwerkfehler, bitte nochmal versuchen.');
    });
  });
})();
</script>
</body>
</html>`;
}
