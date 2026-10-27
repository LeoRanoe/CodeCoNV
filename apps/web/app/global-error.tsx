"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="access-shell">
          <section className="access-card state-card" role="alert">
            <h1>Workspace unavailable / Werkruimte niet beschikbaar</h1>
            <p>De toepassing kon niet veilig worden geopend. Probeer opnieuw; niet-bevestigde invoer is niet als opgeslagen gemarkeerd.</p>
            <div className="system-actions">
              <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={reset}>Try again / Opnieuw proberen</button>
              <Link className="ui-button ui-button--quiet ui-button--md" href="/">CODECO home</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
