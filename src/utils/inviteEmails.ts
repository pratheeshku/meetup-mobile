/** Email-invite helpers for Create Game step 6. Addresses are never logged. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidInviteEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export type AddEmailResult =
  | { ok: true; emails: string[] }
  | { ok: false; reason: 'invalid' | 'duplicate' };

/** Adds a trimmed email unless invalid or already present (case-insensitive). */
export function addInviteEmail(existing: string[], raw: string): AddEmailResult {
  const email = raw.trim();
  if (!isValidInviteEmail(email)) {
    return { ok: false, reason: 'invalid' };
  }
  if (existing.some(item => item.toLowerCase() === email.toLowerCase())) {
    return { ok: false, reason: 'duplicate' };
  }
  return { ok: true, emails: [...existing, email] };
}
