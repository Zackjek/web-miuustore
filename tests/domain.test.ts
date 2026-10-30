import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupVariants,
  parseVariants,
  minimumPrice,
  netflixTemplate,
} from "../lib/catalog";
import {
  addCalendarMonths,
  canvaPhase,
  whatsappNumber,
  wibToday,
  validDate,
} from "../lib/date-tools";
import { normalizeBackup } from "../lib/import-backup";
test("arbitrary package groups preserve admin order and ungrouped variants", () => {
  const groups = groupVariants(
    parseVariants(
      "Family Premium | 1 bulan = 10.000\nFamily Premium | 3 bulan = 25000\nLifetime = 75000\nPrivate | 1 tahun = 100000",
    ),
  );
  assert.deepEqual(
    groups.map((g) => g.name),
    ["Family Premium", "", "Private"],
  );
  assert.equal(groups[0].rows[0].price, 10000);
  assert.equal(groups[1].rows[0].label, "Lifetime");
});
test("malformed, negative, ambiguous decimal, and duplicate prices are rejected", () => {
  for (const line of [
    "Private | = 4000",
    "A = -1",
    "A = 4,5",
    "A = NaN",
    "A = 1\na = 2",
  ])
    assert.throws(() => parseVariants(line));
});
test("Netflix prices match supplied requirements", () => {
  assert.equal(
    netflixTemplate.variants.find((v) => v.label === "Semiprivate | 1 bulan")
      ?.price,
    45000,
  );
  assert.equal(netflixTemplate.variants.length, 13);
});
test("single and multi-price products sort on actual retail price", () => {
  assert.equal(minimumPrice({ price: 1000 }), 1000);
  assert.equal(
    minimumPrice({
      price: 0,
      variants: [
        { label: "A", price: 3000 },
        { label: "B", price: 4000 },
      ],
    }),
    3000,
  );
});
test("calendar month arithmetic handles month-end and leap year", () => {
  assert.equal(addCalendarMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addCalendarMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addCalendarMonths("2026-01-31", 2), "2026-03-31");
  assert.equal(validDate("2026-02-30"), false);
});
test("Canva becomes renewal due at H-3, remains due until invite, and ends on end date", () => {
  assert.equal(canvaPhase("2026-01-31", 3, 1, "2026-02-25").phase, "renew");
  assert.equal(canvaPhase("2026-01-31", 3, 1, "2026-03-02").phase, "renew");
  assert.equal(canvaPhase("2026-01-31", 3, 2, "2026-03-02").phase, "active");
  assert.equal(canvaPhase("2026-01-31", 3, 3, "2026-04-30").phase, "ended");
});
test("WIB dates do not switch to the previous UTC day", () =>
  assert.equal(wibToday(new Date("2026-10-27T18:00:00Z")), "2026-10-28"));
test("Indonesian WhatsApp numbers are normalized without creating malformed links", () => {
  assert.equal(whatsappNumber("0812-3456-7890"), "6281234567890");
  assert.equal(whatsappNumber("81234567890"), "6281234567890");
  assert.equal(whatsappNumber("123"), "");
});
test("legacy Miuu Page payment statuses and WIB timestamps survive import", () => {
  const value = normalizeBackup({
    app: "miuu-page",
    orders: [
      {
        id: 1,
        app: "Netflix",
        jenis: "Sharing",
        cust: "081234567890",
        tglOrder: "2026-10-28T08:30",
        tglHabis: "2026-11-28T08:30",
        harga: 15000,
        bayar: "lunas",
      },
    ],
  });
  assert.equal(value.rows[0].payment_status, "Lunas");
  assert.equal(value.rows[0].order_at, "2026-10-28T01:30:00.000Z");
  assert.equal(value.rows[0].cost, 0);
  assert.equal(value.summary.missingCosts, 1);
});
test("damaged backups and duplicate legacy identifiers are rejected before import", () => {
  const entry = {
    id: 1,
    app: "Canva",
    cust: "081234567890",
    tglOrder: "2026-10-28",
    harga: 15000,
    bayar: "lunas",
  };
  assert.throws(() =>
    normalizeBackup({ app: "miuu-page", orders: [entry, entry] }),
  );
  assert.throws(() =>
    normalizeBackup({
      app: "miuu-page",
      orders: [{ ...entry, tglOrder: "2026-02-30" }],
    }),
  );
});


test("stamp feedback celebrates a confirmed increase and the correct reward milestones", async () => {
  const { stampFeedback } = await import("../lib/loyalty");
  const before = { id: "miuu-member", total_stamps: 3 };
  const current = { id: "miuu-member", total_stamps: 4, program: "miuu8" as const };
  assert.equal(stampFeedback(before, current), "reward");
  assert.equal(stampFeedback({ ...before, total_stamps: 7 }, { ...current, total_stamps: 8 }), "reward");
  assert.equal(stampFeedback({ ...before, total_stamps: 8 }, { ...current, total_stamps: 9 }), "stamp");
  assert.equal(stampFeedback({ ...before, total_stamps: 9 }, { ...current, total_stamps: 10, program: "classic10" }), "reward");
  assert.equal(stampFeedback(before, { ...current, program: "classic10" }), "stamp");
});
test("refreshing, switching members, and retracting stamps never show a success celebration", async () => {
  const { stampFeedback } = await import("../lib/loyalty");
  const before = { id: "miuu-member", total_stamps: 4 };
  const current = { id: "miuu-member", total_stamps: 4, program: "miuu8" as const };
  assert.equal(stampFeedback(before, current), null);
  assert.equal(stampFeedback(before, { ...current, total_stamps: 3 }), null);
  assert.equal(stampFeedback(before, { ...current, id: "another-member", total_stamps: 20 }), null);
});
