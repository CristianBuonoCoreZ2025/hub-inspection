import { graphqlRequest } from "@/lib/nhost/graphql";
import type { InspectionChatMessage } from "@/types";

const CHAT_FIELDS = `
  id
  session_id
  sender_id
  sender_name
  sender_role
  content
  created_at
`;

export async function getChatMessages(sessionId: string) {
  const query = `
    query GetChatMessages($sessionId: uuid!) {
      inspection_chat_messages(
        where: { session_id: { _eq: $sessionId } }
        order_by: { created_at: asc }
      ) {
        ${CHAT_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{
    inspection_chat_messages: InspectionChatMessage[];
  }>(query, { sessionId });
  return data.inspection_chat_messages;
}

export async function sendChatMessage(
  sessionId: string,
  content: string,
  senderId?: string | null,
  senderName?: string | null,
  senderRole?: string | null
) {
  const mutation = `
    mutation SendChatMessage($object: inspection_chat_messages_insert_input!) {
      insert_inspection_chat_messages_one(object: $object) {
        ${CHAT_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{
    insert_inspection_chat_messages_one: InspectionChatMessage;
  }>(mutation, {
    object: {
      session_id: sessionId,
      content,
      sender_id: senderId || null,
      sender_name: senderName || null,
      sender_role: senderRole || null,
    },
  });
  return data.insert_inspection_chat_messages_one;
}

export async function deleteChatMessage(id: string) {
  const mutation = `
    mutation DeleteChatMessage($id: uuid!) {
      delete_inspection_chat_messages_by_pk(id: $id) { id }
    }
  `;
  await graphqlRequest(mutation, { id });
}
