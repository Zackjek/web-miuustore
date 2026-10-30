import type { SVGProps } from "react";

export function RibbonBow(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 72 48" fill="none" aria-hidden="true" {...props}>
    <path d="M32 19C20 2 5 2 5 17S18 33 32 25M40 19C52 2 67 2 67 17S54 33 40 25" fill="currentColor" opacity=".8" />
    <path d="m31 25-8 17 12-5 3-12m4 0 8 17-12-5-3-12" fill="currentColor" opacity=".65" />
    <rect x="28" y="14" width="16" height="16" rx="6" fill="currentColor" />
    <path d="m12 12 13 7m35-7-13 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
  </svg>;
}

export function CuteButterfly(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
    <path d="M24 25C15 3 2 10 8 24c3 8 12 6 16 1Zm0 0C33 3 46 10 40 24c-3 8-12 6-16 1ZM24 25C11 23 9 38 18 37c4 0 6-7 6-12Zm0 0c13-2 15 13 6 12-4 0-6-7-6-12Z" fill="currentColor" opacity=".75" />
    <path d="M24 16v22m0-20-4-5m4 5 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

export function CuteKitten(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 260 270" fill="none" aria-hidden="true" {...props}>
    <ellipse cx="130" cy="245" rx="85" ry="12" fill="#7950b0" opacity=".1" />
    <path d="M187 203c48 12 55-29 31-35-21-5-23 19-11 21" stroke="#b49ad6" strokeWidth="17" strokeLinecap="round" />
    <path d="M70 193c-5 32 12 50 60 50s65-18 60-50l-13-54H83l-13 54Z" fill="#e8ddfa" stroke="#8b65b3" strokeWidth="3" />
    <path d="M69 105c-8-36-4-62 9-62 10 0 25 18 35 28h35c10-10 25-28 35-28 13 0 17 26 9 62 17 12 25 30 25 49 0 39-38 65-87 65s-87-26-87-65c0-19 9-37 26-49Z" fill="#fffaf5" stroke="#8b65b3" strokeWidth="3.5" strokeLinejoin="round" />
    <path d="m78 60 20 24-24 9m108-33-20 24 24 9" fill="#e8cce6" />
    <path d="M85 141c5-8 11-8 16 0m58 0c5-8 11-8 16 0" stroke="#604077" strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="78" cy="160" rx="14" ry="9" fill="#f3bfd6" opacity=".7" />
    <ellipse cx="182" cy="160" rx="14" ry="9" fill="#f3bfd6" opacity=".7" />
    <path d="m124 152 6 5 6-5" fill="#b881aa" stroke="#b881aa" strokeWidth="3" strokeLinejoin="round" />
    <path d="M130 158c0 10-13 13-17 4m17-4c0 10 13 13 17 4" stroke="#80597d" strokeWidth="2.5" strokeLinecap="round" />
    <path d="m57 149-19-4m19 14-20 3m166-13 19-4m-19 14 20 3" stroke="#b49ad6" strokeWidth="2.5" strokeLinecap="round" />
    <g transform="translate(160 73) rotate(16) scale(.72)"><path d="M0 0c-24-23-38-9-27 8C-20 20-8 15 0 8m4-8c24-23 38-9 27 8C24 20 12 15 4 8" fill="#a37acb" /><rect x="-4" y="-3" width="13" height="16" rx="5" fill="#8053ad" /></g>
    <path d="M104 224c-8-17 8-30 26-10 18-20 34-7 26 10-8 17-26 23-26 23s-18-6-26-23Z" fill="#a881cf" stroke="#8b65b3" strokeWidth="2.5" />
    <ellipse cx="91" cy="221" rx="14" ry="11" fill="#fffaf5" stroke="#8b65b3" strokeWidth="2.5" transform="rotate(20 91 221)" />
    <ellipse cx="169" cy="221" rx="14" ry="11" fill="#fffaf5" stroke="#8b65b3" strokeWidth="2.5" transform="rotate(-20 169 221)" />
    <path d="m123 212 6 4m10 5 3 3" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".6" />
  </svg>;
}
