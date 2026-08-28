import { renderBaseStyles } from '../shared/styles';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain HTML/JS login form, no build step. POSTs to the existing /salons/:slug/auth/login API
 * with credentials:'include' so the browser stores the session cookie normally, then redirects. */
export function renderLoginPage(slug: string): string {
  const safeSlug = escapeHtml(slug);
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anmelden</title>
<style>
  ${renderBaseStyles()}
  .card { max-width: 360px; }
</style>
</head>
<body>
  <div class="card">
  <h1>Anmelden</h1>
  <div id="error"></div>
  <form id="login-form">
    <label>E-Mail<input id="email" type="email" required></label>
    <label>Passwort<input id="password" type="password" required></label>
    <button type="submit">Anmelden</button>
  </form>
  </div>
<script>
(function () {
  var errorBox = document.getElementById('error');
  document.getElementById('login-form').addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.style.display = 'none';
    fetch('/salons/${safeSlug}/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      }),
    }).then(function (response) {
      if (response.status === 200) {
        window.location.href = '/staff/scan';
      } else {
        errorBox.textContent = 'E-Mail oder Passwort falsch.';
        errorBox.style.display = 'block';
      }
    }).catch(function () {
      errorBox.textContent = 'Netzwerkfehler.';
      errorBox.style.display = 'block';
    });
  });
})();
</script>
</body>
</html>`;
}
