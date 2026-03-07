## Goal

Close the client-side data tampering hole that allows authenticated users to modify protected study statistics in `public.users`, and correct the known corrupted record for `侯宗阳`.

## Current Risk

- The frontend talks to Supabase directly with the publishable/anon key.
- `public.users` has an RLS update policy `users_update_own` that allows a user to update their own row.
- Protected stats such as `total_minutes`, `points`, and `checkin_count` are normal updatable columns on that same row.
- As a result, any logged-in user can bypass the UI and update those fields from the browser console or a crafted API request.

## Approaches Considered

### 1. Frontend-only validation

Reject this. It does not change the actual trust boundary and does not stop direct API calls.

### 2. Database-side hardening on top of the current direct-access model

Recommended.

- Keep the current direct client access model for safe self-editable fields.
- Harden existing triggers and policies so protected fields are overwritten or blocked at the database layer.
- Keep protected stats writable only from trusted database logic such as `checkout_checkin`.
- Fix the known corrupted user totals in the same migration.

### 3. Full backend proxy

Secure but too large for the problem. It would require replacing direct Supabase table writes across the app.

## Chosen Design

### Database changes

- Strengthen the existing `users` triggers so client-side inserts and updates cannot set or mutate:
  - `total_minutes`
  - `points`
  - `checkin_count`
  - approval/admin fields
  - restriction fields
- Strengthen the existing `checkins` insert trigger so client-side inserts cannot spoof:
  - `checked_at`
  - `checked_out_at`
  - `check_date`
- Remove direct client `update/delete` access on `checkins`.
- Add an ownership check inside `checkout_checkin` so a user can only check out their own open record.
- Keep `checkout_checkin` as the trusted path that updates `total_minutes` and `points`.
- Correct `侯宗阳` to `600` minutes. Also normalize his points to a sane value in the same repair step so leaderboard integrity is restored.

### Frontend changes

- No UI behavior change is required if the database hardening preserves the currently supported safe fields.
- The app should continue to edit normal profile fields as before, while forged stat writes are ignored or blocked at the database layer.

### Data repair

- Update `侯宗阳` (`student_id = 2024124151`) to `total_minutes = 600`.
- Reset his `points` to match the corrected totals instead of leaving the forged million-point value in place.

## Error Handling

- RPCs return standard Supabase/PostgREST errors to the existing UI.
- Unauthorized direct table updates will fail at the database layer even if someone bypasses the frontend.

## Verification

- Confirm no authenticated user can directly update `public.users.total_minutes` or `public.users.points`.
- Confirm no authenticated user can directly alter `public.checkins.checked_at` or `checked_out_at`.
- Confirm normal profile edits still work from the app.
- Confirm avatar and ID photo updates still work.
- Confirm `侯宗阳` now shows `10` hours and a corrected point total.
