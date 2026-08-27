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
  body { font-family: system-ui, sans-serif; max-width: 360px; margin: 3rem auto; padding: 0 1rem; text-align: center; }
  h1 { font-size: 1.3rem; }
  input { font-size: 1.1rem; padding: 0.7rem; width: 100%; box-sizing: border-box; margin-top: 1rem; }
  button { font-size: 1.1rem; padding: 0.8rem 1rem; margin-top: 1.25rem; width: 100%; cursor: pointer; }
  #error { margin-top: 1rem; padding: 0.6rem; border-radius: 6px; background: #fee2e2; color: #7f1d1d; display: none; }
</style>
</head>
<body>
  <h1>${safeName}</h1>
  <p>Trag deinen Namen ein und bekomm deine digitale Stempelkarte.</p>
  <div id="error"></div>
  <form id="join-form">
    <input id="customer-name" type="text" placeholder="Dein Name" required autofocus>
    <input id="customer-phone" type="tel" placeholder="Telefonnummer (optional)">
    <button type="submit">Stempelkarte holen</button>
  </form>
<script>
(function () {
  var errorBox = document.getElementById('error');
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
        window.location.href = '/wallet/' + encodeURIComponent(res.body.serialNumber);
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
