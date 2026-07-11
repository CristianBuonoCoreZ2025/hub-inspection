import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * API route para que el cliente (magic link) envíe mensajes al chat.
 * Usa service role key server-side para insertar el mensaje.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, senderName } = await request.json();
    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: msg, error } = await supabase
      .from("inspection_chat_messages")
      .insert({
        session_id: sessionId,
        content: message.trim(),
        sender_name: senderName || "Cliente",
        sender_role: "client",
      })
      .select("id, content, sender_name, sender_role, created_at")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: msg });
  } catch (err) {
    logger.error("API /api/inspection/chat error", err as Error, {
      component: "inspection-chat-route",
      action: "send.message",
    });
    return NextResponse.json({ error: "No se pudo enviar el mensaje" }, { status: 500 });
  }
}
