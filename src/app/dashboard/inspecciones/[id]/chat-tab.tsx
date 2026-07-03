"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChatMessages, sendChatMessage } from "@/services/chat";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Send, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatTab({ sessionId, compact = false }: { sessionId: string; compact?: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: () => getChatMessages(sessionId),
    refetchInterval: 3000, // Refrescar cada 3 segundos (tiempo real)
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      sendChatMessage(
        sessionId,
        message.trim(),
        user?.id || null,
        user?.email || "Usuario",
        undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", sessionId] });
      setMessage("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    sendMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className={compact ? "" : "app-panel"}>
        <p className="text-sm text-muted-foreground">Cargando mensajes...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? "h-full" : "app-panel"}`} style={{ minHeight: compact ? "100%" : "400px" }}>
      {!compact && (
        <h3 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Chat de Inspección
        </h3>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: compact ? "calc(100vh - 220px)" : "400px" }}>
        {messages && messages.length > 0 ? (
          messages.map((msg) => {
            const isCurrentUser = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isCurrentUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] ${
                    isCurrentUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-semibold opacity-80">
                      {msg.sender_name || "Usuario"}
                    </span>
                    {msg.sender_role && (
                      <span className="text-[10px] opacity-60">
                        ({msg.sender_role})
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      isCurrentUser ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2" />
            <p className="text-sm">No hay mensajes aún.</p>
            <p className="text-xs">Sé el primero en escribir.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="app-input h-10 flex-1"
          disabled={sendMutation.isPending}
        />
        <Button
          type="submit"
          size="sm"
          className="btn-save btn-footer shrink-0"
          disabled={sendMutation.isPending || !message.trim()}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Enviar
        </Button>
      </form>
    </div>
  );
}
