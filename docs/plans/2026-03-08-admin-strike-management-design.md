# Admin Strike Management Design

## Goal

Add an admin-only ability to set a user's reservation strike count to any non-negative integer, and automatically remove reservation restrictions when the updated strike count falls below the configured threshold. At the same time, seat occupancy previews should expose personal photo URLs only to admins, while ordinary users see avatars only.

## Chosen Approach

Use a database RPC plus small admin UI changes.

- Database handles all strike updates and restriction clearing logic.
- Frontend only calls the RPC and refreshes local state.
- Reservation page fetches occupant photo fields based on the current viewer role.

This keeps permission checks and business rules in the database instead of relying on client-side updates.

## Data and Permission Rules

### Strike Management

Create `public.admin_set_user_reservation_strikes(target_user_id uuid, p_reservation_strikes integer)`.

Behavior:

- Caller must be an admin.
- Non-super-admins cannot modify super-admin accounts.
- Strike count is clamped to a non-negative integer.
- The function reads `strike_threshold` from `reservation_rules`.
- If the new strike count is below the threshold:
  - clear `reservation_restricted_until`
- If the new strike count is at or above the threshold:
  - keep the current restriction value as-is

This avoids accidentally extending restrictions while still letting admins unrestrict a user by lowering their strike count.

### Seat Photo Visibility

Reservation page occupant queries should be role-aware:

- Admin viewer:
  - fetch `avatar_url`
  - fetch `id_photo_url`
- Ordinary viewer:
  - fetch only `avatar_url`

UI logic should prefer:

- admin: `id_photo_url` then `avatar_url`
- ordinary user: `avatar_url` only

## UI Changes

### Admin User List

- Add a new action button for strike editing.
- Open a small modal with:
  - target user summary
  - numeric input
  - current restriction date
- On save:
  - call the admin RPC
  - update list data in place
  - update the open profile modal if it is showing the same user

### Reservation Page

- Keep the existing occupied-seat info card.
- Change occupant photo source based on `profile.is_admin`.
- Keep the existing full-screen preview interaction.

## Files

- `supabase/migrations/...`
- `src/pages/AdminUsersPage.jsx`
- `src/pages/ReservePage.jsx`
- `src/index.css`

## Verification

- Build with `npm run build`
- In admin user management:
  - edit a user's strike count
  - verify the list updates immediately
  - verify restriction date clears when strikes drop below the threshold
- In reservation page:
  - ordinary account sees avatar only
  - admin account sees personal photo when available
