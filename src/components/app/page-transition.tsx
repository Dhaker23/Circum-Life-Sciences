"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Subtle fade-in on route change (150ms).
 * Respects prefers-reduced-motion (no animation if user prefers reduced motion).
 * CSS-only — no JS state, no hydration mismatch risk.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    main.classList.remove("animate-page-fade");
    // Force reflow to restart the animation
    void main.offsetWidth;
    main.classList.add("animate-page-fade");
  }, [pathname]);

  return (
    <>
      <style>{`
        @keyframes page-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-page-fade {
          animation: page-fade 150ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-page-fade {
            animation: none;
          }
        }
      `}</style>
      <main ref={mainRef} id="main-content" className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6">
        {children}
      </main>
    </>
  );
}
