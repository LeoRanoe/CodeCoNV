# CODECO private Google Drive gateway

Deze Cloudflare Worker is de enige laag die Google OAuth en Drive-file-ID's gebruikt. De browser krijgt nooit Google access- of refresh tokens en Drive-mappen blijven privé.

Benodigde secrets:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` en `SUPABASE_SECRET_KEY`;
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` en de refresh token van het dedicated CODECO-account met uitsluitend `drive.file`;
- `GOOGLE_ROOT_FOLDER_ID` van de private applicatiemap;
- `UPLOAD_SESSION_SECRET`, minimaal 32 cryptografisch willekeurige bytes.

De gateway valideert ieder gebruikers-JWT via Supabase, laat RLS project- en bestandsrechten bepalen, reserveert alleen pending metadata namens de gebruiker en laat uitsluitend de serversecret een geslaagde Drive-upload afronden. Uploadchunks zijn veelvouden van 256 KiB, behalve de laatste chunk. De ondertekende sessietoken verloopt na 60 minuten.

Zonder deze secrets mag de Worker niet worden gepubliceerd. Eerst lokaal bouwen met `npm run build`, daarna secrets via `wrangler secret put` plaatsen en pas dan deployen.

Vervang voor deployment de fail-closed `APP_ORIGIN`-placeholder in `wrangler.jsonc` door het definitieve HTTPS-origin van de CODECO-webapp op Vercel. Een preview- of oud Sites-domein hoort niet in de productieconfiguratie.
