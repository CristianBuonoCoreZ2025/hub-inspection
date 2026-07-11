import { fetchAll, insertRow, deleteRow } from "@/lib/supabase/db";
import type { InspectionChatMessage } from "@/types";

const CHAT_FIELDS =
  "id, session_id, sender_id, sender_name, sender_role, content, created_at";

export async function getChatMessages(sessionId: string) {
  return fetchAll<InspectionChatMessage>("inspection_chat_messages", {
    select: CHAT_FIELDS,
    eq: { session_id: sessionId },
    order: { column: "created_at", ascending: true },
  });
}

export async function sendChatMessage(
  sessionId: string,
  content: string,
  senderId?: string | null,
  senderName?: string | null,
  senderRole?: string | null
) {
  return insertRow<InspectionChatMessage>(
    "inspection_chat_messages",
    {
      session_id: sessionId,
      content,
      sender_id: senderId || null,
      sender_name: senderName || null,
      sender_role: senderRole || null,
    },
    CHAT_FIELDS
  );
}

export async function deleteChatMessage(id: string) {
  await deleteRow("inspection_chat_messages", id);
}
