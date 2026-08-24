"use client";

import { useEffect } from "react";

/**
 * GlassCursorLight — hace que los paneles de glass reaccionen al cursor.
 * 1. Actualiza --mouse-x y --mouse-y en cada .glass-panel y .app-panel
 * 2. Crea efecto "gota de agua" (liquid ripple) al hacer clic
 * Ligero: un solo listener global + requestAnimationFrame.
 */
export function GlassCursorLight() {
  useEffect(() => {
    let activePanel: HTMLElement | null = null;
    let rafId = 0;

    const updatePanel = (panel: HTMLElement, x: number, y: number) => {
      const rect = panel.getBoundingClientRect();
      const localX = ((x - rect.left) / rect.width) * 100;
      const localY = ((y - rect.top) / rect.height) * 100;
      panel.style.setProperty("--mouse-x", `${localX.toFixed(2)}%`);
      panel.style.setProperty("--mouse-y", `${localY.toFixed(2)}%`);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const panel = target?.closest(".glass-panel, .app-panel, .dash-kpi-card") as HTMLElement | null;

      if (panel !== activePanel) {
        if (activePanel) {
          activePanel.style.removeProperty("--mouse-x");
          activePanel.style.removeProperty("--mouse-y");
        }
        activePanel = panel;
      }

      if (activePanel && rafId === 0) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          if (activePanel) updatePanel(activePanel, e.clientX, e.clientY);
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const panel = target?.closest(".glass-panel, .app-panel, .dash-kpi-card") as HTMLElement | null;
      const interactive = target?.closest("button, a, [role=button], [data-slot=select-trigger]");
      if (!panel || !interactive) return;

      const rect = panel.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "liquid-ripple";
      const size = 120;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      panel.appendChild(ripple);

      ripple.addEventListener("animationend", () => ripple.remove());
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("click", handleClick, { passive: true });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("click", handleClick);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
