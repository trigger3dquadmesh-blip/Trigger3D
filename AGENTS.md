# Trigger3D project instructions

- Use React with JavaScript and JSX; do not introduce TypeScript.
- Run the app with `npm run dev`.
- Run `npm run lint` and `npm run build` after code changes.
- Keep role-specific features under `src/features/admin`, `src/features/faculty`, and `src/features/student`.
- Keep Supabase access in `src/lib` and never commit credentials.
- Preserve the three roles: admin, faculty, and student.
- Student access to models requires an active class enrollment.
- Treat firearm imports as an atomic GLB + metadata CSV + questionnaire CSV operation.
- Add focused tests when behavior is introduced.
