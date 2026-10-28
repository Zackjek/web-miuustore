"use client";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/browser-auth";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="hub-field">
      {label}
      {children}
    </label>
  );
}
export function useHub(reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(
    data: Record<string, unknown>,
    method = "POST",
    message = "Tersimpan",
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await authFetch("/api/hub", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Perubahan gagal disimpan.");
      await reload();
      toast.success(message);
      return true;
    } catch (e) {
      const text = e instanceof Error ? e.message : "Perubahan gagal disimpan.";
      setError(text);
      toast.error(text);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error };
}
export function ImageUpload({
  value,
  onChange,
  label = "Foto produk",
  onBusy,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onBusy?: (busy: boolean) => void;
}) {
  const id = useId(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true);
    onBusy?.(true);
    setError("");
    try {
      if (file.size > 5242880) throw new Error("Gambar maksimal 5 MB.");
      const form = new FormData();
      form.append("file", file);
      const response = await authFetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Gambar belum terunggah.");
      onChange(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gambar gagal diunggah.");
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <div className="my-4">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {value && (
        <img
          src={value}
          alt="Pratinjau unggahan"
          width={80}
          height={80}
          className="mb-3 size-20 rounded-xl border border-border object-cover"
        />
      )}
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={busy}
        className="max-w-full text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.currentTarget.value = "";
        }}
      />
      {value && (
        <button
          type="button"
          className="ml-3 min-h-10 text-sm text-primary underline"
          onClick={() => onChange("")}
        >
          Hapus foto dari produk
        </button>
      )}
      <p className="hub-muted mt-2">
        {busy
          ? "Mengunggah gambar…"
          : "PNG, JPG, WebP, atau GIF · maksimal 5 MB."}
      </p>
      {error && (
        <p role="alert" className="hub-error">
          {error}
        </p>
      )}
    </div>
  );
}
