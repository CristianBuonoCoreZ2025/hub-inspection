"use client";

import { useRef, useEffect } from "react";
import { EmailEditor, type EmailEditorRef } from "@react-email/editor";

interface ResendEditorLowProps {
  content: string;
  onReady?: (ref: EmailEditorRef) => void;
  onUpdate?: (ref: EmailEditorRef) => void;
  className?: string;
}

export function ResendEditorLow({ content, onReady, onUpdate, className }: ResendEditorLowProps) {
  const ref = useRef<EmailEditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inyectar padding en el área editable del editor después de que monte.
  useEffect(() => {
    const applyPadding = () => {
      const container = containerRef.current;
      if (!container) return;
      const editable = container.querySelector(".ProseMirror, .tiptap, [contenteditable]");
      if (editable instanceof HTMLElement) {
        editable.style.padding = "16px 20px";
      }
    };
    applyPadding();
    const t1 = setTimeout(applyPadding, 200);
    const t2 = setTimeout(applyPadding, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <EmailEditor
        ref={ref}
        content={content}
        onReady={(r) => {
          const container = containerRef.current;
          if (container) {
            const editable = container.querySelector(".ProseMirror, .tiptap, [contenteditable]");
            if (editable instanceof HTMLElement) {
              editable.style.padding = "16px 20px";
            }
          }
          onReady?.(r);
        }}
        onUpdate={onUpdate}
        bubbleMenu={{
          hideWhenActiveNodes: [
            "paragraph", "heading", "bulletList", "orderedList", "listItem",
            "blockquote", "codeBlock", "table", "tableRow", "tableCell", "tableHeader",
            "twoColumns", "threeColumns", "fourColumns", "columnsColumn",
            "button", "section", "container", "body", "div", "divider", "image",
            "text", "doc", "hardBreak", "horizontalRule", "previewText",
            "globalContent", "maxNesting", "trailingNode", "focusScopes",
          ],
          hideWhenActiveMarks: [
            "bold", "italic", "underline", "strike", "link", "code",
            "sup", "uppercase", "preservedStyle", "highlight", "textStyle",
          ],
        }}
      />
    </div>
  );
}
