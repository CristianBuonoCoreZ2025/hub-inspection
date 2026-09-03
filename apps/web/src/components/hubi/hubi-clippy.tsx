"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { HubiMascot, type HubiState } from "./hubi-mascot";
import { X, Send } from "lucide-react";
import "./hubi-clippy.css";

interface HubiClippyProps {
  userRole?: string;
  userName?: string;
}

type ViewState = "hidden" | "greeting" | "thinking" | "answering";

const LOVE_WORDS = ["gracias", "gracias!", "muchas gracias", "te quiero", "me caes bien", "me encanta", "hermoso", "lindo", "precioso", "bonito", " adorable", "tierno", "te pasaste", "sos lo mejor", "bravo"];
const GRATEFUL_WORDS = ["muy bien", "excelente", "genial", "perfecto", "increíble", "muy util", "muy útil", "bien", "ok", "okk"];
const QUESTION_WORDS = ["?", "qué", "como", "cómo", "por que", "por qué", "porque", "cuando", "cuándo", "donde", "dónde", "cual", "cuál", "quien", "quién", "puedes", "podrias", "podrías", "como puedo", "cómo puedo", "necesito saber", "ayudame", "ayúdame", "explique", "explica"];
const CONFUSED_WORDS = ["no lo se", "no lo sé", "no estoy seguro", "no entiendo", "no tengo acceso", "no tengo informacion", "no tengo información", "no puedo", "no se", "no sé", "desconozco"];
const SURPRISED_WORDS = ["wow", "no puede ser", "en serio", "de verdad", "sorprendente", "impresionante", "qué raro", "qué extraño", "extraño", "error", "ups", "rayos", "maldicion", "maldición"];

// Respuestas locales para agradecimientos, cumplidos y saludos: sin gastar tokens de IA
function getLocalResponse(text: string, userName: string): { text: string; mood: HubiState } | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const firstName = userName.split(" ")[0] || "";
  const mentionName = firstName ? `, ${firstName}` : "";

  // Cumplidos o agradecimientos puros
  if (["gracias", "muchas gracias", "gracias!"].includes(t) || LOVE_WORDS.some(w => t.includes(w)) && !QUESTION_WORDS.some(w => t.includes(w))) {
    if (LOVE_WORDS.some(w => t.includes(w)) && !GRATEFUL_WORDS.includes(t) && !["gracias", "muchas gracias"].includes(t)) {
      // Cumplido, no pregunta
      return { text: `¡Gracias${mentionName}! Eres muy amable. Estoy aquí para ayudarte.`, mood: "love" };
    }
    return { text: `De nada${mentionName}. Estoy aquí para lo que necesites.`, mood: "love" };
  }

  // Solo aprobación positiva
  if (GRATEFUL_WORDS.some(w => t.includes(w)) && !QUESTION_WORDS.some(w => t.includes(w))) {
    return { text: `¡Perfecto${mentionName}! ¿Necesitas algo más?`, mood: "grateful" };
  }

  // Saludos
  if (["hola", "buenos dias", "buen dia", "buenas", "buenas tardes", "buenas noches", "hey", "hi"].includes(t)) {
    return { text: `¡Hola${mentionName}! ¿En qué puedo ayudarte?`, mood: "idle" };
  }

  // Despedidas
  if (["adios", "chao", "hasta luego", "nos vemos", "bye"].includes(t)) {
    return { text: `¡Hasta luego${mentionName}! Que tengas un buen día.`, mood: "idle" };
  }

  // No necesita nada
  if (["no gracias", "nada", "no", "nop", "todo bien"].includes(t)) {
    return { text: `Perfecto${mentionName}. Aquí estaré si me necesitas.`, mood: "idle" };
  }

  return null;
}

