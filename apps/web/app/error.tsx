"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";

export default function ErrorScreen({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="access-shell">
      <section className="access-card state-card" role="alert" aria-labelledby="error-title">
        <div className="access-brand">
          <Image src="/codeco-logo.png" alt="CODECO Construction Designers & Consultants N.V." width={2651} height={1248} priority />
        </div>
        <span className="state-icon"><TriangleAlert size={26} /></span>
        <h1 id="error-title">Something went wrong / Er ging iets mis</h1>
        <p>Je gegevens zijn niet als opgeslagen gemarkeerd. Probeer opnieuw of ga terug naar de werkruimte.</p>
        <div className="system-actions">
          <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={reset}><RefreshCw size={15} /> Try again / Opnieuw</button>
          <Link className="ui-button ui-button--quiet ui-button--md" href="/"><Home size={15} /> CODECO home</Link>
        </div>
      </section>
    </main>
  );
}
