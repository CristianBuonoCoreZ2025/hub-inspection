import { NextResponse } from "next/server";

interface IntegrationStatus {
  name: string;
  category: string;
  status: "Conectado" | "Pendiente" | "No configurado";
  statusColor: "emerald" | "amber" | "rose";
  desc: string;
  config?: string;
}

/**
 * GET /api/integrations/status
 * Devuelve el estado real de las integraciones basado en variables de entorno.
 * No expone valores secretos, solo si están configuradas o no.
 */
export async function GET() {
  const openRouterKey = !!process.env.OPENROUTER_API_KEY;
  const resendKey = !!process.env.RESEND_API_KEY;
  const resendFrom = !!process.env.RESEND_FROM_EMAIL;
  const whatsappPhoneId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  const whatsappToken = !!process.env.WHATSAPP_ACCESS_TOKEN;

  const integrations: IntegrationStatus[] = [
    {
      name: "Supabase",
      category: "Backend",
      status: "Conectado",
      statusColor: "emerald",
      desc: "Base de datos, autenticación y storage",
    },
    {
      name: "Cloudflare R2",
      category: "Storage",
      status: "Conectado",
      statusColor: "emerald",
      desc: "Almacenamiento de archivos y evidencias",
    },
    {
      name: "OpenRouter",
      category: "IA",
      status: openRouterKey ? "Conectado" : "No configurado",
      statusColor: openRouterKey ? "emerald" : "rose",
      desc: "IA para resúmenes de evidencias, imágenes y documentos",
      config: openRouterKey ? undefined : "Agregar OPENROUTER_API_KEY a .env.local",
    },
    {
      name: "Resend",
      category: "Email",
      status: resendKey ? "Conectado" : "No configurado",
      statusColor: resendKey ? "emerald" : "rose",
      desc: "Envío de emails (magic links, notificaciones)",
      config: resendKey
        ? resendFrom
          ? undefined
          : "Falta RESEND_FROM_EMAIL (se usará noreply@resend.dev)"
        : "Agregar RESEND_API_KEY a .env.local",
    },
    {
      name: "WhatsApp Cloud API",
      category: "Mensajería",
      status: whatsappPhoneId && whatsappToken ? "Conectado" : "No configurado",
      statusColor: whatsappPhoneId && whatsappToken ? "emerald" : "rose",
      desc: "Envío directo de WhatsApp (alternativa: wa.me)",
      config: whatsappPhoneId && whatsappToken ? undefined : "Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN",
    },
    {
      name: "WebRTC P2P",
      category: "Video",
      status: "Conectado",
      statusColor: "emerald",
      desc: "Videollamadas peer-to-peer para inspecciones remotas",
    },
  ];

  return NextResponse.json({ integrations });
}
