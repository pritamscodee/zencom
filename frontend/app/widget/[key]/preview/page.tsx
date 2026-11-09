"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "@/lib/config";

/** A throwaway "customer website" that loads the real embed script, for testing the widget end to end. */
export default function WidgetPreview() {
  const { key } = useParams<{ key: string }>();

  useEffect(() => {
    const s = document.createElement("script");
    s.src = `${API_URL}/widget.js`;
    s.async = true;
    s.setAttribute("data-zencom-key", key);
    document.body.appendChild(s);
    return () => {
      s.remove();
      document.getElementById("zencom-launcher")?.remove();
      document.getElementById("zencom-frame")?.remove();
      (window as Window & { __zencomLoaded?: boolean }).__zencomLoaded = false;
    };
  }, [key]);

  return (
    <div className="min-h-dvh bg-[#f7f5f2]">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Widget preview</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">This is a sample customer website.</h1>
        <p className="mt-4 text-neutral-600">
          The chat launcher in the corner is the real Zencom widget, loaded with the same script tag your customers would install. Send a message and watch
          it arrive in your inbox.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {["Shipping", "Returns", "Sizing"].map((t) => (
            <div key={t} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="font-medium">{t}</div>
              <div className="mt-1 text-sm text-neutral-500">Ask the assistant about our {t.toLowerCase()} policy.</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
