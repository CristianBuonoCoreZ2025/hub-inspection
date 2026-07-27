"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Extension, type Command } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { AllSelection, TextSelection, Transaction } from "@tiptap/pm/state";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Highlighter,
  Type,
  Minus,
  Code2,
  Eye,
  Indent,
  Outdent,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────
// Extensión de indentación para TipTap — agrega data-indent a los
// párrafos, títulos e ítems de lista para que se vean como Word.
// ──────────────────────────────────────────────────────────────
interface IndentOptions {
  types: string[];
  minLevel: number;
  maxLevel: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

const IndentExtension = Extension.create<IndentOptions>({
  name: "indent",

  addOptions() {
    return {
      types: ["paragraph", "heading", "listItem"],
      minLevel: 0,
      maxLevel: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            renderHTML: (attributes) => {
              return attributes?.indent > this.options.minLevel
                ? { "data-indent": attributes.indent }
                : null;
            },
            parseHTML: (element) => {
              const level = Number(element.getAttribute("data-indent"));
              return level && level > this.options.minLevel ? level : null;
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const setNodeIndentMarkup = (
      tr: Transaction,
      pos: number,
      delta: number
    ): Transaction => {
      const node = tr?.doc?.nodeAt(pos);

      if (node) {
        const nextLevel = (node.attrs.indent || 0) + delta;
        const { minLevel, maxLevel } = this.options;
        const indent =
          nextLevel < minLevel
            ? minLevel
            : nextLevel > maxLevel
            ? maxLevel
            : nextLevel;

        if (indent !== node.attrs.indent) {
          const currentAttrs = Object.fromEntries(
            Object.entries(node.attrs).filter(([key]) => key !== "indent")
          );
          const nodeAttrs =
            indent > minLevel ? { ...currentAttrs, indent } : currentAttrs;
          return tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks);
        }
      }
      return tr;
    };

    const updateIndentLevel = (
      tr: Transaction,
      delta: number
    ): Transaction => {
      const { doc, selection } = tr;

      if (
        doc &&
        selection &&
        (selection instanceof TextSelection || selection instanceof AllSelection)
      ) {
        const { from, to } = selection;
        doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            tr = setNodeIndentMarkup(tr, pos, delta);
            return false;
          }
          return true;
        });
      }

      return tr;
    };

    const applyIndent = (direction: number) => (): Command => ({ tr, state, dispatch }) => {
      tr = tr.setSelection(state.selection);
      tr = updateIndentLevel(tr, direction);

      if (tr.docChanged) {
        dispatch?.(tr);
        return true;
      }
      return false;
    };

    return {
      indent: applyIndent(1),
      outdent: applyIndent(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});

export interface HtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Ref al elemento editable para insertar placeholders desde afuera. */
  editorRef?: React.MutableRefObject<Editor | null>;
  /** Mostrar toggle de vista código HTML (default: true).
   *  En el compose de email se oculta — el usuario final no debe ver HTML crudo. */
  showCodeView?: boolean;
}

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif", style: { fontFamily: "Arial, sans-serif" } },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif", style: { fontFamily: "Helvetica, Arial, sans-serif" } },
  { label: "Times New Roman", value: "'Times New Roman', serif", style: { fontFamily: "'Times New Roman', serif" } },
  { label: "Georgia", value: "Georgia, serif", style: { fontFamily: "Georgia, serif" } },
  { label: "Courier New", value: "'Courier New', monospace", style: { fontFamily: "'Courier New', monospace" } },
  { label: "Verdana", value: "Verdana, sans-serif", style: { fontFamily: "Verdana, sans-serif" } },
  { label: "Tahoma", value: "Tahoma, sans-serif", style: { fontFamily: "Tahoma, sans-serif" } },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif", style: { fontFamily: "'Trebuchet MS', sans-serif" } },
] as const;

const FONT_SIZES = [
  { label: "Default", value: "" },
  { label: "10px", value: "10px" },
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "28px", value: "28px" },
  { label: "32px", value: "32px" },
  { label: "36px", value: "36px" },
  { label: "48px", value: "48px" },
];

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffcc00", "#ffff00", "#00ff00", "#33ff33", "#00cc66", "#009900", "#006633",
  "#0066cc", "#0099ff", "#33ccff", "#00ffff", "#0000ff", "#3333ff", "#6600ff", "#9900ff", "#cc00ff", "#ff00ff",
];

