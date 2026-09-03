"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { HubiMascot, type HubiState } from "./hubi-mascot";
import { X, Send, Loader2 } from "lucide-react";
import "./hubi-widget.css";

interface HubiMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface HubiWidgetProps {
  userRole?: string;
  userName?: string;
}

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  inspector: [
    "¿Cómo completo el acta de inspección?",
    "¿Cómo funciona la app móvil offline?",
    "¿Cómo firmo una inspección?",
  ],
  internal: [
    "¿Cómo creo un inspector?",
    "¿Cómo configuro el menú de navegación?",
    "¿Cómo genero una nómina de facturación?",
    "¿Cómo reasigno inspecciones?",
  ],
  auditor: [
    "¿Cómo exporto inspecciones a Excel?",
    "¿Cómo veo el detalle de un siniestro?",
  ],
  adjuster: [
    "¿Cómo subo imágenes a un siniestro?",
    "¿Cómo veo la agenda?",
  ],
  assistant: [
    "¿Cómo subo imágenes a un siniestro?",
    "¿Cómo veo el detalle de un caso?",
  ],
  dispatcher: [
    "¿Cómo agendo una inspección?",
    "¿Cómo exporto inspecciones?",
  ],
};

export function HubiWidget({ userRole = "inspector", userName = "" }: HubiWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<HubiMessage[]>([]);
  const [input, setInput] = useState("");
  const [hubiState, setHubiState] = useState<HubiState>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = SUGGESTIONS_BY_ROLE[userRole] || SUGGESTIONS_BY_ROLE.inspector;

  // Scroll al final cuando hay mensajes nuevos
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Saludo inicial — se calcula cuando se abre por primera vez
  const handleOpen = () => {
    setIsOpen(true);
    if (!hasGreeted) {
      setHasGreeted(true);
      setMessages([{ role: "assistant", content: getGreeting(userRole, userName), timestamp: Date.now() }]);
    }
  };

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: HubiMessage = { role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setHubiState("thinking");

    // Placeholder para el stream del asistente
    const assistantMsg: HubiMessage = { role: "assistant", content: "", timestamp: Date.now() };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/hubi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), role: userRole, userName }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulated = "";
        let firstChunk = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  if (firstChunk) {
                    firstChunk = false;
                    setHubiState("talking");
                  }
                  accumulated += parsed.content;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: accumulated,
                      timestamp: Date.now(),
                    };
                    return updated;
                  });
                }
              } catch {
                // Si no es JSON, es texto plano del stream
                if (firstChunk) {
                  firstChunk = false;
                  setHubiState("talking");
                }
                accumulated += line;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: accumulated,
                    timestamp: Date.now(),
                  };
                  return updated;
                });
              }
            }
          }
        }
      }

      setHubiState("idle");
    } catch {
      setHubiState("error");
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Lo siento, tuve un problema técnico. Intenta de nuevo en un momento.",
          timestamp: Date.now(),
        };
        return updated;
      });
      setTimeout(() => setHubiState("idle"), 2000);
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, userRole, userName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* FAB — botón flotante */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="hubi-fab"
          aria-label="Abrir asistente Hubi"
        >
          <div className="hubi-fab-mascot">
            <HubiMascot state="idle" size={44} />
          </div>
          <span className="hubi-fab-pulse" />
          <span className="hubi-fab-badge" />
        </button>
      )}

      {/* Panel de chat */}
      {isOpen && (
        <div className="hubi-panel">
          {/* Header */}
          <div className="hubi-panel-header">
            <div className="hubi-panel-header-left">
              <div className="hubi-panel-avatar">
                <HubiMascot state={hubiState} size={28} />
              </div>
              <div className="hubi-panel-titles">
                <span className="hubi-panel-name">Hubi</span>
                <span className="hubi-panel-status">
                  {hubiState === "thinking" ? "Pensando..." :
                   hubiState === "talking" ? "Respondiendo" :
                   hubiState === "error" ? "Error" :
                   "En línea"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hubi-panel-close"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="hubi-panel-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`hubi-msg hubi-msg-${msg.role}`}>
                {msg.role === "assistant" && (
                  <div className="hubi-msg-avatar">
                    <HubiMascot state={msg.content ? "idle" : "thinking"} size={20} />
                  </div>
                )}
                <div className="hubi-msg-bubble">
                  {msg.role === "assistant" && msg.content ? (
                    <div dangerouslySetInnerHTML={{ __html: formatHubiResponse(msg.content) }} />
                  ) : (
                    msg.content || (
                      <span className="hubi-msg-typing">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}

            {/* Sugerencias (solo si hay 1 mensaje — el saludo) */}
            {messages.length === 1 && !isStreaming && (
              <div className="hubi-suggestions">
                <span className="hubi-suggestions-label">Sugerencias</span>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="hubi-suggestion-chip"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="hubi-panel-input">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              rows={1}
              disabled={isStreaming}
              className="hubi-input"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="hubi-send-btn"
              aria-label="Enviar"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function getGreeting(role: string, name: string): string {
  const firstName = name.split(" ")[0] || "";
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";

  const roleContext: Record<string, string> = {
    inspector: "soy Hubi, tu asistente de inspección. Te ayudo con actas, croquis, evidencias, firmas y la app móvil.",
    internal: "soy Hubi, tu asistente. Tienes acceso completo al sistema. Pregúntame sobre usuarios, operaciones, nóminas, catálogos o configuración.",
    auditor: "soy Hubi, tu asistente de revisión. Te ayudo a consultar casos, exportar datos y navegar el sistema.",
    adjuster: "soy Hubi, tu asistente. Te ayudo con siniestros, imágenes, agenda y consultas.",
    assistant: "soy Hubi, tu asistente. Te ayudo con siniestros, imágenes y consultas del día a día.",
    dispatcher: "soy Hubi, tu asistente. Te ayudo con inspecciones, agenda, informes y consultas.",
  };

  return `${greeting} ${roleContext[role] || roleContext.inspector}`;
}

function formatHubiResponse(text: string): string {
  // Convierte markdown básico a HTML
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^\d+\.\s+(.*$)/gim, "<li>$1</li>")
    .replace(/^\- (.*$)/gim, "<li>$1</li>");

  // Agrupa <li> consecutivos en <ul>
  html = html.replace(/(<li>.*?<\/li>\s*)+/g, (match) => `<ul>${match}</ul>`);

  // Envuelve en párrafos si no es lista/título
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<ol") || trimmed.startsWith("<li")) {
        // Agrupa items <li> consecutivos en <ul>
        if (trimmed.includes("<li>")) {
          return `<ul>${trimmed.match(/<li>.*?<\/li>/g)?.join("") || ""}</ul>`;
        }
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .filter(Boolean)
    .join("");

  return html;
}
