import type { SVGProps } from "react";

export function MiuuCat(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
    <path d="M11 26 9 6l16 11a28 28 0 0 1 14 0L55 6l-2 20c4 5 6 11 6 17 0 12-12 19-27 19S5 55 5 43c0-6 2-12 6-17Z" fill="var(--primary)"/>
    <path d="m15 13 2 11-6 2Zm34 0-2 11 6 2Z" fill="var(--cat-blush)"/>
    <path d="M20 38c2-3 6-3 8 0m8 0c2-3 6-3 8 0" stroke="var(--primary-foreground)" strokeWidth="2.8" strokeLinecap="round"/>
    <path d="m29 43 3 2 3-2-3-2Z" fill="var(--primary-foreground)"/>
    <path d="M32 45v3m0 0c-2 2-4 2-6 0m6 0c2 2 4 2 6 0" stroke="var(--primary-foreground)" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="16" cy="45" r="3.5" fill="var(--cat-blush)"/><circle cx="48" cy="45" r="3.5" fill="var(--cat-blush)"/>
    <path d="M9 46 1 44m9 6-7 2m52-6 8-2m-9 6 7 2" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}