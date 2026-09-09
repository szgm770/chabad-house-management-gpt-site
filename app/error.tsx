"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[v0] app error boundary:", error);
  }, [error]);

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: "26rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "3.5rem",
            height: "3.5rem",
            borderRadius: "9999px",
            background: "var(--muted, #f1f5f9)",
            color: "var(--destructive, #dc2626)",
          }}
        >
          <AlertTriangle />
        </span>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          משהו השתבש בטעינת העמוד
        </h1>
        <p style={{ margin: 0, lineHeight: 1.6, opacity: 0.75 }}>
          אירעה תקלה זמנית. אפשר לנסות לטעון מחדש — נשארת מחובר/ת למערכת.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Button onClick={() => reset()}>
            <RefreshCw />
            נסה שוב
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            חזרה ללוח הבקרה
          </Button>
        </div>
      </div>
    </main>
  );
}
