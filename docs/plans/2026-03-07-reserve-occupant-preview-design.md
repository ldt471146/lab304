# Reservation Occupant Preview Design

## Goal

When a seat cannot be reserved because it is already occupied for the selected date, users should be able to click that seat, see who holds it, understand whether that person has checked in, and open the occupant photo in a larger mobile-friendly preview.

## Chosen Approach

Keep the current interaction model:

- Click an occupied seat in the reservation map.
- Show the existing occupant info card below the map.
- Upgrade the card with:
  - occupant status: `已签到` or `已预约，未签到`
  - clickable photo area
  - full-screen photo preview overlay

This preserves the current user flow and only adds the missing detail and preview affordance.

## Data Flow

For the selected reservation date:

1. Fetch active reservations with occupant profile fields.
2. Fetch active checkins for the same date where `checked_out_at is null`.
3. Merge both datasets by seat and user so each seat can expose:
   - `reserve_user`
   - `reserve_user_id`
   - `occupancy_status`
   - `occupiedTitle`

Rules:

- A seat with an active reservation remains clickable as an occupied seat.
- `occupancy_status` is `checked_in` only when the same reserved user also has an active checkin for that seat/date.
- Otherwise it is `reserved`.

## UI Changes

### Reservation Page

- Keep the existing occupied-seat info card.
- Replace the small static avatar with a clickable photo button.
- Add a short hint under the photo:
  - `点击查看个人照片大图`
  - fallback: `未上传个人照片，点击查看头像`
- Add a status row:
  - `当前状态：已签到`
  - or `当前状态：已预约，未签到`

### Full-Screen Preview

- Reuse the full-screen preview overlay pattern already used in admin user management.
- Support:
  - click photo to open
  - click overlay to close
  - close button
  - `Esc` to close
- On mobile, the image should use `object-fit: contain` and expand near full screen.

## Files

- `src/pages/ReservePage.jsx`
- `src/index.css`

## Verification

- Build the app with `npm run build`.
- In the reservation page:
  - click an occupied seat
  - verify occupant name and student info display
  - verify status text changes correctly
  - click the photo and confirm the full-screen preview opens on desktop and mobile layouts