const HIGHLIGHT_COLORS = [
  "#ffff00", "#ffcc00", "#ff9900", "#ff6666", "#ff3399", "#cc99ff", "#9966ff", "#3399ff", "#33ccff", "#33ff99",
  "#33ff33", "#99ff33", "#ffff33", "#ffcc33", "#cccccc", "#999999",
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded px-0.5 text-foreground/80 transition-all",
        "hover:bg-accent hover:text-foreground",
        active && "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_var(--primary)]",
        disabled && "cursor-not-allowed opacity-35 hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1.5 h-6 w-px self-center bg-border/70" />;
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M1.5 2.5L4 5.5L6.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dropdown({
  value,
  onChange,
  options,
  title,
  disabled,
  width = "w-[110px]",
  renderLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string; style?: React.CSSProperties }[];
  title: string;
  disabled?: boolean;
  width?: string;
  renderLabel?: (opt: { label: string; value: string; style?: React.CSSProperties }) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-6 items-center justify-between gap-1 rounded border border-border bg-background px-1.5 text-[11px] text-foreground transition-colors",
          "hover:border-primary/50 hover:bg-accent/40",
          width,
          disabled && "cursor-not-allowed opacity-40 hover:border-border hover:bg-transparent"
        )}
      >
        <span className="truncate" style={current?.style}>
          {current ? (renderLabel ? renderLabel(current) : current.label) : title}
        </span>
        <ChevronDown className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 max-h-70 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={o.style}
                className={cn(
                  "flex w-full items-center px-2.5 py-1.5 text-left text-[12px] text-foreground transition-colors hover:bg-accent",
                  o.value === value && "bg-primary/10 font-medium text-primary"
                )}
              >
                {renderLabel ? renderLabel(o) : o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ColorButton({
  onPick,
  onToggle,
  currentColor,
  title,
  disabled,
  icon,
  palette,
}: {
  onPick: (color: string) => void;
  onToggle?: () => void;
  currentColor?: string;
  title: string;
  disabled?: boolean;
  icon: React.ReactNode;
  palette: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const barColor = currentColor || "#000000";
  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (onToggle ? onToggle() : setOpen((v) => !v))}
        disabled={disabled}
        title={title}
        className={cn(
          "inline-flex h-5 w-6 items-center justify-center rounded-t text-foreground/80 transition-colors",
          "hover:bg-accent hover:text-foreground disabled:opacity-40"
        )}
      >
        {icon}
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={`${title} — más colores`}
        className={cn(
          "h-1.5 w-6 rounded-b border-x border-b border-border transition-colors hover:brightness-110",
          disabled && "opacity-40"
        )}
        style={{ backgroundColor: barColor }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-50 mt-1 rounded-md border border-border bg-popover p-2 shadow-lg">
            <div className="grid grid-cols-10 gap-1">
              {palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                  className="h-4 w-4 rounded border border-border/60 transition-transform hover:scale-110 hover:border-foreground"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
              <input
                type="color"
                value={barColor}
                onChange={(e) => onPick(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border border-border"
                title="Color personalizado"
              />
              <input
                type="text"
                value={barColor}
                onChange={(e) => onPick(e.target.value)}
                className="h-6 w-20 rounded border border-border bg-background px-1.5 font-mono text-[10px] outline-none focus:border-primary"
                placeholder="#000000"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function HtmlEditor({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  editorRef,
  showCodeView = true,
}: HtmlEditorProps) {
  const [mode, setMode] = React.useState<"visual" | "code">("visual");
  const [codeValue, setCodeValue] = React.useState(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Subscript,
      Superscript,
      IndentExtension,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "html-editor-content prose max-w-none min-h-40 px-3 pt-2 pb-5 text-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setCodeValue(html);
    },
  });

  React.useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Sync externo (cuando cambia value desde afuera, ej: cargar plantilla)
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== codeValue) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate desde prop externa (load plantilla); no hay forma más limpia de sincronizar TipTap con un valor controlado
      setCodeValue(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  React.useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const insertLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace:", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertImage = () => {
    if (!editor) return;
    const url = window.prompt("URL de la imagen:", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const insertTable = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const currentTextColor = (editor?.getAttributes("textStyle").color as string) || undefined;
  const currentHighlight = (editor?.getAttributes("highlight").color as string) || undefined;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background shadow-sm flex flex-col", className)}>
      {/* Toolbar — estilo Outlook */}
      <div className="flex flex-wrap items-stretch gap-0.5 border-b border-border bg-linear-to-b from-muted/40 to-muted/10 px-1 py-0.5 shrink-0">
        {/* Grupo: Deshacer/Rehacer */}
        <ToolbarButton title="Deshacer (Ctrl+Z)" onClick={() => editor?.chain().focus().undo().run()} disabled={disabled || !editor?.can().undo()}>
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Rehacer (Ctrl+Y)" onClick={() => editor?.chain().focus().redo().run()} disabled={disabled || !editor?.can().redo()}>
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />

        {/* Grupo: Fuente + Tamaño */}
        <Dropdown
          title="Fuente"
          value={editor?.getAttributes("textStyle").fontFamily || ""}
          onChange={(v) => editor?.chain().focus().setFontFamily(v).run()}
          options={[...FONT_FAMILIES]}
          disabled={disabled}
          width="w-[130px]"
          renderLabel={(o) => <span style={o.style}>{o.label}</span>}
        />
        <Dropdown
          title="Tamaño"
          value={editor?.getAttributes("textStyle").fontSize || ""}
          onChange={(v) => editor?.chain().focus().setFontSize(v).run()}
          options={[...FONT_SIZES]}
          disabled={disabled}
          width="w-[70px]"
        />
        <Divider />

        {/* Grupo: Formato de texto */}
        <ToolbarButton title="Negrita (Ctrl+B)" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} disabled={disabled}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Cursiva (Ctrl+I)" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={disabled}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Subrayado (Ctrl+U)" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={disabled}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Tachado" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={disabled}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Subíndice" active={editor?.isActive("subscript")} onClick={() => editor?.chain().focus().toggleSubscript().run()} disabled={disabled}>
          <SubscriptIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Superíndice" active={editor?.isActive("superscript")} onClick={() => editor?.chain().focus().toggleSuperscript().run()} disabled={disabled}>
          <SuperscriptIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />

        {/* Grupo: Color de texto + Resaltado (Outlook style: ícono + barrita de color) */}
        <ColorButton
          title="Color de texto"
          icon={<Type className="h-3.5 w-3.5" />}
          currentColor={currentTextColor}
          palette={TEXT_COLORS}
          onPick={(c) => editor?.chain().focus().setColor(c).run()}
          onToggle={() => editor?.chain().focus().setColor(currentTextColor || "#000000").run()}
          disabled={disabled}
        />
        <ColorButton
          title="Resaltar"
          icon={<Highlighter className="h-3.5 w-3.5" />}
          currentColor={currentHighlight || "#ffff00"}
          palette={HIGHLIGHT_COLORS}
          onPick={(c) => editor?.chain().focus().toggleHighlight({ color: c }).run()}
          onToggle={() => editor?.chain().focus().toggleHighlight({ color: currentHighlight || "#ffff00" }).run()}
          disabled={disabled}
        />
        <ToolbarButton title="Quitar formato" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} disabled={disabled}>
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />

        {/* Grupo: Estilos de párrafo */}
        <Dropdown
          title="Estilo"
          value={
            editor?.isActive("heading", { level: 1 }) ? "h1"
            : editor?.isActive("heading", { level: 2 }) ? "h2"
            : editor?.isActive("heading", { level: 3 }) ? "h3"
            : editor?.isActive("blockquote") ? "quote"
            : editor?.isActive("codeBlock") ? "code"
            : "p"
          }
          onChange={(v) => {
            if (v === "p") editor?.chain().focus().setParagraph().run();
            else if (v === "h1") editor?.chain().focus().toggleHeading({ level: 1 }).run();
            else if (v === "h2") editor?.chain().focus().toggleHeading({ level: 2 }).run();
            else if (v === "h3") editor?.chain().focus().toggleHeading({ level: 3 }).run();
            else if (v === "quote") editor?.chain().focus().toggleBlockquote().run();
            else if (v === "code") editor?.chain().focus().toggleCodeBlock().run();
          }}
          options={[
            { label: "Cuerpo", value: "p" },
            { label: "Título 1", value: "h1", style: { fontSize: "16px", fontWeight: 700 } },
            { label: "Título 2", value: "h2", style: { fontSize: "14px", fontWeight: 700 } },
            { label: "Título 3", value: "h3", style: { fontSize: "13px", fontWeight: 600 } },
            { label: "Cita", value: "quote", style: { fontStyle: "italic", color: "var(--muted-foreground)" } },
            { label: "Código", value: "code", style: { fontFamily: "monospace" } },
          ]}
          disabled={disabled}
          width="w-[100px]"
        />
        <Divider />

        {/* Grupo: Listas */}
        <ToolbarButton title="Lista con viñetas" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={disabled}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={disabled}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />

        {/* Grupo: Alineación + indentación */}
        <ToolbarButton title="Alinear izquierda" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} disabled={disabled}>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Centrar" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} disabled={disabled}>
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Alinear derecha" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()} disabled={disabled}>
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Justificar" active={editor?.isActive({ textAlign: "justify" })} onClick={() => editor?.chain().focus().setTextAlign("justify").run()} disabled={disabled}>
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Indentar" onClick={() => editor?.chain().focus().indent().run()} disabled={disabled}>
          <Indent className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Outdent" onClick={() => editor?.chain().focus().outdent().run()} disabled={disabled}>
          <Outdent className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />

        {/* Grupo: Insertar */}
        <ToolbarButton title="Enlace (Ctrl+K)" active={editor?.isActive("link")} onClick={insertLink} disabled={disabled}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Imagen" onClick={insertImage} disabled={disabled}>
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Insertar tabla" active={editor?.isActive("table")} onClick={insertTable} disabled={disabled}>
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        {/* Controles de tabla (visibles solo cuando hay tabla) */}
        {editor?.isActive("table") && (
          <>
            <Divider />
            <ToolbarButton title="Agregar fila arriba" disabled={disabled} onClick={() => editor.chain().focus().addRowBefore().run()}>
              <span className="text-[10px] font-medium whitespace-nowrap">+ Fila ↑</span>
            </ToolbarButton>
            <ToolbarButton title="Agregar fila abajo" disabled={disabled} onClick={() => editor.chain().focus().addRowAfter().run()}>
              <span className="text-[10px] font-medium whitespace-nowrap">+ Fila ↓</span>
            </ToolbarButton>
            <ToolbarButton title="Agregar columna izquierda" disabled={disabled} onClick={() => editor.chain().focus().addColumnBefore().run()}>
              <span className="text-[10px] font-medium whitespace-nowrap">+ Col ←</span>
            </ToolbarButton>
            <ToolbarButton title="Agregar columna derecha" disabled={disabled} onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <span className="text-[10px] font-medium whitespace-nowrap">+ Col →</span>
            </ToolbarButton>
            <ToolbarButton title="Borrar fila" disabled={disabled} onClick={() => editor.chain().focus().deleteRow().run()}>
              <span className="text-[10px] font-medium whitespace-nowrap">- Fila</span>
            </ToolbarButton>
            <ToolbarButton title="Borrar columna" disabled={disabled} onClick={() => editor.chain().focus().deleteColumn().run()}>
              <span className="text-[10px] font-medium whitespace-nowrap">- Col</span>
            </ToolbarButton>
            <ToolbarButton title="Borrar tabla" disabled={disabled} onClick={() => editor.chain().focus().deleteTable().run()}>
              <span className="text-[10px] font-semibold whitespace-nowrap">DEL</span>
            </ToolbarButton>
          </>
        )}

        {/* Toggle visual / código — oculto en el compose (showCodeView=false) */}
        {showCodeView && (
          <div className="ml-auto flex items-center gap-0.5 self-center">
            <ToolbarButton
              title="Editor visual"
              active={mode === "visual"}
              onClick={() => {
                if (mode === "code") {
                  editor?.commands.setContent(codeValue || "", { emitUpdate: false });
                  onChange(codeValue || "");
                }
                setMode("visual");
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Editar HTML"
              active={mode === "code"}
              onClick={() => {
                if (mode === "visual" && editor) {
                  setCodeValue(editor.getHTML());
                }
                setMode("code");
              }}
            >
              <Code2 className="h-3.5 w-3.5" />
            </ToolbarButton>
          </div>
        )}
      </div>

      {/* Contenido */}
      {mode === "visual" ? (
        <div className="html-editor-wrap">
          <EditorContent editor={editor} />
          {placeholder && (!value || value === "<p></p>") && (
            <div className="pointer-events-none absolute px-3 py-2 text-sm text-muted-foreground">
              {placeholder}
            </div>
          )}
        </div>
      ) : (
        <textarea
          value={codeValue}
          onChange={(e) => {
            setCodeValue(e.target.value);
            onChange(e.target.value);
          }}
          disabled={disabled}
          spellCheck={false}
          className="flex-1 min-h-0 w-full resize-y bg-background p-3 font-mono text-[11px] text-foreground outline-none disabled:opacity-50"
          placeholder="<p>...</p>"
        />
      )}
    </div>
  );
}
