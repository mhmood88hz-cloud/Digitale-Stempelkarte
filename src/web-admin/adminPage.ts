/** Admin dashboard: salon settings + staff management. Plain HTML/CSS/JS, no build step. */
export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Salon-Verwaltung</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 560px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.3rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  label { display: block; margin-top: 0.75rem; font-size: 0.9rem; }
  input { font-size: 1rem; padding: 0.5rem; width: 100%; box-sizing: border-box; margin-top: 0.25rem; }
  button { font-size: 1rem; padding: 0.6rem 1rem; margin-top: 1rem; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.4rem; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
  #message { margin-top: 1rem; padding: 0.6rem; border-radius: 6px; display: none; }
  #message.ok { background: #dcfce7; color: #14532d; display: block; }
  #message.error { background: #fee2e2; color: #7f1d1d; display: block; }
</style>
</head>
<body>
  <h1>Salon-Verwaltung</h1>
  <div id="message"></div>

  <h2>Einstellungen</h2>
  <label>Name<input id="name"></label>
  <label>Markenfarbe<input id="brandColor"></label>
  <label>Stempel bis Rabatt<input id="stampsRequired" type="number" min="1"></label>
  <label>Rabatt-Beschreibung<input id="rewardDescription"></label>
  <button id="save-settings" type="button">Speichern</button>

  <h2>Personal</h2>
  <table id="staff-table"><thead><tr><th>E-Mail</th><th>Rolle</th><th></th></tr></thead><tbody></tbody></table>
  <label>Neue E-Mail<input id="new-staff-email" type="email"></label>
  <label>Passwort<input id="new-staff-password" type="password"></label>
  <button id="add-staff" type="button">Personal hinzufügen</button>

<script>
(function () {
  // Mirrors src/web-admin/adminClient.ts (tested there, kept dependency-free/inline here too --
  // no build step in this project, so the browser can't import the .ts module directly).
  function buildSalonUpdateBody(input) {
    var body = {};
    ['name', 'brandColor', 'rewardDescription', 'logoUrl'].forEach(function (key) {
      if (input[key] === undefined) return;
      var trimmed = String(input[key]).trim();
      if (trimmed !== '') body[key] = trimmed;
    });
    if (input.stampsRequired !== undefined) {
      var n = Number(input.stampsRequired);
      if (!Number.isInteger(n) || n < 1) throw new Error('Stempelanzahl muss eine positive ganze Zahl sein.');
      body.stampsRequired = n;
    }
    return body;
  }

  function buildAddStaffBody(email, password) {
    var trimmedEmail = String(email).trim();
    if (trimmedEmail === '') throw new Error('E-Mail darf nicht leer sein.');
    if (String(password).length < 8) throw new Error('Passwort muss mindestens 8 Zeichen haben.');
    return { email: trimmedEmail, password: password };
  }

  var messageBox = document.getElementById('message');

  function showMessage(text, ok) {
    messageBox.textContent = text;
    messageBox.className = ok ? 'ok' : 'error';
  }

  function api(path, options) {
    return fetch(path, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, options))
      .then(function (res) { return res.json().then(function (body) { return { status: res.status, body: body }; }); });
  }

  function loadSalon() {
    api('/api/salon', { method: 'GET' }).then(function (res) {
      if (res.status !== 200) return;
      document.getElementById('name').value = res.body.name;
      document.getElementById('brandColor').value = res.body.brandColor;
      document.getElementById('stampsRequired').value = res.body.stampsRequired;
      document.getElementById('rewardDescription').value = res.body.rewardDescription;
    });
  }

  function loadStaff() {
    api('/api/staff', { method: 'GET' }).then(function (res) {
      if (res.status !== 200) return;
      var tbody = document.querySelector('#staff-table tbody');
      tbody.innerHTML = '';
      res.body.forEach(function (member) {
        var row = document.createElement('tr');
        var emailCell = document.createElement('td');
        emailCell.textContent = member.email;
        var roleCell = document.createElement('td');
        roleCell.textContent = member.role;
        var actionCell = document.createElement('td');
        var removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'Entfernen';
        removeButton.addEventListener('click', function () {
          api('/api/staff/' + member.id, { method: 'DELETE' }).then(function (res2) {
            if (res2.status === 204) { showMessage('Entfernt.', true); loadStaff(); }
            else if (res2.status === 409) showMessage('Letzter Owner kann nicht entfernt werden.', false);
            else showMessage('Fehler beim Entfernen.', false);
          });
        });
        actionCell.appendChild(removeButton);
        row.appendChild(emailCell);
        row.appendChild(roleCell);
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });
    });
  }

  document.getElementById('save-settings').addEventListener('click', function () {
    var body;
    try {
      body = buildSalonUpdateBody({
        name: document.getElementById('name').value,
        brandColor: document.getElementById('brandColor').value,
        stampsRequired: document.getElementById('stampsRequired').value,
        rewardDescription: document.getElementById('rewardDescription').value,
      });
    } catch (err) {
      showMessage(err.message, false);
      return;
    }
    api('/api/salon', { method: 'PATCH', body: JSON.stringify(body) }).then(function (res) {
      if (res.status === 200) { showMessage('Gespeichert.', true); loadSalon(); }
      else if (res.status === 403) showMessage('Nur der Owner darf Einstellungen ändern.', false);
      else showMessage('Fehler beim Speichern.', false);
    });
  });

  document.getElementById('add-staff').addEventListener('click', function () {
    var body;
    try {
      body = buildAddStaffBody(
        document.getElementById('new-staff-email').value,
        document.getElementById('new-staff-password').value,
      );
    } catch (err) {
      showMessage(err.message, false);
      return;
    }
    api('/api/staff', { method: 'POST', body: JSON.stringify(body) }).then(function (res) {
      if (res.status === 201) { showMessage('Hinzugefügt.', true); loadStaff(); }
      else if (res.status === 409) showMessage('E-Mail bereits vergeben.', false);
      else if (res.status === 403) showMessage('Nur der Owner darf Personal hinzufügen.', false);
      else showMessage('Fehler beim Hinzufügen.', false);
    });
  });

  loadSalon();
  loadStaff();
})();
</script>
</body>
</html>`;
}
