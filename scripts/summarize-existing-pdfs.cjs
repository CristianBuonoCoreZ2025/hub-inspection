require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Script para procesar PDFs existentes en inspection_evidences.
 *
 * Recorre todas las evidencias de tipo 'pdf' (o 'document' con mimeType pdf)
 * que NO tienen metadata.pdfSummary, descarga el PDF de R2, extrae el texto
 * de las primeras 10 páginas y guarda un resumen en metadata.
 *
 * Uso: node scripts/summarize-existing-pdfs.cjs
 */
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Buscar evidencias PDF sin resumen
  const { rows } = await c.query(`
    SELECT id, url, type, description, metadata
    FROM inspection_evidences
    WHERE type IN ('pdf', 'document')
      AND (metadata->>'pdfSummary') IS NULL
    ORDER BY created_at ASC
  `);

  console.log(`📄 Encontrados ${rows.length} PDFs sin resumen\n`);

  if (rows.length === 0) {
    console.log('✅ Todos los PDFs ya tienen resumen.');
    await c.end();
    return;
  }

  // Cliente R2
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const { PDFParse } = require('pdf-parse');

  let processed = 0;
  let failed = 0;

  for (const ev of rows) {
    try {
      console.log(`  Procesando ${ev.id} — ${ev.description || ev.url}`);

      // Extraer el key de la URL pública
      const publicUrl = process.env.R2_PUBLIC_URL || '';
      const key = ev.url.replace(publicUrl + '/', '').replace(publicUrl, '');

      // Descargar de R2
      const { Body } = await r2.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      }));

      const chunks = [];
      for await (const chunk of Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Parsear PDF
      const uint8 = new Uint8Array(buffer);
      const parser = new PDFParse(uint8);
      const result = await parser.getText();

      const total = result.total || 0;
      const pages = result.pages || [];
      const analyzedPages = pages.slice(0, 10);
      const analyzedText = analyzedPages.map(p => p.text).join('\n\n');

      const summary = buildSummary(analyzedText, total, 10);

      // Actualizar metadata
      const metadata = ev.metadata || {};
      metadata.pdfSummary = summary;
      metadata.pdfPageCount = total;

      await c.query(
        'UPDATE inspection_evidences SET metadata = $1 WHERE id = $2',
        [JSON.stringify(metadata), ev.id]
      );

      console.log(`    ✅ ${total} páginas — resumen: ${summary.substring(0, 80)}...`);
      processed++;
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Resumen: ${processed} procesados, ${failed} fallidos`);
  await c.end();
}

function buildSummary(text, totalPages, analyzedPages) {
  if (!text || !text.trim()) {
    return 'Documento sin texto extraíble (posiblemente escaneado).';
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10);
  if (lines.length === 0) return 'Documento sin contenido legible.';

  const keywords = [
    'póliza', 'poliza', 'cobertura', 'deducible', 'siniestro',
    'indemnización', 'indemnizacion', 'asegurado', 'aseguradora',
    'vigencia', 'prima', 'capital', 'riesgo', 'exclusión', 'exclusion',
    'límite', 'limite', 'subrogación', 'subrogacion',
  ];

  const keyLines = lines.filter(line =>
    keywords.some(kw => line.toLowerCase().includes(kw))
  );

  const intro = lines.slice(0, 5).join(' ');
  const relevant = keyLines.slice(0, 5).join(' | ');

  const pageNote = totalPages > analyzedPages
    ? ` (analizadas primeras ${analyzedPages} de ${totalPages} páginas)`
    : ` (${totalPages} ${totalPages === 1 ? 'página' : 'páginas'})`;

  let summary = intro;
  if (relevant && relevant !== intro) {
    summary += ` — Aspectos relevantes: ${relevant}`;
  }
  summary += pageNote;

  if (summary.length > 500) {
    summary = summary.substring(0, 497) + '...';
  }

  return summary;
}

main().catch(e => { console.error(e); process.exit(1); });
