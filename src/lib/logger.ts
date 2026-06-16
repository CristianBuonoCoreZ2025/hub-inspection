/**
 * Logger centralizado para Hub Inspections.
 * Captura errores del frontend y backend con contexto.
 */

interface LogContext {
  userId?: string;
  email?: string;
  path?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

interface LogEntry {
  timestamp: string;
  level: "error" | "warn" | "info";
  message: string;
  stack?: string;
  context?: LogContext;
  source: "client" | "server";
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private push(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private createEntry(
    level: LogEntry["level"],
    message: string,
    error?: Error,
    context?: LogContext,
    source: LogEntry["source"] = typeof window === "undefined" ? "server" : "client"
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      stack: error?.stack,
      context: {
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
        ...context,
      },
      source,
    };
  }

  info(message: string, context?: LogContext) {
    const entry = this.createEntry("info", message, undefined, context);
    this.push(entry);
    console.info(`[Hub Inspections] ${message}`, context || "");
  }

  warn(message: string, context?: LogContext) {
    const entry = this.createEntry("warn", message, undefined, context);
    this.push(entry);
    console.warn(`[Hub Inspections] ${message}`, context || "");
  }

  error(message: string, error?: Error, context?: LogContext) {
    const entry = this.createEntry("error", message, error, context);
    this.push(entry);

    // Log en consola con formato claro
    console.error(`\n❌ [ERROR] ${message}`, {
      timestamp: entry.timestamp,
      stack: error?.stack,
      context: entry.context,
    });

    // En producción, enviar al servidor
    if (process.env.NODE_ENV === "production") {
      this.sendToServer(entry).catch(() => {
        // Silenciar errores de logging para evitar loops
      });
    }
  }

  async sendToServer(entry: LogEntry) {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch {
      // Ignorar fallos de red en logging
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getRecentErrors(limit = 20): LogEntry[] {
    return this.logs
      .filter((l) => l.level === "error")
      .slice(-limit);
  }

  clear() {
    this.logs = [];
  }

  // Helper para capturar errores de fetch/API
  async captureFetchError(
    response: Response,
    context?: LogContext
  ): Promise<string> {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "(no body)";
    }

    const message = `Fetch error ${response.status}: ${response.statusText}`;
    this.error(message, new Error(body), {
      ...context,
      metadata: {
        status: response.status,
        statusText: response.statusText,
        body,
        url: response.url,
      },
    });

    return body;
  }
}

export const logger = Logger.getInstance();
