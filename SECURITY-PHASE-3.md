# Trigger3D Security Phase 3 Setup

The application code supports Cloudflare Turnstile CAPTCHA and stronger new-password rules. Complete the following Supabase and deployment settings before enabling CAPTCHA in production.

## 1. Create a Cloudflare Turnstile widget

1. In Cloudflare, create a Turnstile widget for the production Trigger3D domain.
2. Add `localhost` only while testing locally.
3. Copy the **site key** and **secret key**. Never place the secret key in the frontend or a `VITE_` environment variable.

## 2. Enable CAPTCHA in Supabase

1. Open **Supabase Dashboard → Authentication → Bot and Abuse Protection**.
2. Enable CAPTCHA protection and choose **Cloudflare Turnstile**.
3. Enter the Turnstile **secret key** and save.
4. Add the public site key to local `.env.local` and the Vercel project environment:

   `VITE_TURNSTILE_SITE_KEY=your-public-site-key`

5. Restart the local development server or redeploy Vercel.

Do not enable Supabase CAPTCHA until the site key has been deployed; otherwise, sign-in, registration, and password-reset requests will fail.

## 3. Strengthen password settings

In **Supabase Dashboard → Authentication → Sign In / Providers → Email**, configure:

- Minimum password length: **12**
- Required characters: lowercase, uppercase, number, and symbol
- Email confirmation: enabled for student self-registration
- Leaked-password protection: enable when the project plan supports it

Existing users can still sign in. The stronger rule applies when creating or changing a password.

## 4. Review authentication rate limits

Open **Authentication → Rate Limits**. Keep protections enabled for sign-in, registration, password reset, email verification, token refresh, and MFA challenges. Start with the Supabase defaults and lower limits only after observing normal school usage; limits that are too low may block a classroom signing in at the same time.

## 5. Enable MFA for privileged accounts

Require TOTP MFA for administrators first, then optionally faculty. MFA needs both an enrollment screen and a sign-in challenge screen before it can be enforced in the database. Do not enable mandatory MFA until those screens have been added and an administrator recovery process is documented.

## Verification checklist

- A login cannot be submitted until Turnstile succeeds.
- A failed login resets the CAPTCHA challenge.
- Student registration and password-reset requests include a CAPTCHA token.
- Existing users can still sign in with their current passwords.
- New and changed passwords require at least 12 characters, uppercase, lowercase, a number, and a symbol.
- Repeated authentication requests eventually receive a controlled rate-limit response instead of exposing internal details.
- No CAPTCHA secret appears in browser source, Git, `.env.local`, or Vercel variables beginning with `VITE_`.
