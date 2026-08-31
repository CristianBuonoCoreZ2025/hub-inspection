"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Terminal, X, Download } from "lucide-react";
import { installLogger, subscribe, type LogEntry } from "@/lib/dev/logger";

export function DevLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [newErrors, setNewErrors] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    installLogger();
    const unsubscribe = subscribe((entry) => {
      setLogs((prev) => [...prev, entry].slice(-200));
      if (entry.type === "error" || entry.type === "warn") {
        setNewErrors((n) => n + 1);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, open]);

  const download = useCallback(() => {
    const text = logs
      .map((entry) => `[${entry.timestamp}] [${entry.type.toUpperCase()}] ${entry.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hub-inspection-dev-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [logs]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setNewErrors(0);
        }}
        className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="Abrir log de desarrollo"
      >
        <Terminal className="h-5 w-5" />
        {newErrors > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
            {newErrors}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 max-h-[60vh] flex flex-col app-panel">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="app-panel-title">Dev log ({logs.length})</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={download} aria-label="Descargar log">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Cerrar log">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 min-h-45 max-h-[50vh]">
        {logs.map((entry, index) => (
          <div
            key={index}
            className={`app-body wrap-break-word whitespace-pre-wrap ${
              entry.type === "error" ? "text-destructive" : entry.type === "warn" ? "text-amber-500" : ""
            }`}
          >
            {entry.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
