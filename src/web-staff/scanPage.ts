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
import { renderBaseStyles } from '../shared/styles';

export function renderScanPage(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stempel vergeben</title>
<style>
  ${renderBaseStyles()}
  ${renderNavStyles()}
  .card { max-width: 480px; }
  h1 { margin-top: 0; }
  #video { width: 100%; display: none; margin-top: 0.75rem; border-radius: var(--radius-sm); }
  #new-customer-result a { display: inline-block; margin-top: 0.4rem; }
  button.secondary { margin-top: 0.5rem; }
  .customer-hit-wrapper { border-bottom: 1px solid var(--color-border); }
  .customer-hit-wrapper:last-child { border-bottom: none; }
  .customer-hit { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.6rem 0; text-align: left; }
  .customer-hit .info { font-size: 0.9rem; }
  .customer-hit .info .name { font-weight: 600; }
  .customer-hit .info .meta { color: var(--color-muted); font-size: 0.8rem; }
  .customer-hit .actions { display: flex; gap: 0.4rem; flex: 0 0 auto; }
  .customer-hit .actions button { width: auto; margin-top: 0; padding: 0.4rem 0.7rem; font-size: 0.85rem; }
  #search-results { margin-top: 0.5rem; }
  .qr-preview { margin-top: 0.5rem; text-align: center; }
  .qr-preview img { width: 160px; height: 160px; }
</style>
</head>
<body>
  <div class="card">
  ${renderNav('scan')}
  <h1>Kunde suchen</h1>
  <input id="search-input" type="text" placeholder="Name, Telefonnummer oder Kundennummer" autocomplete="off">
  <div id="search-results"></div>

  <h2>Neuer Kunde</h2>
  <input id="new-customer-name" type="text" placeholder="Name" autocomplete="off">
  <button id="new-customer-button" type="button">Kunde anlegen</button>
  <div id="new-customer-result"></div>

  <h2>Stempel vergeben</h2>
  <input id="serial-input" type="text" placeholder="Seriennummer (z.B. LC-...)" autocomplete="off">
  <button id="stamp-button" type="button">Stempel geben</button>
  <button id="redeem-button" type="button" class="secondary">Rabatt einlösen</button>
  <button id="camera-button" type="button" class="secondary">Kamera starten</button>
  <video id="video" autoplay muted playsinline></video>
  <div id="result"></div>
  </div>

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
      return Promise.resolve();
    }
    return callApi(path, serialNumber).then(function (res) {
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

  function giveStamp(serialNumber, onDone) {
    serialInput.value = serialNumber;
    handle('/api/stamps', function (body) {
      return 'Stempel ' + body.stampCount + ' von ' + body.stampsRequired +
        (body.rewardReady ? ' -- Rabatt bereit!' : '.');
    }).then(function () {
      if (onDone) onDone();
    });
  }

  stampButton.addEventListener('click', function () {
    handle('/api/stamps', function (body) {
      return 'Stempel ' + body.stampCount + ' von ' + body.stampsRequired +
        (body.rewardReady ? ' -- Rabatt bereit!' : '.');
    });
  });

  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchTimer = null;

  function runSearch() {
    var query = searchInput.value.trim();
    if (query.length < 2) {
      searchResults.innerHTML = '';
      return;
    }
    fetch('/api/customers/search?q=' + encodeURIComponent(query), { credentials: 'include' })
      .then(function (response) { return response.json(); })
      .then(function (hits) {
        searchResults.innerHTML = '';
        if (hits.length === 0) {
          var empty = document.createElement('p');
          empty.className = 'hint';
          empty.textContent = 'Keine Treffer.';
          searchResults.appendChild(empty);
          return;
        }
        hits.forEach(function (hit) {
          var wrapper = document.createElement('div');
          wrapper.className = 'customer-hit-wrapper';

          var row = document.createElement('div');
          row.className = 'customer-hit';

          var info = document.createElement('div');
          info.className = 'info';
          var nameLine = document.createElement('div');
          nameLine.className = 'name';
          nameLine.textContent = hit.name + ' (#' + hit.customerNumber + ')';
          var metaLine = document.createElement('div');
          metaLine.className = 'meta';
          metaLine.textContent = (hit.phone || 'keine Telefonnummer') + ' -- ' + hit.stampCount + ' Stempel';
          info.appendChild(nameLine);
          info.appendChild(metaLine);

          var actions = document.createElement('div');
          actions.className = 'actions';

          var stampHitButton = document.createElement('button');
          stampHitButton.type = 'button';
          stampHitButton.textContent = 'Stempel geben';
          stampHitButton.addEventListener('click', function () {
            giveStamp(hit.serialNumber, runSearch);
          });

          var qrButton = document.createElement('button');
          qrButton.type = 'button';
          qrButton.className = 'secondary';
          qrButton.textContent = 'QR zeigen';
          qrButton.addEventListener('click', function () {
            var existing = wrapper.querySelector('.qr-preview');
            if (existing) { existing.remove(); return; }
            var preview = document.createElement('div');
            preview.className = 'qr-preview';
            var img = document.createElement('img');
            img.src = '/wallet/' + encodeURIComponent(hit.serialNumber) + '/qr.svg';
            img.alt = 'QR-Code fuer ' + hit.name;
            preview.appendChild(img);
            wrapper.appendChild(preview);
          });

          actions.appendChild(stampHitButton);
          actions.appendChild(qrButton);
          row.appendChild(info);
          row.appendChild(actions);
          wrapper.appendChild(row);
          searchResults.appendChild(wrapper);
        });
      });
  }

  searchInput.addEventListener('input', function () {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 300);
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
      var stopped = false;
      // Stop the camera the instant a code is decoded -- otherwise the next few video frames
      // still show the same QR code and would trigger the stamp API again for each one, handing
      // out several stamps for a single scan.
      var stopCamera = function () {
        stopped = true;
        stream.getTracks().forEach(function (track) { track.stop(); });
        video.srcObject = null;
        video.style.display = 'none';
      };
      var scanLoop = function () {
        if (stopped) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          scanCanvas.width = video.videoWidth;
          scanCanvas.height = video.videoHeight;
          scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
          var imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
          var code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            stopCamera();
            serialInput.value = code.data;
            handle('/api/stamps', function (body) {
              return 'Stempel ' + body.stampCount + ' von ' + body.stampsRequired +
                (body.rewardReady ? ' -- Rabatt bereit!' : '.');
            });
            return;
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
