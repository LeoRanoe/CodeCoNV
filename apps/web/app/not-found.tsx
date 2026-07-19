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
        <p className="eyebrow">404 · Page not found / Pagina niet gevonden</p>
        <h1 id="not-found-title">This page does not exist</h1>
        <p>Controleer het webadres of ga veilig terug naar de CODECO-werkruimte.</p>
        <div className="system-actions">
          <Link className="primary-button" href="/"><Home size={15} /> Back to CODECO / Terug naar CODECO</Link>
        </div>
      </section>
    </main>
  );
}
