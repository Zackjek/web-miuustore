export function wibToday(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function addCalendarMonths(value: string, count: number) {
  if (!validDate(value) || !Number.isInteger(count))
    throw new Error("Tanggal atau jumlah bulan tidak valid.");
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + count, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}
export const dateDistance = (target: string, today = wibToday()) =>
  Math.round(
    (Date.parse(target + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
      86400000,
  );
export function canvaPhase(
  start: string,
  months: number,
  index: number,
  today = wibToday(),
) {
  const end = addCalendarMonths(start, months);
  const next = index < months ? addCalendarMonths(start, index) : null;
  const days = next ? dateDistance(next, today) : null;
  const phase =
    dateDistance(end, today) <= 0
      ? "ended"
      : days !== null && days <= 3
        ? "renew"
        : "active";
  return { end, next, days, phase };
}
export function whatsappNumber(value: string) {
  let number = value.replace(/\D/g, "");
  if (number.startsWith("0")) number = "62" + number.slice(1);
  else if (number.startsWith("8")) number = "62" + number;
  return /^\d{9,15}$/.test(number) ? number : "";
}
export const canvaMessage = (team: string, link: string) =>
  `‎⚘ .ᐟ  RENEWAL CANVA ↷\n‎👥 : ${team}\n‎𝘫𝘰𝘪𝘯 𝘮𝘦𝘯𝘨𝘨𝘶𝘯𝘢𝘬𝘢𝘯 𝘭𝘪𝘯𝘬 𝘥𝘪 𝘣𝘢𝘸𝘢𝘩 𝘪𝘯𝘪 ✓⃝\n${link}`;
