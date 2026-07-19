"use client";

import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const studio = document.querySelector<HTMLElement>(".studio");
    const nav = document.querySelector<HTMLElement>(".studio-nav-shell");
    const hero = document.querySelector<HTMLElement>(".studio-hero");
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    root.classList.add("studio-motion-ready");

    const revealAll = () => revealItems.forEach((item) => item.classList.add("is-visible"));

    if (reducedMotion.matches) {
      revealAll();
      return () => root.classList.remove("studio-motion-ready");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    revealItems.forEach((item) => observer.observe(item));

    let frame = 0;
    const updateScrollState = () => {
      frame = 0;
      const scrollY = window.scrollY;
      nav?.classList.toggle("is-scrolled", scrollY > 32);

      if (studio && hero && scrollY <= hero.offsetHeight) {
        const progress = Math.min(scrollY / hero.offsetHeight, 1);
        studio.style.setProperty("--studio-hero-shift", `${Math.round(progress * 54)}px`);
        studio.style.setProperty("--studio-hero-fade", `${1 - progress * 0.64}`);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScrollState);
    };

    updateScrollState();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      nav?.classList.remove("is-scrolled");
      studio?.style.removeProperty("--studio-hero-shift");
      studio?.style.removeProperty("--studio-hero-fade");
      root.classList.remove("studio-motion-ready");
    };
  }, []);

  return null;
}
