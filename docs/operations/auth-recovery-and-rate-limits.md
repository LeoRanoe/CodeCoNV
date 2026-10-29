# Password recovery, redirect addresses and sign-in limits

Local development reads `supabase/config.toml`. The hosted Supabase project does **not**: everything
below marked "hosted" is a setting somebody with dashboard access has to make by hand. Nothing here
was changed on the hosted project.

## Local (done in the repository)

| Setting | Value | Why |
| --- | --- | --- |
| `auth.additional_redirect_urls` | production, `http://localhost:3000`, `http://127.0.0.1:3000` | The app asks for `redirectTo: ${origin}/supervisie`. Without the local origins the recovery link fell back to the production site (QA sweep M15). |
| `auth.email.template.recovery` | Dutch subject and `supabase/templates/recovery.html` | The recovery mail was the English default. |
| `auth.rate_limit.sign_in_sign_ups` | 20 per 5 minutes per address | Eight wrong passwords in 15 seconds were all answered; after this limit the screen says "Te veel aanmeldpogingen. Wacht een paar minuten" (already in the app). |

Read the local mail in Mailpit: <http://127.0.0.1:54324>.

## Hosted project (manual)

1. Authentication → URL configuration: add the production address as *Site URL* and every address the
   app is served from (preview deployments you want recovery to work on) under *Redirect URLs*.
2. Authentication → Emails → *Reset password*: subject `Wachtwoord herstellen · CODECO Supervisie`;
   paste the body of `supabase/templates/recovery.html`. The link variable is `{{ .ConfirmationURL }}`.
3. Authentication → Emails → SMTP settings: set a sender name and address that people recognise
   (the default sender is Supabase's own address).
4. Authentication → Rate limits: set "Sign-ins and sign-ups" to a value you accept (the local value is 20
   per 5 minutes per address). The hosted default differs and was not read.
5. Check one recovery mail end to end on a test account: link opens the app, "Kies een nieuw wachtwoord"
   appears, the second use of the same link shows "Deze link is verlopen of al gebruikt".

## Not tested

The recovery flow was not run end to end against Mailpit in this pass (the Playwright tests cover the
form errors and the expired-link message only).
