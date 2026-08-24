/**
 * Detects Apple mobile devices (iPhone/iPad/iPod) by User-Agent. There is no Google Wallet app
 * on iOS/iPadOS -- opening the "Add to Google Wallet" save link there has nothing to save the
 * pass into, so the page hides that button on these devices rather than offering a link that
 * can't actually work (see src/customer-pwa/page.ts).
 */
export function isAppleMobileDevice(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return /iPhone|iPad|iPod/.test(userAgent);
}
