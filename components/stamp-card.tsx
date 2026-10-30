import { Gift, Heart } from "lucide-react";
import { PixelCat } from "./public-shell";
import { memberCycle } from "@/lib/loyalty";
import type { LoyaltyMember } from "@/lib/unified-types";

function Butterfly({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 25C15 3 2 10 8 24c3 8 12 6 16 1Zm0 0C33 3 46 10 40 24c-3 8-12 6-16 1ZM24 25C11 23 9 38 18 37c4 0 6-7 6-12Zm0 0c13-2 15 13 6 12-4 0-6-7-6-12Z" fill="currentColor" opacity=".75" />
      <path d="M24 16v22m0-20-4-5m4 5 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function StampCard({ member }: { member: LoyaltyMember }) {
  const target = member.program === "classic10" ? 10 : 8;
  const next = target === 8 && member.stamps < 4 ? 4 : target;
  return (
    <div className="miuu-stamp-card">
      <div className="hub-row justify-between">
        <span className="miuu-eyebrow">meow & butterfly stamp card</span>
        <span className="hub-pill">{member.stamps}/{target} stamp</span>
      </div>
      <div className={"miuu-stamps " + (target === 8 ? "is-eight" : "")} role="group" aria-label={`Kartu stamp ${member.name}: ${member.stamps} dari ${target}`}>
        {Array.from({ length: target }, (_, i) => {
          const filled = i < member.stamps;
          const reward = i === target - 1 || (target === 8 && i === 3);
          return (
            <span key={i} className={(filled ? "is-stamped " : "") + (reward ? "is-reward" : "")} aria-label={`Stamp ${i + 1} ${filled ? "terkumpul" : "belum terkumpul"}${reward ? " · hadiah" : ""}`}>
              {filled ? (i % 2 ? <Butterfly className="miuu-stamp-art" /> : <PixelCat className="miuu-stamp-art" />) : reward ? <Gift className="miuu-stamp-gift" /> : <Heart className="miuu-stamp-empty" />}
              <small>{i + 1}{reward ? " ✦" : ""}</small>
            </span>
          );
        })}
      </div>
      <progress className="h-2 w-full accent-primary" value={member.stamps} max={target} aria-label="Progres stamp" />
      <p className="hub-muted mt-3" aria-live="polite">
        {target === 8 ? <>
          <b>Siklus {memberCycle(member.total_stamps)} · total {member.total_stamps} stamp</b><br />
          {member.stamps === 8 ? "Kartu penuh! Hadiah gratis aplikasi tersedia di daftar reward. Stamp berikutnya memulai kartu baru." : `${next - member.stamps} stamp lagi menuju ${next === 4 ? "voucher diskon" : "gratis 1 aplikasi"}.`}<br />
          Transaksi Lunas minimal Rp15.000 = 1 stamp. Hadiah di stamp ke-4 dan ke-8.
        </> : <>
          <b>{10 - member.stamps} stamp lagi menuju voucher diskon 10% (maks. Rp15.000).</b><br />
          Satu pesanan selesai = satu stamp. Setiap 10 stamp, voucher terbit dan kartu dimulai kembali.
        </>}
      </p>
    </div>
  );
}
