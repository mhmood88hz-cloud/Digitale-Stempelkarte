import { renderBaseStyles } from '../shared/styles';

/** Public self-service salon registration form. Plain HTML/JS, no build step. POSTs to the
 * existing /auth/signup API with credentials:'include' so the browser stores the session
 * cookie normally, then redirects straight into the new salon's admin dashboard. */
export function renderSignupPage(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Salon registrieren</title>
<style>
  ${renderBaseStyles()}
  .card { max-width: 400px; }
</style>
</head>
<body>
  <div class="card">
  <h1>Salon registrieren</h1>
  <p class="hint">Kostenlose Testphase, keine Zahlungsdaten nötig.</p>
  <div id="error"></div>
  <form id="signup-form">
    <label>Salonname<input id="salon-name" type="text" required></label>
    <label>Kurzadresse (Slug)<input id="slug" type="text" placeholder="z.b. mein-salon" required></label>
    <p class="hint">Wird Teil deines Login-Links, nur Kleinbuchstaben/Zahlen/Bindestriche.</p>
    <label>Deine E-Mail<input id="owner-email" type="email" required></label>
    <label>Passwort (min. 8 Zeichen)<input id="password" type="password" minlength="8" required></label>
    <button type="submit">Registrieren</button>
  </form>
  </div>
<script>
(function () {
  var errorBox = document.getElementById('error');
  function showError(text) {
    errorBox.textContent = text;
    errorBox.style.display = 'block';
  }
  document.getElementById('signup-form').addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.style.display = 'none';
    var slug = document.getElementById('slug').value.trim();
    fetch('/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salonName: document.getElementById('salon-name').value,
        slug: slug,
        ownerEmail: document.getElementById('owner-email').value,
        password: document.getElementById('password').value,
      }),
    }).then(function (response) {
      if (response.status === 201) {
        window.location.href = '/admin';
      } else if (response.status === 409) {
        showError('Diese Kurzadresse ist schon vergeben, bitte eine andere wählen.');
      } else if (response.status === 400) {
        showError('Ungültige Eingabe (Kurzadresse nur Kleinbuchstaben/Zahlen/Bindestriche, Passwort min. 8 Zeichen).');
      } else {
        showError('Unbekannter Fehler, bitte nochmal versuchen.');
      }
    }).catch(function () {
      showError('Netzwerkfehler.');
    });
  });
})();
</script>
</body>
</html>`;
}
