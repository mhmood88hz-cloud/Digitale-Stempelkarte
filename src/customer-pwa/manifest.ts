export interface ManifestData {
  salonName: string;
  brandColor: string;
  serialNumber: string;
  logoUrl?: string | null;
}

/**
 * Web app manifest for "Add to Home Screen" installability. Note: Chrome's automatic install
 * banner on Android additionally wants real icon files (192x192 + 512x512) to trigger -- until
 * a salon has a logo processed into those sizes, the icons array is empty and Android falls
 * back to a manual "Install" menu entry instead of the automatic banner. Known limitation, not
 * a bug: documented here rather than faked with a placeholder icon.
 */
export function buildManifest(data: ManifestData): Record<string, unknown> {
  return {
    name: `${data.salonName} Stempelkarte`,
    short_name: 'Stempelkarte',
    start_url: `/wallet/${data.serialNumber}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: data.brandColor,
    icons: data.logoUrl ? [{ src: data.logoUrl, sizes: '192x192', type: 'image/png' }] : [],
  };
}
