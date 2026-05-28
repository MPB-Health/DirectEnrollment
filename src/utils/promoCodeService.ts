import { supabase } from '../lib/supabaseClient';
import { AppliedPromo } from '../hooks/useEnrollmentStorage';
import { DEFAULT_PROMO_PDID } from '../constants/promoDefaults';

export interface PromoCodeValidationResult {
  success: boolean;
  promo?: AppliedPromo;
  error?: string;
}

/** Escape for PostgREST `ilike` so `%` and `_` in user input are literal. */
export function escapePromoCodeForILike(trimmed: string): string {
  return trimmed.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function effectivePdid(userPdid?: number | null): number {
  const n = userPdid == null ? NaN : Number(userPdid);
  return !Number.isNaN(n) && n > 0 ? Math.floor(n) : DEFAULT_PROMO_PDID;
}

/** Normalizes Postgres/JSON variants: number, spaced text, commas, NBSP. */
export function normalizeProduct(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw).trim();
  return String(raw).replace(/\u00a0/g, ' ').trim();
}

/**
 * Matches docs/promocode.md §4.
 * Handles `product` as text or JSON number (`42465` vs `"42465"`) and minor formatting.
 */
export function promoRowMatchesEnrollmentProduct(
  productRaw: string | number | null | undefined,
  effectivePdId: number,
): boolean {
  const eff = Number(effectivePdId);
  const s = normalizeProduct(productRaw);

  if (s === '') return true;
  const upper = s.toUpperCase();
  if (upper === '*' || upper === 'ALL' || upper === 'ANY') return true;

  const condensed = s.replace(/\s+/g, '').replace(/,/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(condensed)) {
    const n = Number(condensed);
    if (Number.isFinite(n) && n === eff) return true;
  }

  return s === String(eff) || condensed === String(eff);
}

export async function validatePromoCode(
  code: string,
  pdid?: number | null,
): Promise<PromoCodeValidationResult> {
  if (!code || code.trim() === '') {
    return {
      success: false,
      error: 'Please enter an enrollment code',
    };
  }

  if (!supabase) {
    return {
      success: false,
      error: 'Enrollment code validation is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
    };
  }

  const trimmed = code.trim();
  const escaped = escapePromoCodeForILike(trimmed);
  /** Whole-string `ilike` (case-insensitive); escaping keeps `%`/`_` literal vs LIKE wildcards. */
  const eff = effectivePdid(pdid ?? null);
  const codeLower = trimmed.toLowerCase();

  try {
    const { data: rows, error } = await supabase
      .from('promocodes')
      .select('code, product, discount_amount')
      .ilike('code', escaped)
      .eq('active', true)
      .order('id', { ascending: true })
      .limit(40);

    if (error) {
      console.error('Error validating promo code:', error);
      return {
        success: false,
        error: 'Error validating enrollment code. Please try again.',
      };
    }

    /** Exact trimmed case-insensitive code match, scoped to enrollment product. */
    const eligible =
      rows?.filter(
        (row) =>
          String(row.code ?? '').trim().toLowerCase() === codeLower &&
          promoRowMatchesEnrollmentProduct(row.product, eff),
      ) ?? [];

    const row = eligible[0];

    if (!row) {
      if ((rows?.length ?? 0) > 0) {
        return {
          success: false,
          error: 'This enrollment code is not valid for this enrollment product.',
        };
      }
      return {
        success: false,
        error: 'Invalid enrollment code',
      };
    }

    return {
      success: true,
      promo: {
        code: row.code,
        product: String(row.product),
        discountAmount: parseFloat(String(row.discount_amount)),
      },
    };
  } catch (e) {
    console.error('Error validating promo code:', e);
    return {
      success: false,
      error: 'Network error. Please check your connection and try again.',
    };
  }
}

export function applyPromoDiscount(
  initialPayment: number,
  appliedPromo: AppliedPromo | null,
): number {
  if (!appliedPromo) {
    return initialPayment;
  }

  const discountedAmount = initialPayment - appliedPromo.discountAmount;
  return Math.max(0, discountedAmount);
}
