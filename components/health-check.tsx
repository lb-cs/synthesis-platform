"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type HealthState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; body: string }
  | { kind: "error"; message: string };

export function HealthCheck() {
  const [state, setState] = useState<HealthState>({ kind: "idle" });

  async function check() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/health");
      const body = await res.json();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setState({ kind: "ok", body: JSON.stringify(body, null, 2) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ kind: "error", message });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={check} disabled={state.kind === "loading"}>
        {state.kind === "loading" ? "Checking…" : "Call /api/health"}
      </Button>
      {state.kind === "ok" && (
        <pre className="rounded-md bg-muted p-4 font-mono text-sm">
          {state.body}
        </pre>
      )}
      {state.kind === "error" && (
        <p className="text-sm text-destructive">
          Request failed: {state.message}
        </p>
      )}
    </div>
  );
}
