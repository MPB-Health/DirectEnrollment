/**
 * Client-side submission idempotency helpers.
 *
 * A single `submissionId` (UUID) is generated per enrollment attempt and reused
 * across retries until the attempt fully completes. It is sent to:
 *   - the enrollment API as the `X-Submission-Id` header,
 *   - `save-enrollment-pdf` as the `submissionId` form field,
 *   - the gateway attach function in the JSON body.
 *
 * The server (`enrollment-api-direct` + shared `enrollment_submissions` table)
 * uses it to guarantee the external member API is called at most once per
 * submission, so duplicate Submit clicks / lost responses cannot create a second
 * member, charge, or PDF.
 */

const STORAGE_KEY = 'enrollment_submission_id';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID validation — mirrors the edge `_shared/enrollmentSubmissions.ts` regex. */
export function isValidSubmissionId(id: string | null | undefined): boolean {
  return !!id && UUID_RE.test(id.trim());
}

/** UUID persisted in `sessionStorage`; reused across retries until cleared. */
export function getOrCreateSubmissionId(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (isValidSubmissionId(existing)) return existing!.trim();
  } catch {
    // sessionStorage unavailable (e.g. privacy mode) — fall through to a fresh id.
  }

  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Best-effort persistence; the id is still returned for this attempt.
  }
  return id;
}

/** Remove the stored id once an attempt fully completes (call on thank-you). */
export function clearSubmissionId(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing to clean up if storage is unavailable.
  }
}

export interface SubmissionStatusResponse {
  success: boolean;
  status: string;
  memberId: string | null;
  pdfUrl: string | null;
  gatewayAttempts: number;
  lastError: string | null;
}

/**
 * GET the enrollment API with the `submissionId` query param to recover the
 * server-recorded `memberId`/status — used after a 409 (parallel duplicate
 * submit) so the client can resume the PDF/gateway phase instead of re-POSTing.
 */
export async function fetchSubmissionStatus(
  submissionId: string,
  agentParam: string,
): Promise<SubmissionStatusResponse | null> {
  if (!isValidSubmissionId(submissionId)) return null;

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const statusUrl = `${supabaseUrl}/functions/v1/enrollment-api-direct?id=${agentParam}&submissionId=${encodeURIComponent(submissionId)}`;

    const res = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Cache-Control': 'no-cache, no-store',
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.success !== true) return null;

    return data as SubmissionStatusResponse;
  } catch {
    return null;
  }
}

/** Generic exponential-backoff helper. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number },
): Promise<T> {
  const retries = opts?.retries ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 1000;
  const maxDelayMs = opts?.maxDelayMs ?? 5000;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
