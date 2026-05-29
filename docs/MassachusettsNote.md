# Massachusetts state note (bulletin) — replication guide

Show a **state-gated notice at the top of the address/payment step** that is driven by a shared Supabase `bulletin` table. The note renders **only when the subscriber selects a specific state** (here: **Massachusetts / `MA`**) and **only** when there is an **active** bulletin tagged for **this project's plan**.

This was originally built in **CareEnrollment**, but reverted there because **Care+ is not available in Massachusetts**. Use this guide to apply it to a **similar project that *does* allow MA**.

> **Important:** In the target project the plan tag is **NOT `CarePlus`**. Pick the tag that identifies the target project in the shared `bulletin` table (referred to below as `YOUR_PROJECT_PLAN`).

---

## How it works

1. A shared `bulletin` table **already exists** in Supabase — you do **not** need to create it. Each row has a `plan` text array and an `active` boolean.
2. The `plan` field already carries the project name (this project's tag), so you simply **query** for it — no table creation or seeding required.
3. A small service reads **active** bulletins whose `plan` array **contains** this project's tag.
4. A presentational component renders those bulletins as info cards (or `null` if none).
5. The component is mounted at the **top of the step**, gated on `state === 'MA'`.

```
state select === 'MA'  ──►  <BulletinNotice />  ──►  fetchBulletins(YOUR_PROJECT_PLAN)
                                                         └─ active = true AND plan @> {YOUR_PROJECT_PLAN}
```

---

## Prerequisites

| Requirement | Detail |
|-------------|--------|
| Supabase client | An initialized browser client (anon key), e.g. `src/lib/supabaseClient.ts` exporting `supabase`. |
| `bulletin` table | **Already exists** as a shared table in Supabase — no need to create it. The `plan` field already holds the project name to query against. |
| RLS | Public `SELECT` policy limited to `active = true` so the anon key can read (already in place). |
| State value format | The state `<select>` stores 2-letter codes (`MA`). If yours stores full names, gate on `'Massachusetts'` instead. |
| Target state allowed | The target project must actually allow MA enrollment (CareEnrollment does not). |

---

## 1. Database — shared `bulletin` table (already exists)

> **Do not create or seed this table.** The `bulletin` table is a **shared table that already exists** in Supabase, and the `plan` field is **already populated with the project name** to query against. There is no migration, `CREATE TABLE`, or `INSERT` step for this feature — you only **read** from it.

For reference only, the existing table has this shape:

```sql
-- EXISTING shared table (reference only — do NOT run)
bulletin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  notes text,
  active boolean DEFAULT true NOT NULL,
  plan text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

- Public `SELECT` RLS limited to `active = true` is **already in place**, so the anon key can read.
- `plan` is a `text[]` and a bulletin can target several projects at once, e.g. `ARRAY['Secure HSA','OtherPlan']`. Matching is **case-sensitive**.
- The row(s) for this project already carry the project name in `plan` (e.g. `ARRAY['Secure HSA']`), so the service just queries for it.

---

## 2. Service — `src/utils/bulletinService.ts`

Set `PROJECT_PLAN` to the **target project's** tag (not `CarePlus`).

```ts
import { supabase } from '../lib/supabaseClient';

/** Plan tag this project uses to claim its bulletins in the shared `bulletin` table. */
export const PROJECT_PLAN = 'YOUR_PROJECT_PLAN'; // e.g. 'EssentialCare'

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
 * Defaults to this project's plan. Returns an empty array on error so callers
 * can render nothing without throwing.
 */
export async function fetchBulletins(plan: string = PROJECT_PLAN): Promise<Bulletin[]> {
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
```

- `.eq('active', true)` + `.contains('plan', [plan])` ⇒ SQL `active = true AND plan @> '{YOUR_PROJECT_PLAN}'`.
- RLS already restricts to active rows; the explicit `.eq('active', true)` is defensive and harmless.

---

## 3. Component — `src/components/BulletinNotice.tsx`

Presentational + self-fetching. Renders `null` when there is nothing to show.

```tsx
import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { fetchBulletins, type Bulletin } from '../utils/bulletinService';

/**
 * Displays active bulletins for this project as info notices. Renders nothing
 * while loading or when there are no bulletins to show.
 */
export default function BulletinNotice() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);

  useEffect(() => {
    let isMounted = true;

    fetchBulletins()
      .then((data) => {
        if (isMounted) setBulletins(data);
      })
      .catch(() => {
        if (isMounted) setBulletins([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (bulletins.length === 0) return null;

  return (
    <div className="space-y-3">
      {bulletins.map((bulletin) => (
        <div
          key={bulletin.id}
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm"
          role="status"
        >
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            {bulletin.name && (
              <p className="text-sm font-semibold text-blue-900">{bulletin.name}</p>
            )}
            {bulletin.notes && (
              <p className="mt-1 text-sm leading-relaxed text-blue-800 whitespace-pre-line">
                {bulletin.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Design notes (match the host app):**
- Uses the existing info-box language: `bg-blue-50` + `border-blue-200`, blue text, `Info` icon from `lucide-react`.
- `whitespace-pre-line` preserves line breaks authored in the `notes` field.
- `role="status"` so assistive tech announces it.
- Swap colors (e.g. amber `bg-amber-50 / border-amber-200 / text-amber-800`) if the note is a warning rather than info.

---

## 4. Wire into the step (gate on Massachusetts)

In the step component where the **state** is selected (in CareEnrollment this is **Step 3 / `src/components/Step2AddressInfo.tsx`**), import the component and render it at the **top** of the returned JSX, gated on the state value.

```tsx
import BulletinNotice from './BulletinNotice';
```

```tsx
return (
  <div className="space-y-8">
    {formData.state === 'MA' && <BulletinNotice />}

    {/* ...rest of the step (Address Information, etc.)... */}
  </div>
);
```

- Gating in the parent means the fetch only fires once **MA** is selected (the component mounts lazily).
- If your form stores full state names, use `formData.state === 'Massachusetts'`.
- To support **multiple** gated states, swap the check for an array: `['MA','NH'].includes(formData.state)`.

---

## Checklist

- [x] `bulletin` table + RLS **already exist** in Supabase — no creation needed.
- [x] Row(s) with `active = true` and `plan` containing the project name already exist — no seeding needed.
- [ ] `PROJECT_PLAN` in `bulletinService.ts` set to the target project's tag (**not** `CarePlus`).
- [ ] `BulletinNotice` mounted at the top of the state-selection step.
- [ ] Gate matches your stored state format (`MA` vs `Massachusetts`).
- [ ] Target project actually allows MA enrollment.

---

## Files

| File | Role |
|------|------|
| `src/utils/bulletinService.ts` | Reads active bulletins for this project's plan tag. |
| `src/components/BulletinNotice.tsx` | Renders bulletins as info cards (or nothing). |
| `src/components/Step2AddressInfo.tsx` (or your step) | Mounts `<BulletinNotice />` gated on `state === 'MA'`. |
| `bulletin` table (Supabase) | **Pre-existing** shared source of bulletin content across projects (read-only here; `plan` already holds the project name). |
