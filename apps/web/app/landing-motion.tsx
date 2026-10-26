"use client";

import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".studio-nav-shell");
    const updateNavigation = () => nav?.classList.toggle("is-scrolled", window.scrollY > 32);

    updateNavigation();
    window.addEventListener("scroll", updateNavigation, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateNavigation);
      nav?.classList.remove("is-scrolled");
    };
  }, []);

  return null;
}
