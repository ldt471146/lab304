## Goal

Allow administrators to inspect user photos clearly, especially on mobile, without changing the upload pipeline.

## Current Issue

- The admin user-detail modal only shows a small thumbnail-sized image.
- On phones, the modal space is too limited for identity verification.
- The problem is display size and interaction, not image storage.

## Chosen Design

- Keep the existing admin detail modal.
- Make the displayed user photo clickable.
- Open a dedicated full-screen preview overlay when the admin taps the photo.
- Use `object-fit: contain` so the whole photo remains visible on desktop and mobile.
- Add a close control plus overlay-click dismissal.

## Scope

- Update the admin user-detail modal in `src/pages/AdminUsersPage.jsx`.
- Add preview and responsive styles in `src/index.css`.

## Verification

- Admins can tap a user photo to open a larger preview.
- The preview is readable on mobile screens.
- Closing the preview returns to the user-detail modal cleanly.
