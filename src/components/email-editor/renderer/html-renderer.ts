/**
 * HtmlRenderer — convierte el documento JSON a HTML compatible con email.
 *
 * Reglas de compatibilidad:
 *   - Usa tablas para layout (no divs/flex/grid)
 *   - Estilos inline (no clases CSS)
 *   - Comentarios condicionales para Outlook <!--[if mso]>
 *   - Sin JavaScript
 *   - Sin <form>, <input>, <video>, etc.
 *   - Imágenes con width/height explícitos
 *   - Tablas con cellpadding/cellspacing/border explícitos
 *
 * Compatible con: Outlook Desktop, Outlook 365, Outlook Web,
 * Gmail Web, Gmail Android/iPhone, Apple Mail, Thunderbird, Yahoo Mail.
 */

import type {
  EmailDocument,
  Block,
  InlineContent,
  TextMark,
  TableBlock,
} from "../core/types";

// ─── Render principal ───

export function renderDocumentToHtml(doc: EmailDocument, variables?: Record<string, string>): string {
  const meta = doc.metadata ?? {};
  const bgColor = meta.backgroundColor ?? "#ffffff";
  const maxWidth = meta.maxWidth ?? "600px";
  const fontFamily = meta.fontFamily ?? "Arial, sans-serif";
  const fontSize = meta.fontSize ?? "14px";
  const textColor = meta.textColor ?? "#333333";

  const bodyContent = doc.blocks.map((block) => renderBlock(block, variables)).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(meta.subject ?? "Email")}</title>
  <!--[if mso]>
  <style>
    body, table, td { font-family: ${fontFamily} !important; }
    .ee-btn a { padding: 12px 24px !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${bgColor};font-family:${fontFamily};font-size:${fontSize};color:${textColor};line-height:1.5;">
  <!-- Preview text (oculto) -->
  ${meta.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${bgColor};">${escapeHtml(meta.previewText)}</div>` : ""}

  <!-- Wrapper table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bgColor};">
    <tr>
      <td align="center" style="padding:20px;">
        <!-- Container table -->
        <table role="presentation" width="${maxWidth}" cellpadding="0" cellspacing="0" border="0" style="max-width:${maxWidth};width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px;">
              ${bodyContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Render de bloques ───

function renderBlock(block: Block, variables?: Record<string, string>): string {
  switch (block.type) {
    case "paragraph":
      return renderParagraph(block, variables);
    case "heading":
      return renderHeading(block, variables);
    case "list":
      return renderList(block, variables);
    case "table":
      return renderTable(block, variables);
    case "image":
      return renderImage(block);
    case "button":
      return renderButton(block);
    case "quote":
      return renderQuote(block, variables);
    case "divider":
      return renderDivider(block);
    case "spacer":
      return renderSpacer(block);
    case "columns":
      return renderColumns(block, variables);
    case "container":
      return renderContainer(block, variables);
    case "callout":
      return renderCallout(block, variables);
    case "html":
      return block.html;
    case "signature":
      return renderSignature(block, variables);
    default:
      return "";
  }
}

// ─── Bloques específicos ───

function renderParagraph(block: import("../core/types").ParagraphBlock, variables?: Record<string, string>): string {
  const align = block.alignment ?? "left";
  const indent = block.indent ?? 0;
  const lineHeight = block.lineHeight ? `line-height:${block.lineHeight};` : "";
  const paddingLeft = indent > 0 ? `padding-left:${indent * 30}px;` : "";
  const content = renderInlineContent(block.children, variables);
  return `<p style="margin:0 0 12px 0;text-align:${align};${lineHeight}${paddingLeft}">${content}</p>`;
}

function renderHeading(block: import("../core/types").HeadingBlock, variables?: Record<string, string>): string {
  const align = block.alignment ?? "left";
  const content = renderInlineContent(block.children, variables);
  const sizes: Record<number, string> = { 1: "28px", 2: "24px", 3: "20px", 4: "18px", 5: "16px", 6: "14px" };
  const size = sizes[block.level] ?? "20px";
  return `<h${block.level} style="margin:16px 0 8px 0;font-size:${size};font-weight:bold;text-align:${align};">${content}</h${block.level}>`;
}

function renderList(block: import("../core/types").ListBlock, variables?: Record<string, string>): string {
  const tag = block.ordered ? "ol" : "ul";
  const style = block.ordered
    ? "margin:0 0 12px 0;padding-left:24px;"
    : "margin:0 0 12px 0;padding-left:24px;list-style-type:disc;";
  const items = block.items.map((item) => {
    const content = renderInlineContent(item.children, variables);
    return `<li style="margin:0 0 4px 0;">${content}</li>`;
  }).join("\n");
  return `<${tag} style="${style}">${items}</${tag}>`;
}

function renderTable(block: TableBlock, variables?: Record<string, string>): string {
  const borderWidth = block.borderWidth ?? 1;
  const borderColor = block.borderColor ?? "#cccccc";
  const cellPadding = block.cellPadding ?? 8;
  const cellSpacing = block.cellSpacing ?? 0;
  const width = block.width ?? "100%";
  const align = block.alignment ?? "left";

  const rows = block.rows.map((row) => {
    const cells = row.cells.map((cell) => {
      const cellContent = cell.children.map((childBlock) => renderBlock(childBlock, variables)).join("");
      const bgStyle = cell.backgroundColor ? `background-color:${cell.backgroundColor};` : "";
      const borderStyle = cell.borderColor
        ? `border:${cell.borderWidth ?? borderWidth}px solid ${cell.borderColor};`
        : `border:${borderWidth}px solid ${borderColor};`;
      const vAlign = cell.verticalAlign ?? "top";
      const hAlign = cell.horizontalAlign ?? "left";
      const widthStyle = cell.width ? `width:${cell.width};` : "";
      const paddingStyle = cell.padding !== undefined ? `padding:${cell.padding}px;` : `padding:${cellPadding}px;`;
      const colspan = cell.colspan ? ` colspan="${cell.colspan}"` : "";
      const rowspan = cell.rowspan ? ` rowspan="${cell.rowspan}"` : "";
      const tag = row.header ? "th" : "td";
      return `<${tag}${colspan}${rowspan} style="${borderStyle}${bgStyle}${paddingStyle}vertical-align:${vAlign};text-align:${hAlign};${widthStyle}">${cellContent}</${tag}>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("\n");

  return `<table role="presentation" width="${width}" cellpadding="${cellPadding}" cellspacing="${cellSpacing}" border="${borderWidth}" style="width:${width};border-collapse:collapse;border:${borderWidth}px solid ${borderColor};text-align:${align};margin:0 0 12px 0;">${rows}</table>`;
}

function renderImage(block: import("../core/types").ImageBlock): string {
  const align = block.alignment ?? "center";
  const width = block.width ?? "auto";
  const height = block.height ?? "auto";
  const radius = block.borderRadius ? `border-radius:${block.borderRadius}px;` : "";
  const img = `<img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt)}" width="${width}" height="${height}" style="display:block;width:${width};height:${height};${radius}" />`;
  if (block.link) {
    return `<div style="text-align:${align};margin:0 0 12px 0;"><a href="${escapeAttr(block.link)}" target="_blank" rel="noopener noreferrer">${img}</a></div>`;
  }
  return `<div style="text-align:${align};margin:0 0 12px 0;">${img}</div>`;
}

function renderButton(block: import("../core/types").ButtonBlock): string {
  const bg = block.backgroundColor ?? "#0066cc";
  const color = block.textColor ?? "#ffffff";
  const fontSize = block.fontSize ?? "16px";
  const padding = block.padding ?? "12px 24px";
  const radius = block.borderRadius ?? 6;
  const align = block.alignment ?? "center";
  const width = block.width ?? "auto";

  // Outlook no soporta border-radius ni padding en <a>, usamos tabla + mso
  return `<div style="text-align:${align};margin:16px 0;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeAttr(block.href)}" style="height:${padding};v-text-anchor:middle;" arc="${radius}" strokecolor="${bg}" fillcolor="${bg}">
    <w:anchorlock/>
    <center style="color:${color};font-family:Arial,sans-serif;font-size:${fontSize};">${escapeHtml(block.text)}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a href="${escapeAttr(block.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:${width};padding:${padding};background-color:${bg};color:${color};font-size:${fontSize};font-weight:bold;text-decoration:none;border-radius:${radius}px;text-align:center;">${escapeHtml(block.text)}</a>
    <!--<![endif]-->
  </div>`;
}

function renderQuote(block: import("../core/types").QuoteBlock, variables?: Record<string, string>): string {
  const borderColor = block.borderColor ?? "#cccccc";
  const bgColor = block.backgroundColor ?? "#f9f9f9";
  const content = renderInlineContent(block.children, variables);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;"><tr><td style="padding:12px 16px;border-left:4px solid ${borderColor};background-color:${bgColor};">${content}</td></tr></table>`;
}

function renderDivider(block: import("../core/types").DividerBlock): string {
  const color = block.color ?? "#cccccc";
  const thickness = block.thickness ?? 1;
  const width = block.width ?? "100%";
  return `<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;"><tr><td style="border-top:${thickness}px solid ${color};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

function renderSpacer(block: import("../core/types").SpacerBlock): string {
  return `<div style="height:${block.height}px;line-height:${block.height}px;font-size:0;">&nbsp;</div>`;
}

function renderColumns(block: import("../core/types").ColumnsBlock, variables?: Record<string, string>): string {
  const gap = block.gap ?? 16;
  const colWidth = `${Math.floor(100 / block.columns.length)}%`;
  const cells = block.columns.map((col) => {
    const content = col.blocks.map((childBlock) => renderBlock(childBlock, variables)).join("");
    return `<td width="${colWidth}" style="vertical-align:top;padding:0 ${gap / 2}px;">${content}</td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;"><tr>${cells}</tr></table>`;
}

function renderContainer(block: import("../core/types").ContainerBlock, variables?: Record<string, string>): string {
  const bg = block.backgroundColor ? `background-color:${block.backgroundColor};` : "";
  const padding = block.padding ?? 20;
  const content = block.blocks.map((childBlock) => renderBlock(childBlock, variables)).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${bg}margin:0 0 12px 0;"><tr><td style="padding:${padding}px;">${content}</td></tr></table>`;
}

function renderCallout(block: import("../core/types").CalloutBlock, variables?: Record<string, string>): string {
  const bg = block.backgroundColor ?? "#fef3cd";
  const border = block.borderColor ?? "#ffc107";
  const content = renderInlineContent(block.children, variables);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;"><tr><td style="padding:12px 16px;background-color:${bg};border:1px solid ${border};border-radius:4px;">${content}</td></tr></table>`;
}

function renderSignature(block: import("../core/types").SignatureBlock, variables?: Record<string, string>): string {
  const content = block.blocks.map((childBlock) => renderBlock(childBlock, variables)).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0 0;border-top:1px solid #eeeeee;"><tr><td style="padding:16px 0;">${content}</td></tr></table>`;
}

// ─── Render de contenido inline ───

function renderInlineContent(children: InlineContent[], variables?: Record<string, string>): string {
  return children.map((node) => renderInlineNode(node, variables)).join("");
}

function renderInlineNode(node: InlineContent, variables?: Record<string, string>): string {
  if (node.type === "variable") {
    const value = variables?.[node.variable] ?? node.fallback ?? `{{${node.variable}}}`;
    return escapeHtml(value);
  }

  // TextNode
  let html = escapeHtml(node.text);
  const marks = node.marks ?? [];

  // Aplicar marcas de fuera hacia dentro
  for (let i = marks.length - 1; i >= 0; i--) {
    html = applyMarkToHtml(marks[i], html);
  }

  return html;
}

function applyMarkToHtml(mark: TextMark, content: string): string {
  switch (mark.type) {
    case "bold":
      return `<strong>${content}</strong>`;
    case "italic":
      return `<em>${content}</em>`;
    case "underline":
      return `<u>${content}</u>`;
    case "strike":
      return `<s>${content}</s>`;
    case "link":
      return `<a href="${escapeAttr(mark.href)}" target="${mark.target ?? "_blank"}" rel="noopener noreferrer" style="color:#0066cc;text-decoration:underline;">${content}</a>`;
    case "color":
      return `<span style="color:${mark.color};">${content}</span>`;
    case "highlight":
      return `<span style="background-color:${mark.color};">${content}</span>`;
    case "fontSize":
      return `<span style="font-size:${mark.size};">${content}</span>`;
    case "fontFamily":
      return `<span style="font-family:${mark.family};">${content}</span>`;
    case "sup":
      return `<sup>${content}</sup>`;
    case "sub":
      return `<sub>${content}</sub>`;
    default:
      return content;
  }
}

// ─── Render a texto plano ───

export function renderDocumentToPlainText(doc: EmailDocument, variables?: Record<string, string>): string {
  return doc.blocks.map((block) => blockToPlainText(block, variables)).join("\n").trim();
}

function blockToPlainText(block: Block, variables?: Record<string, string>): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
    case "callout":
      return inlineToPlainText(block.children, variables);
    case "list":
      return block.items.map((item, i) => `${block.ordered ? `${i + 1}.` : "•"} ${inlineToPlainText(item.children, variables)}`).join("\n");
    case "table":
      return block.rows.map((row) => row.cells.map((cell) => cell.children.map((b) => blockToPlainText(b, variables)).join(" ")).join(" | ")).join("\n");
    case "image":
      return `[Imagen: ${block.alt}]`;
    case "button":
      return `[Botón: ${block.text} → ${block.href}]`;
    case "divider":
      return "---";
    case "spacer":
      return "";
    case "columns":
      return block.columns.map((col) => col.blocks.map((b) => blockToPlainText(b, variables)).join("\n")).join("\n");
    case "container":
      return block.blocks.map((b) => blockToPlainText(b, variables)).join("\n");
    case "html":
      return block.html.replace(/<[^>]*>/g, "");
    case "signature":
      return block.blocks.map((b) => blockToPlainText(b, variables)).join("\n");
    default:
      return "";
  }
}

function inlineToPlainText(children: InlineContent[], variables?: Record<string, string>): string {
  return children.map((node) => {
    if (node.type === "variable") {
      return variables?.[node.variable] ?? node.fallback ?? `{{${node.variable}}}`;
    }
    return node.text;
  }).join("");
}

// ─── Helpers de escape ───

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
