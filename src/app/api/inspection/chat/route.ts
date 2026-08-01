import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * API route para que el cliente (magic link) envíe mensajes al chat.
 * Usa service role key server-side para insertar el mensaje.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sessionId = searchParams.get("sessionId");
    const token = searchParams.get("token");

    if (!sessionId || !token) {
      return NextResponse.json({ error: "Faltan sessionId o token" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: session } = await supabase
      .from("inspection_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("magic_link_token", token)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: messages, error } = await supabase
      .from("inspection_chat_messages")
      .select("id, content, sender_name, sender_role, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ messages: messages || [] });
  } catch (err) {
    logger.error("API /api/inspection/chat error", err as Error, {
      component: "inspection-chat-route",
      action: "get.messages",
    });
    return NextResponse.json({ error: "No se pudieron cargar los mensajes" }, { status: 500 });
  }
}

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
