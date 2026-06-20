# SSO (Microsoft Entra ID) — Setup Guide

VenU ships with OpenID Connect SSO **scaffolded and disabled**. The login,
callback, user-provisioning and the "Continue with Microsoft" button are all
built and unit-tested; turning it on is configuration only — no code changes.

> Status: implemented, **not yet verified against a live tenant** (needs UHAS
> IT to register the app). Everything degrades gracefully while disabled —
> email/password login is unaffected.

---

## 1. Register the app in Microsoft Entra ID (Azure AD)
UHAS IT does this once:

1. Entra admin centre → **App registrations → New registration**.
2. Name: `VenU`. Supported account types: *Accounts in this organizational directory only*.
3. **Redirect URI** (type *Web*):
   `https://<your-render-backend>/api/auth/oidc/callback/`
4. After creating, copy the **Application (client) ID** and **Directory (tenant) ID**.
5. **Certificates & secrets → New client secret** → copy the secret **value**.
6. **API permissions** → Microsoft Graph → delegated: `openid`, `email`, `profile` → Grant admin consent.

## 2. Set environment variables (Render)
```
OIDC_ENABLED=True
OIDC_CLIENT_ID=<application-client-id>
OIDC_CLIENT_SECRET=<client-secret-value>
OIDC_DISCOVERY_URL=https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration
OIDC_REDIRECT_URI=https://<your-render-backend>/api/auth/oidc/callback/
OIDC_LABEL=Microsoft
OIDC_DEFAULT_ROLE=STUDENT
```
Also confirm `FRONTEND_URL` is the Vercel URL (the callback redirects the user
back there with their tokens).

## 3. That's it
Once those vars are set and the service restarts:
- `GET /api/auth/oidc/status/` returns `{ "enabled": true }`.
- The login screen shows **Continue with Microsoft**.
- First-time SSO users are auto-provisioned: role comes from a matching
  **Allowed Domain** (Admin → Users → Enrollment) if present, else
  `OIDC_DEFAULT_ROLE`. Existing accounts are matched by email and never
  role-elevated automatically — promote staff/admins in Manage Users.

## How it works (for reviewers)
- Browser → `GET /api/auth/oidc/login/` → Authlib builds the authorization URL
  (state + nonce stored in the session) and redirects to Entra.
- Entra authenticates the user and redirects to `/api/auth/oidc/callback/`.
- Backend exchanges the code, validates the ID token, provisions the user,
  mints VenU JWTs, and redirects to `FRONTEND_URL/login?sso_access=…&sso_refresh=…`.
- The SPA stores the tokens and lands on the dashboard.

**Security notes:** SSO accounts get an unusable local password (can't be
brute-forced); the OIDC handshake is first-party to the API domain so the
session cookie used for state/nonce is safe; if SSO ever fails the user falls
back to email/password.

## Verifying after enabling
1. `curl https://<backend>/api/auth/oidc/status/` → `enabled: true`.
2. Open the app → click **Continue with Microsoft** → sign in → you should
   land on the dashboard.
3. Check the new user appears in Admin → Users with the expected role.
