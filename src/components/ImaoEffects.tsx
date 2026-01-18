"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ImaoEffects() {
  const pathname = usePathname();

  useEffect(() => {
    const cursorGlow = document.getElementById("cursorGlow") as HTMLElement | null;
    const scrollIndicator = document.getElementById("scrollIndicator") as HTMLElement | null;

    const onMove = (e: MouseEvent) => {
      if (!cursorGlow) return;
      cursorGlow.style.left = e.clientX + "px";
      cursorGlow.style.top = e.clientY + "px";
    };
    document.addEventListener("mousemove", onMove);

    const revealSelector =
      ".section-header, .feature-card, .benefit-card, .benefit-item, .cta-title, .cta-description, .cta-buttons, .content-card, .quick-nav-item";

    const onScroll = () => {
      if (scrollIndicator) {
        const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        scrollIndicator.style.width = scrolled + "%";
      }
    };
    window.addEventListener("scroll", onScroll);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((ent) => {
          if (ent.isIntersecting) (ent.target as HTMLElement).classList.add("animate");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    );

    const observeTargets = () => {
      document.querySelectorAll(revealSelector).forEach((el) => observer.observe(el));
    };

    observeTargets();
    const observeTimer = window.setTimeout(observeTargets, 200);

    // quick nav delay (피클 페이지 느낌 그대로)
    const quick = Array.from(document.querySelectorAll(".quick-nav-item"));
    quick.forEach((el, i) => {
      setTimeout(() => (el as HTMLElement).classList.add("animate"), i * 100);
    });

    // smooth hash scroll (피클 #섹션 이동)
    const onHashClick = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#")) return;

      e.preventDefault();
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      const headerOffset = 100;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    };

    const hashLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
    hashLinks.forEach((a) => a.addEventListener("click", onHashClick));

    // 초기 1회
    onScroll();

    return () => {
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      window.clearTimeout(observeTimer);
      hashLinks.forEach((a) => a.removeEventListener("click", onHashClick));
    };
  }, [pathname]);

  return null;
}
