"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Tap = { id: number; x: number; y: number };

export default function CuteInteractions() {
  const [taps, setTaps] = useState<Tap[]>([]);
  const sequence = useRef(0);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function respond(event: MouseEvent) {
      if (motion.matches || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>("button, a[href], [role='button']");
      if (!control || control.matches(":disabled, [aria-disabled='true']")) return;
      const rect = control.getBoundingClientRect();
      const id = ++sequence.current;
      setTaps((previous) => [...previous.slice(-3), {
        id, x: event.detail ? event.clientX : rect.left + rect.width / 2,
        y: event.detail ? event.clientY : rect.top + rect.height / 2,
      }]);
      const timer = setTimeout(() => {
        setTaps((previous) => previous.filter((tap) => tap.id !== id));
        timers.delete(timer);
      }, 850);
      timers.add(timer);
    }
    document.addEventListener("click", respond, true);
    return () => {
      document.removeEventListener("click", respond, true);
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);
  return <div className="miuu-click-feedback" aria-hidden="true">
    {taps.map((tap) => <span className="miuu-tap-burst" key={tap.id} style={{ left: tap.x, top: tap.y }}>
      {["♡", "✦", "♡", "✧", "✿"].map((symbol, index) => <i key={index} style={{
        "--dx": `${Math.cos(index * 1.26) * 33}px`,
        "--dy": `${Math.sin(index * 1.26) * 25 - 24}px`,
        "--turn": `${(index - 2) * 20}deg`,
        animationDelay: `${index * 15}ms`,
      } as CSSProperties}>{symbol}</i>)}
    </span>)}
  </div>;
}
