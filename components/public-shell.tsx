"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Moon, Sun, ArrowUpRight, LogIn } from "lucide-react";
import { MiuuCat } from "./miuu-cat";
export function PixelCat({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path d="M3 3h5v3h8V3h5v15h-3v3H6v-3H3V3Z" fill="currentColor" />
      <path d="M5 5h2v3h10V5h2v11h-3v3H8v-3H5V5Z" fill="#e9dafa" />
      <path d="M7 11h2v3H7zm8 0h2v3h-2zm-4 5h2v2h-2z" fill="#4a2d69" />
      <path d="M5 14h3v2H5zm11 0h3v2h-3z" fill="#f7b6d2" />
    </svg>
  );
}
export function PixelBunny({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 28"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path fill="currentColor" d="M3 1h6v10h6V1h6v19h-3v5H6v-5H3z" />
      <path fill="#f9e7f0" d="M5 3h2v10h10V3h2v15h-3v5H8v-5H5z" />
      <path fill="#4a2d69" d="M7 15h2v3H7zm8 0h2v3h-2zm-4 5h2v2h-2z" />
    </svg>
  );
}
export function PublicShell({
  children,
  active = "catalog",
  shopName = "Miuu Store",
  logo = "",
}: {
  children: ReactNode;
  active?: "catalog" | "loyalty" | "tracking";
  shopName?: string;
  logo?: string;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem("ruang-order-theme") === "dark";
      setDark(value);
      document.documentElement.classList.toggle("dark", value);
    } catch {}
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ruang-order-theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <div className="miuu-public soft-bg min-h-screen">
      <a href="#public-content" className="miuu-skip">
        Lewati ke konten
      </a>
      <header className="miuu-public-header">
        <div className="miuu-public-bar">
          <Link
            href="/"
            className="miuu-public-brand"
            aria-label={shopName + " — beranda"}
          >
            {logo ? (
              <img
                src={logo}
                width={42}
                height={42}
                alt=""
                className="rounded-xl object-cover"
              />
            ) : (
              <MiuuCat className="size-10" />
            )}
            <span>
              {shopName}
              <small>little order studio</small>
            </span>
          </Link>
          <nav aria-label="Menu utama" className="miuu-public-nav">
            <Link
              href="/"
              aria-current={active === "catalog" ? "page" : undefined}
            >
              Pricelist
            </Link>
            <Link
              href="/cek"
              aria-current={active === "tracking" ? "page" : undefined}
            >
              Cek pesanan
            </Link>
            <Link
              href="/loyalty"
              aria-current={active === "loyalty" ? "page" : undefined}
            >
              Loyalty club
            </Link>
            <Link href="/admin/dashboard" className="miuu-admin-entry">
              <LogIn size={16} aria-hidden="true" />
              Login Admin
            </Link>
          </nav>
          <button
            type="button"
            className="miuu-theme"
            onClick={toggle}
            aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <main id="public-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="miuu-public-footer">
        <span>Made with a little love ♡ · {shopName}</span>
        <Link href="/admin/dashboard">
          Ruang pengelola <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
