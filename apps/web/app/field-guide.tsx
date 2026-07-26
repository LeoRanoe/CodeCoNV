"use client";

import {
  Camera,
  CheckCircle2,
  CloudSun,
  HelpCircle,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

const guideStorageKey = "codeco-field-guide-seen-v1";

export function FieldGuide() {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(guideStorageKey) === "yes") return;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const close = () => {
    window.localStorage.setItem(guideStorageKey, "yes");
    setOpen(false);
  };

  const steps = [
    {
      icon: CloudSun,
      number: "01",
      title: text("Open the workday", "Open de werkdag"),
      copy: text("Weather and project context load automatically. Confirm only.", "Weer en projectcontext laden automatisch. Alleen bevestigen."),
    },
    {
      icon: Wrench,
      number: "02",
      title: text("Open the workspace", "Open de werkruimte"),
      copy: text("Choose photo, inspection, issue or drawing. The app opens only that task.", "Kies foto, inspectie, probleem of tekening. De app opent alleen die taak."),
    },
    {
      icon: CheckCircle2,
      number: "03",
      title: text("Tap the result", "Tik het resultaat"),
      copy: text("Approve a whole section or choose Yes, No or N/A per point.", "Keur een sectie ineens goed of kies Ja, Nee of N.v.t. per punt."),
    },
    {
      icon: Camera,
      number: "04",
      title: text("Stack the evidence", "Stapel het bewijs"),
      copy: text("Take several photos for one issue. Project, building and time are linked.", "Maak meerdere foto’s voor één probleem. Project, gebouw en tijd worden gekoppeld."),
    },
  ];

  return (
    <>
      <button className="field-guide-trigger" type="button" onClick={() => setOpen(true)} aria-label={text("Open quick guide", "Open korte gids")}>
        <HelpCircle size={18} />
        <span>{text("Quick guide", "Korte gids")}</span>
      </button>
      {open ? (
        <div className="field-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="field-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="field-guide-title">
            <header>
              <div><span>{text("60-second field guide", "60-seconden veldgids")}</span><h2 id="field-guide-title">{text("Four taps. The day is under control.", "Vier tikken. De dag is onder controle.")}</h2></div>
              <button type="button" onClick={close} aria-label={text("Close guide", "Sluit gids")}><X size={20} /></button>
            </header>
            <div className="field-guide-steps">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.number}>
                    <span className="field-guide-number">{step.number}</span>
                    <span className="field-guide-icon"><Icon size={24} /></span>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </article>
                );
              })}
            </div>
            <footer>
              <span>{text("Tip: the red camera button is always the fastest route to evidence.", "Tip: de rode cameraknop is altijd de snelste route naar bewijs.")}</span>
              <button className="primary-button" type="button" onClick={close}><CheckCircle2 size={16} /> {text("Ready to work", "Aan de slag")}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
