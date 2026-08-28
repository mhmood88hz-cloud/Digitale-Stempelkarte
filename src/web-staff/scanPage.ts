/**
 * Staff scan dashboard: plain HTML/CSS/JS, no build step. Manual serial-number entry always
 * works; camera scanning uses jsQR (served locally, see routes.ts) to decode QR codes from raw
 * video frames in plain JS, rather than the browser-native BarcodeDetector API -- BarcodeDetector
 * isn't implemented in WebKit, and every iOS browser (Safari, Chrome, Firefox alike) is forced
 * by Apple to use WebKit under the hood, so relying on it would leave every iPhone unable to
 * scan at all. jsQR only needs getUserMedia + canvas, both of which iOS does support, once served
 * over a secure context (HTTPS or localhost). Camera starts explicitly via a button, not
 * automatically, and always shows a concrete reason when it can't start (no secure context,
 * permission denied) instead of just doing nothing.
 */
import { renderNav, renderNavStyles } from '../shared/nav';

export function renderScanPage(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stempel vergeben</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.25rem; }
  input, button { font-size: 1.1rem; padding: 0.6rem; width: 100%; box-sizing: border-box; margin-top: 0.5rem; }
  button { cursor: pointer; }
  #video { width: 100%; display: none; margin-top: 0.5rem; border-radius: 8px; }
  #result, #new-customer-result { margin-top: 1rem; padding: 0.75rem; border-radius: 8px; display: none; }
  #result.ok, #new-customer-result.ok { background: #dcfce7; color: #14532d; display: block; }
  #result.error, #new-customer-result.error { background: #fee2e2; color: #7f1d1d; display: block; }
  #new-customer-result a { display: inline-block; margin-top: 0.4rem; }
  h1 { margin-top: 2rem; }
  h1:first-child { margin-top: 0; }
  ${renderNavStyles()}
</style>
</head>
<body>
  ${renderNav('scan')}
  <h1>Neuer Kunde</h1>
  <input id="new-customer-name" type="text" placeholder="Name" autocomplete="off">
  <button id="new-customer-button" type="button">Kunde anlegen</button>
  <div id="new-customer-result"></div>

  <h1>Stempel vergeben</h1>
  <input id="serial-input" type="text" placeholder="Seriennummer (z.B. LC-...)" autocomplete="off">
  <button id="stamp-button" type="button">Stempel geben</button>
  <button id="redeem-button" type="button">Rabatt einlösen</button>
  <button id="camera-button" type="button">Kamera starten</button>
  <video id="video" autoplay muted playsinline></video>
  <div id="result"></div>

<script src="/staff/jsqr.js"></script>
<script>
(function () {
  var serialInput = document.getElementById('serial-input');
  var stampButton = document.getElementById('stamp-button');
  var redeemButton = document.getElementById('redeem-button');
  var resultBox = document.getElementById('result');
  var video = document.getElementById('video');

  function showResult(message, ok) {
    resultBox.textContent = message;
    resultBox.className = ok ? 'ok' : 'error';
  }

  function currentSerialNumber() {
    var value = serialInput.value.trim();
    if (!value) throw new Error('Bitte Seriennummer eingeben oder scannen.');
    return value;
  }

  function callApi(path, serialNumber) {
    return fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumber: serialNumber }),
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    });
  }

  function handle(path, successMessageFn) {
    var serialNumber;
    try {
      serialNumber = currentSerialNumber();
    } catch (err) {
      showResult(err.message, false);
      return;
    }
    callApi(path, serialNumber).then(function (res) {
      if (res.status === 200) {
        showResult(successMessageFn(res.body), true);
      } else if (res.status === 401) {
        showResult('Nicht angemeldet.', false);
      } else if (res.status === 404) {
        showResult('Karte nicht gefunden.', false);
      } else if (res.status === 409) {
        showResult('Noch nicht genug Stempel.', false);
      } else {
        showResult('Unbekannter Fehler.', false);
      }
    }).catch(function () {
      showResult('Netzwerkfehler.', false);
    });
  }

  var newCustomerNameInput = document.getElementById('new-customer-name');
  var newCustomerButton = document.getElementById('new-customer-button');
  var newCustomerResult = document.getElementById('new-customer-result');

  newCustomerButton.addEventListener('click', function () {
    var name = newCustomerNameInput.value.trim();
    if (!name) {
      newCustomerResult.textContent = 'Bitte einen Namen eingeben.';
      newCustomerResult.className = 'error';
      return;
    }
    fetch('/api/customers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name }),
    }).then(function (response) {
      return response.json().then(function (body) { return { status: response.status, body: body }; });
    }).then(function (res) {
      if (res.status === 201) {
        var serial = res.body.loyaltyCard.serialNumber;
        newCustomerResult.innerHTML = 'Angelegt: ' + res.body.customer.name +
          '<br><a href="/wallet/' + encodeURIComponent(serial) + '" target="_blank">Kundenkarte ansehen</a>';
        newCustomerResult.className = 'ok';
        serialInput.value = serial;
        newCustomerNameInput.value = '';
      } else if (res.status === 401) {
        newCustomerResult.textContent = 'Nicht angemeldet.';
        newCustomerResult.className = 'error';
      } else {
        newCustomerResult.textContent = 'Fehler beim Anlegen.';
        newCustomerResult.className = 'error';
      }
    }).catch(function () {
      newCustomerResult.textContent = 'Netzwerkfehler.';
      newCustomerResult.className = 'error';
    });
  });

  stampButton.addEventListener('click', function () {
    handle('/api/stamps', function (body) {
      return 'Stempel ' + body.stampCount + ' von ' + body.stampsRequired +
        (body.rewardReady ? ' -- Rabatt bereit!' : '.');
    });
  });

  redeemButton.addEventListener('click', function () {
    handle('/api/redemptions', function () {
      return 'Rabatt eingeloest, Stempelzaehler zurueckgesetzt.';
    });
  });

  var cameraButton = document.getElementById('camera-button');
  var scanCanvas = document.createElement('canvas');
  var scanCtx = scanCanvas.getContext('2d');

  cameraButton.addEventListener('click', function () {
    if (typeof jsQR !== 'function') {
      showResult('QR-Scan-Bibliothek konnte nicht geladen werden. Bitte Seriennummer manuell eingeben.', false);
      return;
    }
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      showResult('Kamera-Zugriff ist hier nicht verfuegbar (evtl. kein HTTPS). Bitte Seriennummer manuell eingeben.', false);
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
      video.style.display = 'block';
      video.srcObject = stream;
      var scanLoop = function () {
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          scanCanvas.width = video.videoWidth;
          scanCanvas.height = video.videoHeight;
          scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
          var imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
          var code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            serialInput.value = code.data;
          }
        }
        requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
    }).catch(function (err) {
      showResult('Kamera-Zugriff verweigert oder fehlgeschlagen: ' + err.message, false);
    });
  });
})();
</script>
</body>
</html>`;
}
