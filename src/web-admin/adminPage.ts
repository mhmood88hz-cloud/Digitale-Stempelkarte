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
  #report { display: flex; gap: 1.5rem; margin-top: 0.5rem; }
  .stat { text-align: center; }
  .stat .value { font-size: 1.6rem; font-weight: bold; display: block; }
  .stat .label { font-size: 0.8rem; color: #555; }
</style>
</head>
<body>
  <h1>Salon-Verwaltung</h1>
  <div id="message"></div>

  <h2>Diesen Monat</h2>
  <div id="report">Lädt...</div>

  <h2>Einstellungen</h2>
  <label>Name<input id="name"></label>
  <label>Markenfarbe<input id="brandColor"></label>
  <label>Stempel bis Rabatt<input id="stampsRequired" type="number" min="1"></label>
  <label>Rabatt-Beschreibung<input id="rewardDescription"></label>
  <button id="save-settings" type="button">Speichern</button>

  <h2>Kunden-Erinnerungen</h2>
  <label>Erinnerung nach X Tagen ohne Besuch (leer = aus)<input id="reminderIntervalDays" type="number" min="1"></label>
  <label>Standort Breitengrad (optional, für Google Wallet "in der Nähe")<input id="locationLat" type="number" step="any"></label>
  <label>Standort Längengrad (optional)<input id="locationLng" type="number" step="any"></label>
  <button id="send-reminders" type="button">Erinnerungen jetzt senden</button>
  <div id="reminder-send-status"></div>

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
    if (input.reminderIntervalDays !== undefined) {
      var trimmedInterval = String(input.reminderIntervalDays).trim();
      if (trimmedInterval === '') {
        body.reminderIntervalDays = null;
      } else {
        var days = Number(trimmedInterval);
        if (!Number.isInteger(days) || days < 1) throw new Error('Erinnerungsintervall muss eine positive ganze Zahl sein.');
        body.reminderIntervalDays = days;
      }
    }
    ['locationLat', 'locationLng'].forEach(function (key) {
      if (input[key] === undefined) return;
      var trimmedCoord = String(input[key]).trim();
      body[key] = trimmedCoord === '' ? null : Number(trimmedCoord);
    });
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
      document.getElementById('reminderIntervalDays').value = res.body.reminderIntervalDays === null ? '' : res.body.reminderIntervalDays;
      document.getElementById('locationLat').value = res.body.locationLat === null ? '' : res.body.locationLat;
      document.getElementById('locationLng').value = res.body.locationLng === null ? '' : res.body.locationLng;
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
        reminderIntervalDays: document.getElementById('reminderIntervalDays').value,
        locationLat: document.getElementById('locationLat').value,
        locationLng: document.getElementById('locationLng').value,
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

  function loadReport() {
    api('/api/reports/monthly', { method: 'GET' }).then(function (res) {
      var box = document.getElementById('report');
      if (res.status !== 200) { box.textContent = 'Konnte Bericht nicht laden.'; return; }
      box.innerHTML = '';
      [
        { value: res.body.newCustomers, label: 'Neue Kunden' },
        { value: res.body.stampsIssued, label: 'Stempel' },
        { value: res.body.redemptions, label: 'Rabatte eingelöst' },
      ].forEach(function (stat) {
        var el = document.createElement('div');
        el.className = 'stat';
        var value = document.createElement('span');
        value.className = 'value';
        value.textContent = stat.value;
        var label = document.createElement('span');
        label.className = 'label';
        label.textContent = stat.label;
        el.appendChild(value);
        el.appendChild(label);
        box.appendChild(el);
      });
    });
  }

  document.getElementById('send-reminders').addEventListener('click', function () {
    var statusBox = document.getElementById('reminder-send-status');
    statusBox.textContent = 'Sende...';
    api('/api/reminders/send', { method: 'POST' }).then(function (res) {
      if (res.status === 200) statusBox.textContent = res.body.sent + ' Kunde(n) erinnert.';
      else if (res.status === 503) statusBox.textContent = 'Erinnerungen sind nicht konfiguriert.';
      else if (res.status === 403) statusBox.textContent = 'Nur der Owner darf Erinnerungen senden.';
      else statusBox.textContent = 'Fehler beim Senden.';
    });
  });

  loadSalon();
  loadStaff();
  loadReport();
})();
</script>
</body>
</html>`;
}
