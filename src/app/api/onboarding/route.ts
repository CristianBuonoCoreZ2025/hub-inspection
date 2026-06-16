import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyName, userId } = body;

  if (!companyName || !userId) {
    return NextResponse.json(
      { error: "companyName y userId son requeridos" },
      { status: 400 }
    );
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Crear empresa
    const slug = companyName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const companyResult = await client.query(
      `INSERT INTO companies (name, slug) VALUES ($1, $2) RETURNING id`,
      [companyName, slug]
    );
    const companyId = companyResult.rows[0].id;

    // Asignar empresa al perfil del usuario
    await client.query(
      `UPDATE profiles SET company_id = $1 WHERE user_id = $2`,
      [companyId, userId]
    );

    await client.end();

    return NextResponse.json({
      success: true,
      companyId,
      message: "Empresa creada y perfil actualizado",
    });
  } catch (err: any) {
    await client.end();
    logger.error("API onboarding failed", err, {
      component: "onboarding API",
      action: "POST /api/onboarding",
      metadata: {
        companyName,
        userId,
        pgErrorCode: err.code,
        pgErrorDetail: err.detail,
      },
    });
    return NextResponse.json(
      { error: err.message || "Error al crear empresa" },
      { status: 500 }
    );
  }
}
