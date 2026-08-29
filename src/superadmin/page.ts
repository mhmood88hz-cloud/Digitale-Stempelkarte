import { renderBaseStyles } from '../shared/styles';

/**
 * Platform-owner-only dashboard: pause/reactivate any salon's account, independent of Stripe --
 * see src/auth/tenantGuard.ts (blockInactiveSalon). Single page, no build step: the client JS
 * checks its own auth by calling the salons API and shows the login form on 401 instead of the
 * server deciding server-side (matches every other page in this project).
 */
export function renderSuperadminPage(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Super-Admin</title>
<style>
  ${renderBaseStyles()}
  .card { max-width: 640px; }
  #logout { width: auto; padding: 0.5rem 0.9rem; font-size: 0.85rem; float: right; margin-top: 0; background: var(--color-bg); color: var(--color-muted); }
  #logout:hover { background: var(--color-border); }
  .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .badge.active { background: var(--color-success-bg); color: var(--color-success-text); }
  .badge.paused { background: var(--color-error-bg); color: var(--color-error-text); }
  table button { width: auto; }
</style>
</head>
<body>
  <div class="card">
  <div id="login-view">
    <h1>Super-Admin</h1>
    <div id="error"></div>
    <form id="login-form">
      <label>Passwort<input id="password" type="password" required></label>
      <button type="submit">Anmelden</button>
    </form>
  </div>

  <div id="dashboard-view" style="display:none">
    <button id="logout" type="button">Abmelden</button>
    <h1>Salons</h1>
    <div id="message"></div>
    <table id="salons-table">
      <thead><tr><th>Salon</th><th>Kunden</th><th>Abo</th><th>Status</th><th></th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  </div>
<script>
(function () {
  var loginView = document.getElementById('login-view');
  var dashboardView = document.getElementById('dashboard-view');
  var errorBox = document.getElementById('error');
  var messageBox = document.getElementById('message');

  function showMessage(text, ok) {
    messageBox.textContent = text;
    messageBox.className = ok ? 'ok' : 'error';
  }

  function api(path, options) {
    var opts = Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, options);
    if (opts.body === undefined && opts.method && opts.method !== 'GET') opts.body = '{}';
    return fetch(path, opts).then(function (res) {
      return res.json().then(function (body) { return { status: res.status, body: body }; });
    });
  }

  function loadSalons() {
    api('/api/superadmin/salons', { method: 'GET' }).then(function (res) {
      if (res.status !== 200) {
        dashboardView.style.display = 'none';
        loginView.style.display = 'block';
        return;
      }
      loginView.style.display = 'none';
      dashboardView.style.display = 'block';
      var tbody = document.querySelector('#salons-table tbody');
      tbody.innerHTML = '';
      res.body.forEach(function (salon) {
        var row = document.createElement('tr');

        var nameCell = document.createElement('td');
        nameCell.textContent = salon.name;
        var slugHint = document.createElement('div');
        slugHint.style.fontSize = '0.75rem';
        slugHint.style.color = 'var(--color-muted)';
        slugHint.textContent = salon.slug;
        nameCell.appendChild(slugHint);

        var customerCell = document.createElement('td');
        customerCell.textContent = salon.customerCount;

        var subCell = document.createElement('td');
        subCell.textContent = salon.subscriptionStatus;

        var statusCell = document.createElement('td');
        var badge = document.createElement('span');
        badge.className = 'badge ' + (salon.isActive ? 'active' : 'paused');
        badge.textContent = salon.isActive ? 'Aktiv' : 'Pausiert';
        statusCell.appendChild(badge);

        var actionCell = document.createElement('td');
        var toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.textContent = salon.isActive ? 'Pausieren' : 'Aktivieren';
        toggleButton.className = salon.isActive ? '' : 'secondary';
        toggleButton.addEventListener('click', function () {
          toggleButton.disabled = true;
          api('/api/superadmin/salons/' + salon.id, { method: 'PATCH', body: JSON.stringify({ isActive: !salon.isActive }) })
            .then(function (res2) {
              if (res2.status === 200) {
                showMessage(salon.name + (res2.body.isActive ? ' aktiviert.' : ' pausiert.'), true);
                loadSalons();
              } else {
                showMessage('Fehler beim Speichern.', false);
                toggleButton.disabled = false;
              }
            });
        });
        actionCell.appendChild(toggleButton);

        row.appendChild(nameCell);
        row.appendChild(customerCell);
        row.appendChild(subCell);
        row.appendChild(statusCell);
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });
    });
  }

  document.getElementById('login-form').addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.style.display = 'none';
    api('/superadmin/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('password').value }) })
      .then(function (res) {
        if (res.status === 200) {
          loadSalons();
        } else {
          errorBox.textContent = 'Falsches Passwort.';
          errorBox.style.display = 'block';
        }
      });
  });

  document.getElementById('logout').addEventListener('click', function () {
    api('/superadmin/logout', { method: 'POST' }).then(function () {
      dashboardView.style.display = 'none';
      loginView.style.display = 'block';
    });
  });

  loadSalons();
})();
</script>
</body>
</html>`;
}
