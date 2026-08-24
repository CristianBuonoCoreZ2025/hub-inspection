"use client";

import React from "react";
import { Mic, Square, Bold, Italic, List, ListOrdered, SpellCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { useFlash } from "@/components/ui/alert-context";

interface VoiceTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    isFinal: boolean;
    0: { transcript: string };
  }[];
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function VoiceTextarea({
  value,
  onChange,
  placeholder = "",
  rows = 5,
  className,
  disabled = false,
}: VoiceTextareaProps) {
  const flash = useFlash();
  const [isListening, setIsListening] = React.useState(false);
  const [spellCheck, setSpellCheck] = React.useState(true);
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const editorRef = React.useRef<HTMLDivElement>(null);
  const isInternalChangeRef = React.useRef(false);

  const isSupported = React.useMemo(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  // Sincronizar el contentEditable con value SOLO cuando el cambio viene de fuera
  React.useEffect(() => {
    if (editorRef.current && !isInternalChangeRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
    isInternalChangeRef.current = false;
  }, [value]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = editorRef.current?.innerHTML || "";
    if (finalText && !finalText.endsWith(" ")) finalText += " ";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      const html = finalText + interim;
      if (editorRef.current) editorRef.current.innerHTML = html;
      isInternalChangeRef.current = true;
      onChange(html);
    };

    recognition.onerror = (e: Event) => {
      const errEvent = e as SpeechRecognitionErrorEvent;
      if (errEvent.error === "not-allowed" || errEvent.error === "service-not-allowed") {
        flash({ description: "Permite el micrófono en el navegador para transcribir voz", type: "error", duration: 3000 });
      } else if (errEvent.error === "no-speech") {
        flash({ description: "No se detectó voz", type: "info", duration: 1500 });
      } else {
        flash({ description: "Error de reconocimiento de voz", type: "error", duration: 2000 });
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      isInternalChangeRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChangeRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+B negrilla, Ctrl+I cursiva
    if (e.ctrlKey && e.key === "b") { e.preventDefault(); exec("bold"); }
    if (e.ctrlKey && e.key === "i") { e.preventDefault(); exec("italic"); }
  };

  const toolBtn = "inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

  return (
    <div className="rounded-lg border border-input overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-input bg-muted/30">
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button type="button" className={toolBtn} onClick={() => exec("bold")} disabled={disabled}>
              <Bold className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Negrilla (Ctrl+B)</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button type="button" className={toolBtn} onClick={() => exec("italic")} disabled={disabled}>
              <Italic className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Cursiva (Ctrl+I)</p>
          </TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button type="button" className={toolBtn} onClick={() => exec("insertUnorderedList")} disabled={disabled}>
              <List className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Lista</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button type="button" className={toolBtn} onClick={() => exec("insertOrderedList")} disabled={disabled}>
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Lista numerada</p>
          </TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button
              type="button"
              className={cn(toolBtn, spellCheck && "text-emerald-500")}
              onClick={() => setSpellCheck(!spellCheck)}
              disabled={disabled}
            >
              <SpellCheck className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Corrección ortográfica</p>
          </TooltipContent>
        </Tooltip>
        {isSupported && !disabled && (
          <>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Tooltip>
              <TooltipTrigger className="inline-flex">
                <button
                  type="button"
                  className={cn(toolBtn, isListening && "bg-red-500 text-white animate-pulse hover:bg-red-500")}
                  onClick={isListening ? stopListening : startListening}
                  disabled={disabled}
                >
                  {isListening ? <Square className="h-3 w-3" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isListening ? "Detener" : "Transcribir voz"}</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
        {isListening && (
          <span className="text-[10px] text-red-500 font-medium animate-pulse ml-1">Escuchando...</span>
        )}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        spellCheck={spellCheck}
        data-placeholder={placeholder}
        className={cn(
          "px-3 py-2 text-[13px] leading-relaxed outline-none prose prose-sm max-w-none",
          "focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
          isListening && "ring-2 ring-red-400/50",
          className
        )}
        style={{ minHeight: `${rows * 24 + 16}px` }}
      />
    </div>
  );
}
