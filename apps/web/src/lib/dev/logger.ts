// Logger global singleton: captura console.log/warn/error y errores
// sin pisar console multiples veces. Los componentes se suscriben via subscribe().

export type LogType = "log" | "warn" | "error";

export interface LogEntry {
  type: LogType;
  message: string;
  timestamp: string;
}

type Listener = (entry: LogEntry) => void;

const listeners = new Set<Listener>();
const buffer: LogEntry[] = [];
const MAX_BUFFER = 200;
let installed = false;
let originals: { log: typeof console.log; warn: typeof console.warn; error: typeof console.error } | null = null;

function stringifyArg(arg: unknown, depth = 0, seen = new WeakSet()): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") return String(arg);
  if (arg instanceof Date) return arg.toISOString();
  if (arg instanceof Blob || arg instanceof File) {
    return `[${arg instanceof File ? "File" : "Blob"} ${(arg as File).name ?? ""} size=${arg.size}]`;
  }
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "function") return "[function]";
  if (typeof arg !== "object") return String(arg);
  if (seen.has(arg)) return "[circular]";
  seen.add(arg);
  if (depth > 2) return "[object]";
  if (Array.isArray(arg)) {
    if (arg.length > 20) return `[Array(${arg.length})]`;
    return `[${arg.map((item) => stringifyArg(item, depth + 1, seen)).join(", ")}]`;
  }
  const entries = Object.entries(arg as Record<string, unknown>).slice(0, 20);
  const body = entries.map(([k, v]) => `${k}: ${stringifyArg(v, depth + 1, seen)}`).join(", ");
  return `{${body}${Object.keys(arg as Record<string, unknown>).length > 20 ? ", ..." : ""}}`;
}

function stringify(args: unknown[]): string {
  return args.map((arg) => stringifyArg(arg)).join(" ");
}

function emit(type: LogType, args: unknown[]) {
  const entry: LogEntry = {
    type,
    message: stringify(args),
    timestamp: new Date().toISOString(),
  };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  // Usar setTimeout para evitar setState durante render
  setTimeout(() => {
    listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // ignore listener errors
      }
    });
  }, 0);
}

export function installLogger() {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  const saved = originals;

  console.log = (...args: unknown[]) => {
    saved.log(...args);
    emit("log", args);
  };
  console.warn = (...args: unknown[]) => {
    saved.warn(...args);
    emit("warn", args);
  };
  console.error = (...args: unknown[]) => {
    saved.error(...args);
    emit("error", args);
  };

  const onError = (event: ErrorEvent) => {
    emit("error", ["Uncaught error", event.message, event.filename, `line ${event.lineno}`]);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    emit("error", ["Unhandled promise rejection", event.reason]);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  console.log("[DevLog] initialized");
}

export function subscribe(listener: Listener): () => void {
  // Enviar el buffer existente al nuevo listener
  for (const entry of buffer) {
    listener(entry);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBuffer(): LogEntry[] {
  return buffer;
}

