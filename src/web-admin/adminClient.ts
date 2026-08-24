export interface SalonUpdateBody {
  name?: string;
  brandColor?: string;
  stampsRequired?: number;
  rewardDescription?: string;
  logoUrl?: string;
}

export function buildSalonUpdateBody(input: {
  name?: string;
  brandColor?: string;
  stampsRequired?: string | number;
  rewardDescription?: string;
  logoUrl?: string;
}): SalonUpdateBody {
  const result: SalonUpdateBody = {};

  const processOptionalString = (key: 'name' | 'brandColor' | 'rewardDescription' | 'logoUrl', value: string | undefined) => {
    if (value === undefined) return;
    const trimmed = value.trim();
    if (trimmed === '') return;
    result[key] = trimmed;
  };

  processOptionalString('name', input.name);
  processOptionalString('brandColor', input.brandColor);
  processOptionalString('rewardDescription', input.rewardDescription);
  processOptionalString('logoUrl', input.logoUrl);

  if (input.stampsRequired !== undefined) {
    const num = Number(input.stampsRequired);
    if (!Number.isInteger(num) || num < 1 || Number.isNaN(num)) {
      throw new Error('Invalid stampsRequired');
    }
    result.stampsRequired = num;
  }

  return result;
}

export function buildAddStaffBody(email: string, password: string): { email: string; password: string } {
  const trimmedEmail = email.trim();
  if (trimmedEmail === '') {
    throw new Error('Email cannot be empty');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return { email: trimmedEmail, password };
}
