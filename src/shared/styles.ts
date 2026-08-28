/**
 * Shared design tokens + base CSS for every server-rendered page (no build step, so this is
 * inlined as a plain string into each page's <style> block rather than imported as a stylesheet
 * the browser can fetch). Keeps login/signup/join/wallet/admin/scan visually consistent without
 * duplicating the same rules six times.
 */
export function renderBaseStyles(): string {
  return `
  :root {
    --color-bg: #f3f4f8;
    --color-surface: #ffffff;
    --color-text: #16181d;
    --color-muted: #6b7280;
    --color-border: #e5e7eb;
    --color-primary: #4f46e5;
    --color-primary-dark: #4338ca;
    --color-success-bg: #dcfce7;
    --color-success-text: #14532d;
    --color-error-bg: #fee2e2;
    --color-error-text: #7f1d1d;
    --radius: 14px;
    --radius-sm: 8px;
    --shadow: 0 1px 2px rgba(16, 24, 40, 0.06), 0 4px 12px rgba(16, 24, 40, 0.06);
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--color-bg);
    color: var(--color-text);
    margin: 0;
    padding: 2.5rem 1rem;
    line-height: 1.45;
  }
  .card {
    background: var(--color-surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 1.75rem;
    margin: 0 auto;
  }
  h1 { font-size: 1.3rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.05rem; margin-top: 2rem; margin-bottom: 0.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border); }
  h2:first-of-type { padding-top: 0; border-top: none; }
  p.hint { font-size: 0.85rem; color: var(--color-muted); margin-top: 0.25rem; }
  a { color: var(--color-primary); }
  label { display: block; margin-top: 1rem; font-size: 0.85rem; font-weight: 600; color: var(--color-muted); }
  input {
    font-size: 1rem;
    padding: 0.65rem 0.75rem;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.35rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
  }
  button {
    font-size: 1rem;
    font-weight: 600;
    padding: 0.7rem 1.1rem;
    margin-top: 1.25rem;
    width: 100%;
    cursor: pointer;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-primary);
    color: #fff;
    transition: background 0.15s, transform 0.05s;
  }
  button:hover { background: var(--color-primary-dark); }
  button:active { transform: scale(0.99); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.secondary { background: var(--color-border); color: var(--color-text); }
  button.secondary:hover { background: #d7dae0; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
  th, td { text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--color-border); font-size: 0.88rem; }
  th { color: var(--color-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.02em; }
  table button { width: auto; margin-top: 0; padding: 0.4rem 0.75rem; font-size: 0.85rem; }
  #message, #error, #result, #new-customer-result, #reminder-send-status {
    margin-top: 1rem;
    padding: 0.7rem 0.85rem;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    display: none;
  }
  #error { background: var(--color-error-bg); color: var(--color-error-text); }
  #message.ok, #result.ok, #new-customer-result.ok { display: block; background: var(--color-success-bg); color: var(--color-success-text); }
  #message.error, #result.error, #new-customer-result.error { display: block; background: var(--color-error-bg); color: var(--color-error-text); }`;
}
