/**
 * Staff scan dashboard: plain HTML/CSS/JS, no build step, no external dependencies. Manual
 * serial-number entry always works; camera scanning is progressive enhancement via the
 * browser-native BarcodeDetector API (no bundled scanning library) and is simply hidden on
 * browsers that don't support it (notably: no Safari/iOS support as of writing).
 */
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
  #result { margin-top: 1rem; padding: 0.75rem; border-radius: 8px; display: none; }
  #result.ok { background: #dcfce7; color: #14532d; display: block; }
  #result.error { background: #fee2e2; color: #7f1d1d; display: block; }
</style>
</head>
<body>
  <h1>Stempel vergeben</h1>
  <input id="serial-input" type="text" placeholder="Seriennummer (z.B. LC-...)" autocomplete="off">
  <button id="stamp-button" type="button">Stempel geben</button>
  <button id="redeem-button" type="button">Rabatt einlösen</button>
  <video id="video" autoplay muted playsinline></video>
  <div id="result"></div>

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

  if ('BarcodeDetector' in window) {
    video.style.display = 'block';
    var detector = new window.BarcodeDetector();
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
      video.srcObject = stream;
      var scanLoop = function () {
        detector.detect(video).then(function (codes) {
          if (codes.length > 0) {
            serialInput.value = codes[0].rawValue;
          }
        }).catch(function () {});
        requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
    }).catch(function () {
      video.style.display = 'none';
    });
  }
})();
</script>
</body>
</html>`;
}
