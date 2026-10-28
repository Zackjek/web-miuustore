"use client";
import { useRef, useState } from "react";
import { authFetch } from "@/lib/browser-auth";
import { Button } from "../ui/button";
type Summary = {
  orders: number;
  canva: number;
  missingCosts: number;
  refunds: number;
  note: string;
};
export default function ImportOrders({
  reload,
}: {
  reload: () => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null),
    fileData = useRef<unknown>(null);
  const [summary, setSummary] = useState<Summary | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function call(preview: boolean) {
    const response = await authFetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: fileData.current,
        preview,
        confirm: !preview,
      }),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error || "Backup belum dapat diproses.");
    return body;
  }
  async function inspect(file: File) {
    setBusy(true);
    setMessage("");
    setSummary(null);
    try {
      if (file.size > 5_242_880) throw new Error("Backup maksimal 5 MB.");
      fileData.current = JSON.parse(await file.text());
      setSummary(await call(true));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Backup tidak valid.");
      fileData.current = null;
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setMessage("");
    try {
      const body = await call(false);
      await reload();
      setMessage(
        `Impor selesai: ${body.result.imported} order ditambahkan, ${body.result.skipped} dilewati karena sudah ada.`,
      );
      setSummary(null);
      fileData.current = null;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Impor belum berhasil.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="hub-card">
      <h2 className="hub-title">Pindahkan order lama</h2>
      <p className="hub-muted mb-4">
        Pilih backup JSON dari Miuu Page atau backup order Miuu Store. Data dari
        domain lain tidak berpindah otomatis.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        ref={fileInput}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void inspect(file);
          e.currentTarget.value = "";
        }}
      />
      {summary && (
        <div className="mt-5 rounded-xl border border-border p-4">
          <p className="font-semibold">
            Pratinjau: {summary.orders} order + {summary.canva} order Canva
          </p>
          <p className="hub-muted mt-2">{summary.note}</p>
          {summary.missingCosts > 0 && (
            <p className="hub-muted mt-2">
              Backup ini tidak mencatat modal. Modal {summary.missingCosts}{" "}
              order akan bernilai 0; lengkapi sebelum memakai laporan profit.
            </p>
          )}
          {summary.refunds > 0 && (
            <p className="hub-muted mt-2">
              Ada {summary.refunds} order berstatus Refund tanpa nominal refund.
              Periksa nominalnya setelah impor.
            </p>
          )}
          <div className="hub-actions">
            <button disabled={busy} onClick={() => void apply()}>
              Konfirmasi impor
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setSummary(null);
                fileData.current = null;
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}
      {busy && (
        <p className="hub-muted mt-3" role="status">
          Memproses backup…
        </p>
      )}
      {message && (
        <p className="hub-error" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
