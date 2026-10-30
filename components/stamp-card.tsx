"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Gift, Heart, Sparkles } from "lucide-react";
import { CuteButterfly, CuteKitten, RibbonBow } from "./cute-art";
import { memberCycle, stampFeedback } from "@/lib/loyalty";
import type { LoyaltyMember } from "@/lib/unified-types";

type Celebration = { kind: "stamp" | "reward"; total: number };

export default function StampCard({ member }: { member: LoyaltyMember }) {
  const previous = useRef({ id: member.id, total_stamps: member.total_stamps });
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  useEffect(() => {
    const kind = stampFeedback(previous.current, member);
    previous.current = { id: member.id, total_stamps: member.total_stamps };
    setCelebration(kind ? { kind, total: member.total_stamps } : null);
    if (!kind) return;
    const timer = setTimeout(() => setCelebration(null), 1900);
    return () => clearTimeout(timer);
  }, [member.id, member.total_stamps, member.program]);
  const target = member.program === "classic10" ? 10 : 8;
  const next = target === 8 && member.stamps < 4 ? 4 : target;
  const newStamp = celebration && member.stamps > 0 ? member.stamps - 1 : -1;
  return (
    <div className="miuu-stamp-card" data-celebration={celebration?.kind}>
      <RibbonBow className="miuu-card-bow" />
      <div className="miuu-stamp-heading">
        <div>
          <span className="miuu-eyebrow">a little thank-you, just for you</span>
          <h3>My little stamp card <Heart size={17} aria-hidden="true" /></h3>
        </div>
        <span className="hub-pill">{member.stamps}/{target} stamp</span>
      </div>
      <div className={"miuu-stamps " + (target === 8 ? "is-eight" : "")} role="group" aria-label={`Kartu stamp ${member.name}: ${member.stamps} dari ${target}`}>
        {Array.from({ length: target }, (_, i) => {
          const filled = i < member.stamps;
          const reward = i === target - 1 || (target === 8 && i === 3);
          return (
            <span key={`${i}-${newStamp === i ? celebration?.total : "rest"}`} className={(filled ? "is-stamped " : "") + (reward ? "is-reward " : "") + (newStamp === i ? "is-new" : "")} aria-label={`Stamp ${i + 1} ${filled ? "terkumpul" : "belum terkumpul"}${reward ? " · hadiah" : ""}`}>
              {filled ? (i % 2 ? <CuteButterfly className="miuu-stamp-art" /> : <CuteKitten className="miuu-stamp-art is-kitten" />) : reward ? <Gift className="miuu-stamp-gift" /> : <Heart className="miuu-stamp-empty" />}
              <small>{i + 1}{reward ? " ✦" : ""}</small>
            </span>
          );
        })}
      </div>
      <progress className="h-2 w-full accent-primary" value={member.stamps} max={target} aria-label="Progres stamp" />
      <div className="miuu-stamp-status" role="status" aria-live="polite">
        {celebration ? <span key={celebration.total} className="miuu-feedback-enter"><Sparkles size={15} aria-hidden="true" />{celebration.kind === "reward" ? "Yeay! Hadiah baru terbuka ♡" : "Stamp-mu bertambah. Little happy moment! ♡"}</span> : <span aria-hidden="true">one little stamp, one little smile ♡</span>}
      </div>
      <p className="hub-muted">
        {target === 8 ? <>
          <b>Siklus {memberCycle(member.total_stamps)} · total {member.total_stamps} stamp</b><br />
          {member.stamps === 8 ? "Kartu penuh! Hadiah gratis aplikasi tersedia di daftar reward. Stamp berikutnya memulai kartu baru." : `${next - member.stamps} stamp lagi menuju ${next === 4 ? "voucher diskon" : "gratis 1 aplikasi"}.`}<br />
          Transaksi Lunas minimal Rp15.000 = 1 stamp. Hadiah di stamp ke-4 dan ke-8.
        </> : <>
          <b>{10 - member.stamps} stamp lagi menuju voucher diskon 10% (maks. Rp15.000).</b><br />
          Satu pesanan selesai = satu stamp. Setiap 10 stamp, voucher terbit dan kartu dimulai kembali.
        </>}
      </p>
      {celebration && <div key={celebration.total} className="miuu-stamp-confetti" aria-hidden="true">
        {Array.from({ length: celebration.kind === "reward" ? 16 : 9 }, (_, i) => <i key={i} style={{ left: `${6 + (i * 23) % 88}%`, "--drift": `${(i % 5 - 2) * 24}px`, "--spin": `${(i % 2 ? 1 : -1) * 110}deg`, animationDelay: `${i % 4 * 45}ms` } as CSSProperties}>{["♡", "✦", "✿", "♡"][i % 4]}</i>)}
      </div>}
    </div>
  );
}
