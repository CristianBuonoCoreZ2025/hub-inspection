"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import { Bold, Italic, Underline as UnderlineIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface SubjectEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  editorRef?: React.MutableRefObject<Editor | null>;
}

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffcc00", "#ffff00", "#00ff00", "#33ff33", "#00cc66", "#009900", "#006633",
  "#0066cc", "#0099ff", "#33ccff", "#00ffff", "#0000ff", "#3333ff", "#6600ff", "#9900ff", "#cc00ff", "#ff00ff",
];

const FONT_SIZES = [
  { label: "Default", value: "" },
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
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
    <Tooltip>
      <TooltipTrigger className="inline-flex">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded text-foreground/70 transition-[background-color,color,box-shadow] duration-150",
            "hover:bg-accent hover:text-foreground",
            active && "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_var(--primary)]",
            disabled && "cursor-not-allowed opacity-40"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function SubjectEditor({ value, onChange, disabled, placeholder, className, editorRef }: SubjectEditorProps) {
  const [colorOpen, setColorOpen] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Sólo marcas inline, nada de bloques
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "subject-editor-content min-h-[36px] px-3 py-1.5 text-sm outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  React.useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Sync externo
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  React.useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const currentColor = (editor?.getAttributes("textStyle").color as string) || "#000000";

  return (
    <div className={cn("rounded border border-border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/20 px-1.5 py-1">
        <ToolbarButton title="Negrita" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} disabled={disabled}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Cursiva" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={disabled}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Subrayado" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={disabled}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setColorOpen((v) => !v)}
                disabled={disabled}
                className="ml-1 inline-flex h-5 w-6 flex-col items-center justify-center rounded text-foreground/70 hover:bg-accent disabled:opacity-40"
              >
                <span className="text-[13px] font-bold leading-none">A</span>
                <span className="mt-0.5 h-0.75 w-4 rounded-sm" style={{ backgroundColor: currentColor }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Color de texto</p>
            </TooltipContent>
          </Tooltip>
          {colorOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setColorOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 grid w-45 grid-cols-10 gap-1 rounded-md border border-border bg-popover p-2 shadow-lg">
                {TEXT_COLORS.map((c) => (
                  <Tooltip key={c}>
                    <TooltipTrigger className="inline-flex">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          editor?.chain().focus().setColor(c).run();
                          setColorOpen(false);
                        }}
                        className="h-4 w-4 rounded border border-border/60 transition-transform hover:scale-110"
                        style={{ backgroundColor: c }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{c}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <select
              value={editor?.getAttributes("textStyle").fontSize || ""}
              disabled={disabled}
              onChange={(e) => editor?.chain().focus().setFontSize(e.target.value).run()}
              onMouseDown={(e) => e.stopPropagation()}
              className="ml-1 h-6 rounded border border-border bg-background px-1 text-[11px] outline-none focus:border-primary disabled:opacity-40"
            >
              {FONT_SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Tamaño</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="relative">
        <EditorContent editor={editor} />
        {placeholder && !value && (
          <div className="pointer-events-none absolute left-3 top-1.5 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