function detectMood(text: string, isUser: boolean): HubiState | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (LOVE_WORDS.some(w => t.includes(w))) return "love";
  if (GRATEFUL_WORDS.some(w => t.includes(w))) return "grateful";
  if (isUser) {
    if (QUESTION_WORDS.some(w => t.includes(w))) return "thinking";
  } else {
    if (CONFUSED_WORDS.some(w => t.includes(w))) return "confused";
  }
  if (SURPRISED_WORDS.some(w => t.includes(w))) return "surprised";
  return null;
}

const SALUTATIONS: Record<string, string> = {
  inspector: "Hola, soy Hubi. ¿En qué puedo ayudarte con tu inspección?",
  internal: "Hola, soy Hubi. Pregúntame lo que necesites del sistema.",
  auditor: "Hola, soy Hubi. ¿Qué caso necesitas revisar?",
  adjuster: "Hola, soy Hubi. ¿En qué puedo ayudarte con el siniestro?",
  assistant: "Hola, soy Hubi. ¿En qué puedo ayudarte?",
  dispatcher: "Hola, soy Hubi. ¿Necesitas agendar o consultar algo?",
};

function formatHubiResponse(text: string): string {
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^(\d+)\.\s+(.*$)/gim, "<li>$2</li>")
    .replace(/^\- (.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*?<\/li>\s*)+/g, (m) => `<ul>${m}</ul>`);
  return html.split(/\n\n+/).map((b) => {
    const t = b.trim();
    if (!t) return "";
    if (t.startsWith("<li>")) return `<ul>${t.match(/<li>.*?<\/li>/g)?.join("") || ""}</ul>`;
    return `<p>${t.replace(/\n/g, "<br/>")}</p>`;
  }).filter(Boolean).join("");
}

function getHiddenFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("hubi-robot-hidden") === "true"; } catch { return false; }
}

