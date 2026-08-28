/**
 * Shared top nav for every page behind login (admin dashboard, staff scan page): horizontal
 * row of links so staff/owners can jump between pages instead of typing URLs, plus a logout
 * button. Inlined into each page's HTML (no build step, nothing to import in the browser).
 */
export type NavActivePage = 'admin' | 'scan';

export function renderNavStyles(): string {
  return `
  nav#top-nav { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--color-border); overflow-x: auto; }
  nav#top-nav a { flex: 0 0 auto; padding: 0.5rem 0.9rem; border-radius: 999px; text-decoration: none; font-size: 0.9rem; font-weight: 600; white-space: nowrap; transition: background 0.15s, color 0.15s; }
  nav#top-nav a.active { background: var(--color-primary); color: #fff; }
  nav#top-nav a:not(.active) { background: var(--color-bg); color: var(--color-muted); }
  nav#top-nav a:not(.active):hover { background: var(--color-border); }
  nav#top-nav button#nav-logout { flex: 0 0 auto; margin-top: 0; margin-left: auto; width: auto; padding: 0.5rem 0.9rem; font-size: 0.85rem; border-radius: 999px; background: var(--color-bg); color: var(--color-muted); }
  nav#top-nav button#nav-logout:hover { background: var(--color-border); }`;
}

export function renderNav(active: NavActivePage): string {
  const item = (page: NavActivePage, href: string, label: string): string =>
    `<a href="${href}"${page === active ? ' class="active"' : ''}>${label}</a>`;
  return `
  <nav id="top-nav">
    ${item('admin', '/admin', 'Verwaltung')}
    ${item('scan', '/staff/scan', 'Stempel vergeben')}
    <button id="nav-logout" type="button">Abmelden</button>
  </nav>
  <script>
  document.getElementById('nav-logout').addEventListener('click', function () {
    fetch('/api/salon', { credentials: 'include' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (salon) {
        return fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(function () { return salon; });
      })
      .then(function (salon) {
        window.location.href = salon ? '/salons/' + salon.slug + '/login' : '/';
      });
  });
  </script>`;
}
