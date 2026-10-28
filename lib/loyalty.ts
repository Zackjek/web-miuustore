import type { Voucher } from "./unified-types";
import { dateDistance } from "./date-tools";
export const rewardState = (v: Voucher) =>
  v.status === "revoked"
    ? "revoked"
    : v.status === "expired"
      ? "expired"
      : v.status === "used" || v.used_at
        ? "used"
        : v.expires_at && dateDistance(v.expires_at) < 0
          ? "expired"
          : "available";
export const rewardStateText = {
  available: "Tersedia",
  used: "Terpakai",
  expired: "Kedaluwarsa",
  revoked: "Ditarik",
};
export const memberCycle = (total: number) =>
  total > 0 ? Math.floor((total - 1) / 8) + 1 : 1;