export function HubiClippy({ userRole = "inspector", userName = "" }: HubiClippyProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewState>("greeting");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [hubiState, setHubiState] = useState<HubiState>("idle");
  const [hidden, setHidden] = useState(getHiddenFromStorage);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const robotRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; active: boolean } | null>(null);
  const lastActivityRef = useRef<number>(0);
  const userMoodRef = useRef<HubiState | null>(null);

  // Posición SOLO via ref — React nunca controla el estilo del robot
  useLayoutEffect(() => {
    const el = robotRef.current;
    if (!el) return;
    let x = window.innerWidth - 132;
    let y = window.innerHeight - 132;
    try {
      const pos = localStorage.getItem("hubi-robot-pos-v2");
      if (pos) {
        const p = JSON.parse(pos);
        if (typeof p.x === "number" && typeof p.y === "number") {
          x = Math.min(Math.max(12, p.x), window.innerWidth - 124);
          y = Math.min(Math.max(12, p.y), window.innerHeight - 124);
        }
      }
    } catch {}
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  // Guardar estado oculto en localStorage
  useEffect(() => {
    try { localStorage.setItem("hubi-robot-hidden", String(hidden)); } catch {}
  }, [hidden]);

  // Auto-aparecer (no si está oculto)
  useEffect(() => {
    if (hidden) return;
    const t = setTimeout(() => {
      setOpen(true);
      setView("greeting");
      setHubiState("talking");
      setTimeout(() => setHubiState("idle"), 1200);
    }, 1500);
    return () => clearTimeout(t);
  }, [pathname, hidden]);

  // Focus input al abrir
  useEffect(() => {
    if (open && view === "greeting") {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [open, view]);

  // Teclado + evento custom para abrir desde el top-bar
  useEffect(() => {
    const openHubi = () => {
      if (hidden) setHidden(false);
      setOpen(true);
      setView("greeting");
      setHubiState("talking");
      setTimeout(() => setHubiState("idle"), 1200);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        openHubi();
      }
      if (e.key === "Escape") {
        setOpen(false);
        setHubiState("idle");
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("hubi-open", openHubi);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hubi-open", openHubi);
    };
  }, [hidden]);

  // Timer de inactividad: 1min -> sleepy, 3min -> charging
  useEffect(() => {
    lastActivityRef.current = Date.now();
    const tick = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      setHubiState((s) => {
        if (s === "charging") return s; // ya está al máximo de inactividad
        if (idleMs >= 3 * 60 * 1000) return "charging";
        if (idleMs >= 60 * 1000 && s !== "sleepy") return "sleepy";
        return s;
      });
    }, 5000);
    return () => clearInterval(tick);
  }, []);

  const bumpActivity = () => { lastActivityRef.current = Date.now(); };

  const toggleRobot = () => {
    bumpActivity();
    if (open) {
      setOpen(false);
      setHubiState("idle");
      return;
    }
    setOpen(true);
    setView("greeting");
    setHubiState("talking");
    setTimeout(() => setHubiState("idle"), 1200);
  };

  // Ref para que el drag siempre llame al toggle actual
  const toggleRef = useRef(toggleRobot);
  useEffect(() => { toggleRef.current = toggleRobot; });

  // Guardar posición en cada movimiento (sobrevive remounts)
  const savePos = (x: number, y: number) => {
    try { localStorage.setItem("hubi-robot-pos-v2", JSON.stringify({ x, y })); } catch {}
  };

  // ── DRAG: listeners nativos via addEventListener (no React synthetic events) ──
  // Esto evita cualquier interferencia del sistema de eventos de React.
  useEffect(() => {
    const el = robotRef.current;
    if (!el) return;

    const startDrag = (clientX: number, clientY: number) => {
      if (dragRef.current) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = { startX: clientX, startY: clientY, origX: rect.left, origY: rect.top, active: false };
      el.classList.add("hubi-robot-grabbed");
    };

    const onDragMove = (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      if (!drag.active && Math.hypot(dx, dy) > 4) {
        drag.active = true;
        el.classList.add("hubi-robot-dragging");
      }
      if (drag.active) {
        const x = Math.min(Math.max(12, drag.origX + dx), window.innerWidth - 124);
        const y = Math.min(Math.max(12, drag.origY + dy), window.innerHeight - 124);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        savePos(x, y);
      }
    };

    const endDrag = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      el.classList.remove("hubi-robot-grabbed", "hubi-robot-dragging");
      if (drag && !drag.active) toggleRef.current();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.clientX, e.clientY);
      const onMouseMove = (ev: MouseEvent) => { ev.preventDefault(); onDragMove(ev.clientX, ev.clientY); };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        endDrag();
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      startDrag(t.clientX, t.clientY);
      const onTouchMove = (ev: TouchEvent) => {
        ev.preventDefault();
        const tt = ev.touches[0];
        if (tt) onDragMove(tt.clientX, tt.clientY);
      };
      const onTouchEnd = () => {
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
        endDrag();
      };
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
    };

    // Listeners nativos con capture: true para interceptar ANTES que cualquier otro handler
    el.addEventListener("mousedown", onMouseDown, { capture: true });
    el.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });

    return () => {
      el.removeEventListener("mousedown", onMouseDown, { capture: true } as EventListenerOptions);
      el.removeEventListener("touchstart", onTouchStart, { capture: true } as EventListenerOptions);
    };
  }, []);

  const onRobotKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggleRobot();
  };

  const sendQuestion = useCallback(async (text: string) => {
    if (!text.trim()) return;
    bumpActivity();

    // Respuesta local para agradecimientos, cumplidos, saludos — sin gastar tokens
    const local = getLocalResponse(text, userName);
    if (local) {
      setHubiState(local.mood);
      setView("thinking");
      setAnswer("");
      await new Promise((resolve) => setTimeout(resolve, 600));
      setAnswer(local.text);
      setView("answering");
      setHubiState(local.mood);
      return;
    }

    const userMood = detectMood(text, true);
    userMoodRef.current = userMood;
    const keepUserMood = userMood === "love" || userMood === "grateful";
    if (userMood) setHubiState(userMood);
    else setHubiState("thinking");
    setView("thinking");
    setAnswer("");
    try {
      const res = await fetch("/api/hubi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), role: userRole, userName }),
      });
      if (!res.ok || !res.body) throw new Error("fail");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let contentAcc = "";
      let reasoningAcc = "";
      let hasContent = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const d = line.slice(6).trim();
          if (d === "[DONE]") continue;
          try {
            const p = JSON.parse(d);
            if (p.content) {
              contentAcc += p.content;
              hasContent = true;
              setAnswer(contentAcc);
              setView("answering");
              // Si el usuario fue cariñoso/agradecido, conservamos esa cara tierna
              if (!keepUserMood) setHubiState("talking");
            }
            if (p.reasoning) {
              reasoningAcc += p.reasoning;
            }
          } catch {}
        }
      }
      // Si el modelo solo devolvió reasoning (sin content), usar reasoning como respuesta.
      if (!hasContent && reasoningAcc) {
        setAnswer(reasoningAcc);
        setView("answering");
      }
      // Al terminar, detectar ánimo de la respuesta.
      // Si el usuario nos agradeció o halagó, mantenemos esa cara tierna.
      const finalAnswer = contentAcc || reasoningAcc;
      const answerMood = detectMood(finalAnswer, false);
      if (answerMood) {
        setHubiState(answerMood);
      } else if (userMoodRef.current === "love" || userMoodRef.current === "grateful") {
        setHubiState(userMoodRef.current);
      }
    } catch {
      setAnswer("Ups, problema de conexión. Intenta de nuevo.");
      setHubiState("error");
      setView("answering");
    }
  }, [userRole, userName]);

  const salutation = (userName ? `Hola ${userName.split(" ")[0]}, ` : "Hola, ") + (SALUTATIONS[userRole] || SALUTATIONS.inspector).replace(/^Hola, /, "");

  const handleSend = () => {
    if (!question.trim()) return;
    bumpActivity();
    sendQuestion(question);
    setQuestion("");
  };

  return (
    <>
      {/* Robot — listeners nativos via useEffect, sin React synthetic events */}
      <div
        ref={robotRef}
        className={`hubi-robot-fixed ${hidden ? "hubi-robot-hidden" : ""}`}
        onKeyDown={onRobotKeyDown}
        onDragStart={(e) => e.preventDefault()}
        role="button"
        tabIndex={0}
        aria-label="Hubi"
        draggable={false}
      >
        <HubiMascot state={open ? hubiState : "idle"} size={100} />
      </div>

      {/* Panel de chat — separado del robot, fixed */}
      {open && (
        <div className="hubi-panel">
          <div className="hubi-panel-header">
            <span className="hubi-panel-title">
              {view === "thinking" ? "Pensando..." : "Hubi"}
            </span>
            <button
              className="hubi-panel-close"
              onClick={() => { setOpen(false); setHidden(true); setHubiState("idle"); try { localStorage.setItem("hubi-robot-hidden", "true"); } catch {} }}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="hubi-panel-body">
            {view === "greeting" && !answer && (
              <p className="hubi-panel-salute">{salutation}</p>
            )}

            {view === "answering" && (
              <div
                className="hubi-panel-answer"
                dangerouslySetInnerHTML={{ __html: formatHubiResponse(answer) }}
              />
            )}

            {view === "thinking" && (
              <div className="hubi-panel-thinking">
                <span className="hubi-thinking-dot" />
                <span>Procesando...</span>
              </div>
            )}
          </div>

          <div className="hubi-panel-input-row">
            <textarea
              ref={inputRef}
              value={question}
              onFocus={bumpActivity}
              onChange={(e) => { bumpActivity(); setQuestion(e.target.value); }}
              onKeyDown={(e) => {
                bumpActivity();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe tu pregunta..."
              rows={1}
              className="hubi-panel-input"
            />
            <button
              onClick={handleSend}
              disabled={!question.trim()}
              className="hubi-panel-send"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

    </>
  );
}
