import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="access-shell">
      <section className="access-card state-card" aria-labelledby="not-found-title">
        <div className="access-brand">
          <Image src="/codeco-logo.png" alt="CODECO Construction Designers & Consultants N.V." width={738} height={291} priority />
        </div>
        <span className="state-icon"><SearchX size={26} /></span>
        <h1 id="not-found-title">This page does not exist</h1>
        <p>404 · Page not found / Pagina niet gevonden</p>
        <p>Controleer het webadres of ga terug naar de CODECO-homepage.</p>
        <div className="system-actions">
          <Link className="ui-button ui-button--primary ui-button--md" href="/"><Home size={15} /> Back to CODECO / Terug naar CODECO</Link>
        </div>
      </section>
    </main>
  );
}
