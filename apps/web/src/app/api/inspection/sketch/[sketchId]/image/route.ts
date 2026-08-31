import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { downloadFromR2 } from "@/lib/storage/r2-upload";
import { r2PublicUrl } from "@/lib/storage/r2-client";

/**
 * GET /api/inspection/sketch/[sketchId]/image
 *
 * Proxy de imagen de croquis.
 * Descarga el archivo desde R2 server-side y lo sirve como same-origin,
 * evitando problemas de CORS al cargar croquis existentes en el editor.
 */
export const runtime = "nodejs";

function extractKeyFromUrl(url: string): string {
  if (url.startsWith(r2PublicUrl)) {
    return url.slice(r2PublicUrl.length).replace(/^\//, "");
  }
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}

function mimeFromUrl(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sketchId: string }> }
) {
  try {
    const { sketchId } = await params;
    if (!sketchId) {
      return NextResponse.json({ error: "Falta sketchId" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: sketch, error } = await admin
      .from("damage_sketches")
      .select("sketch_url")
      .eq("id", sketchId)
      .maybeSingle();

    if (error || !sketch?.sketch_url) {
      return NextResponse.json(
        { error: "Croquis no encontrado" },
        { status: 404 }
      );
    }

    const key = extractKeyFromUrl(sketch.sketch_url);
    const buffer = await downloadFromR2(key);
    const bytes = new Uint8Array(buffer);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": mimeFromUrl(sketch.sketch_url),
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo cargar la imagen" },
      { status: 500 }
    );
  }
}
