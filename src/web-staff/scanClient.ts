export interface StampResult {
  stampCount: number;
  stampsRequired: number;
  rewardReady: boolean;
}

export function buildStampRequestBody(serialNumber: string): { serialNumber: string } {
  const trimmed = serialNumber.trim();
  if (trimmed === '') {
    throw new Error('Serial number cannot be empty');
  }
  return { serialNumber: trimmed };
}

export function parseStampResponse(status: number, body: unknown): { ok: true; result: StampResult } | { ok: false; error: string } {
  if (status === 200) {
    return { ok: true, result: body as StampResult };
  } else if (status === 401) {
    return { ok: false, error: 'Nicht angemeldet' };
  } else if (status === 404) {
    return { ok: false, error: 'Karte nicht gefunden' };
  } else {
    return { ok: false, error: 'Unbekannter Fehler' };
  }
}
