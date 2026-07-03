import { NextRequest, NextResponse } from "next/server";
import { adminGraphqlRequest } from "@/lib/nhost/admin-graphql";
import { logger } from "@/lib/logger";

/**
 * API route para que el cliente (magic link) envíe mensajes al chat.
 * Usa admin secret server-side para insertar el mensaje.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, senderName } = await request.json();
    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const mutation = `
      mutation SendChatMessage($object: inspection_chat_messages_insert_input!) {
        insert_inspection_chat_messages_one(object: $object) {
          id content sender_name sender_role created_at
        }
      }
    `;
    const data = await adminGraphqlRequest<{ insert_inspection_chat_messages_one: { id: string; content: string; sender_name: string; sender_role: string; created_at: string } }>(
      mutation,
      {
        object: {
          session_id: sessionId,
          content: message.trim(),
          sender_name: senderName || "Cliente",
          sender_role: "client",
        },
      }
    );

    return NextResponse.json({ message: data.insert_inspection_chat_messages_one });
  } catch (err) {
    logger.error("API /api/inspection/chat error", err as Error, {
      component: "inspection-chat-route",
      action: "send.message",
    });
    return NextResponse.json({ error: "No se pudo enviar el mensaje" }, { status: 500 });
  }
}
