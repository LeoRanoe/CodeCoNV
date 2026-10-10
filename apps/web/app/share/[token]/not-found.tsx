import { AlertTriangle } from "lucide-react";

export default function ExternalShareNotFound() {
  return (
    <main className="external-share-shell">
      <section className="external-share-card external-share-unavailable">
        <span className="external-share-brand">CODECO N.V. · SUPERVISIE</span>
        <AlertTriangle size={42} />
        <h1>Deze gedeelde link is niet meer beschikbaar</h1>
        <p>De link is verlopen, ingetrokken of niet volledig gekopieerd. Vraag de CODECO-toezichthouder om vanuit het werkpunt een nieuwe link te maken.</p>
      </section>
    </main>
  );
}
