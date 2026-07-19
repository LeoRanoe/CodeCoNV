"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const links = [
  ["Work", "#work"],
  ["About", "#about"],
  ["Services", "#services"],
  ["Contact", "#contact"],
];

export function LandingNavigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : previousOverflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <header className={`studio-nav-shell ${open ? "open" : ""}`}>
      <div className="studio-nav">
        <a className="studio-logo" href="#top" aria-label="CODECO home" onClick={() => setOpen(false)}>
          <Image src="/codeco-logo.png" alt="CODECO Construction Designers & Consultants N.V." width={738} height={291} priority />
        </a>
        <nav className="studio-desktop-nav" aria-label="Main navigation">
          {links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
        </nav>
        <a className="studio-nav-cta" href="mailto:info@codeconv.com">Start a project <span aria-hidden="true">↗</span></a>
        <button
          className="studio-menu-button"
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="studio-mobile-nav"
          onClick={() => setOpen((current) => !current)}
        >
          <span /><span />
        </button>
      </div>

      <div className="studio-mobile-overlay" id="studio-mobile-nav" aria-hidden={!open} inert={!open}>
        <nav aria-label="Mobile navigation">
          {links.map(([label, href], index) => (
            <a href={href} key={href} onClick={() => setOpen(false)}>
              <span>0{index + 1}</span>{label}<i aria-hidden="true">→</i>
            </a>
          ))}
        </nav>
        <div className="studio-mobile-contact">
          <p>Kwattaweg 717E · Paramaribo</p>
          <a href="mailto:info@codeconv.com">info@codeconv.com</a>
          <a href="tel:+5978554345">+597 855-4345</a>
        </div>
      </div>
    </header>
  );
}
