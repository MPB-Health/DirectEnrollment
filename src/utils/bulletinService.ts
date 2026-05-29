import { supabase } from '../lib/supabaseClient';

/** Plan tag this project uses to claim its bulletins in the shared `bulletin` table. */
export const PROJECT_PLAN = 'Direct';

export interface Bulletin {
  id: string;
  name: string | null;
  notes: string | null;
  active: boolean;
  plan: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Fetch active bulletins whose `plan` array contains the given plan tag.
 * Defaults to this project's plan. Returns an empty array on error (or when the
 * Supabase client is not configured) so callers can render nothing without throwing.
 */
export async function fetchBulletins(plan: string = PROJECT_PLAN): Promise<Bulletin[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('bulletin')
    .select('id, name, notes, active, plan, created_at, updated_at')
    .eq('active', true)
    .contains('plan', [plan])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[bulletin] failed to fetch bulletins:', error.message);
    return [];
  }

  return (data ?? []) as Bulletin[];
}
