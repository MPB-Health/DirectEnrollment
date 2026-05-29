/** Primary subscriber mailing states where Direct enrollment is unavailable. */

export const PREMIUM_CARE_UNAVAILABLE_STATES = ['WA', 'DC', 'NJ', 'RI'] as const;

export const PREMIUM_CARE_UNAVAILABLE_STATE_MESSAGE =
  'Direct not available in your state';

export function isPremiumCareUnavailableState(code: string): boolean {
  return (PREMIUM_CARE_UNAVAILABLE_STATES as readonly string[]).includes(code);
}
