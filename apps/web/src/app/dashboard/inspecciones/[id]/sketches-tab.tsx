"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
 getDamageSketches,
 updateDamageSketch,
 deleteDamageSketch,
} from "@/services/inspections";
import { DrawingCanvas } from "@/components/ui/drawing-canvas";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Pencil, Check, X, PenTool, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useConfirm } from "@/hooks/use-confirm";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export default function SketchesTab({ sessionId, sessionStatus, magicLinkToken }: { sessionId: string; sessionStatus?: string; magicLinkToken?: string }) {
 const queryClient = useQueryClient();
 const confirmDelete = useConfirm();
 const [uploading, setUploading] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editingLabel, setEditingLabel] = useState("");
 const [mode, setMode] = useState<"view" | "upload" | "draw">("view");
 const [drawEditingSketch, setDrawEditingSketch] = useState<{ id: string; url: string; sketchData: Record<string, unknown> | null; label: string } | null>(null);
 const [savingDrawing, setSavingDrawing] = useState(false);
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(12);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";

 const syncSketches = () => {
 queryClient.invalidateQueries({ queryKey: ["damage-sketches", sessionId] });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 if (magicLinkToken) queryClient.invalidateQueries({ queryKey: ["magic-link-live", magicLinkToken] });
 };

 const { data: sketches, isLoading } = useQuery({
 queryKey: ["damage-sketches", sessionId],
 queryFn: () => getDamageSketches(sessionId),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, label }: { id: string; label: string }) =>
 updateDamageSketch(id, { label }),
 onSuccess: () => {
 syncSketches();
 setEditingId(null);
 toast.success("Croquis actualizado");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteDamageSketch,
 onSuccess: () => {
 syncSketches();
 toast.success("Croquis eliminado");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const sketchMutation = useMutation({
 mutationFn: async (data: { sessionId: string; sketchDataUrl: string; sketchJson: Record<string, unknown> | null; label: string; sketchId?: string }) => {
 const res = await fetch("/api/inspection/sketch", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(data),
 });
 if (!res.ok) throw new Error("Error al guardar croquis");
 return res.json();
 },
 onSuccess: () => {
 syncSketches();
 setMode("view");
 setDrawEditingSketch(null);
 toast.success("Croquis guardado");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const sketchFileMutation = useMutation({
 mutationFn: async (file: File) => {
 const formData = new FormData();
 formData.append("file", file);
 formData.append("sessionId", sessionId);
 formData.append("label", file.name);
 const res = await fetch("/api/inspection/sketch/upload", {
 method: "POST",
 body: formData,
 });
 if (!res.ok) {
 const body = await res.json().catch(() => ({}));
 throw new Error(body.error || "Error al subir croquis");
 }
 return res.json();
 },
 onSuccess: () => {
 syncSketches();
 toast.success("Croquis subido");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 async function handleFile(file: File) {
 setUploading(true);
 try {
 sketchFileMutation.mutate(file);
 } catch (err) {
 toast.error("Error al subir archivo");
 console.error(err);
 } finally {
 setUploading(false);
 }
 }

 function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
 Array.from(e.target.files || []).forEach(handleFile);
 }

 function startEdit(sketch: { id: string; label: string | null }) {
 setEditingId(sketch.id);
 setEditingLabel(sketch.label || "");
 }

 function saveEdit(id: string) {
 if (editingLabel.trim()) {
 updateMutation.mutate({ id, label: editingLabel.trim() });
 } else {
 setEditingId(null);
 }
 }

 function handleSaveDrawing(dataUrl: string, sketchData: Record<string, unknown>) {
 setSavingDrawing(true);
 sketchMutation.mutate(
 {
 sessionId,
 sketchDataUrl: dataUrl,
 sketchJson: sketchData,
 label: drawEditingSketch?.label || "Croquis dibujado",
 sketchId: drawEditingSketch?.id,
 },
 { onSettled: () => setSavingDrawing(false) }
 );
 }

 if (isLoading) {
 return (
 <div className="app-panel">
 <p className="app-body text-muted-foreground">Cargando croquis...</p>
 </div>
 );
 }

 // Paginación
 const totalCount = sketches?.length || 0;
 const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
 const currentPage = Math.min(page, totalPages);
 const start = (currentPage - 1) * pageSize;
 const paginatedSketches = (sketches || []).slice(start, start + pageSize);

 // Modo dibujo
 if (mode === "draw") {
 return (
 <div className="app-stack">
 <div className="app-panel">
 <DrawingCanvas
 onSave={handleSaveDrawing}
 onCancel={() => { setMode("view"); setDrawEditingSketch(null); }}
 saving={savingDrawing}
 initialImage={drawEditingSketch?.url}
 initialSketchData={drawEditingSketch?.sketchData}
 height={500}
 />
 </div>
 </div>
 );
 }

 return (
 <div className="app-stack">

 {/* Banner de solo lectura */}
 {readOnly && (
 <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 app-body text-amber-700 dark:text-amber-300">
 <Lock className="h-3.5 w-3.5 shrink-0" />
 Inspección finalizada — los croquis son de solo lectura
 </div>
 )}

 {/* Panel con toolbar + grilla (mismo estándar que evidencias) */}
 <div className="app-panel">
 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <h3 className="app-section-title">
 <PenTool className="h-4 w-4" />
 Croquis
 {sketches && sketches.length > 0 && (
 <span className="text-[11px] text-muted-foreground">({sketches.length})</span>
 )}
 </h3>
 {!readOnly && (
 <>
 <Tooltip>
   <TooltipTrigger className="inline-flex">
     <Button
       variant="ghost"
       size="icon"
       className="btn-icon-sm"
       onClick={() => setMode("draw")}
     >
       <PenTool className="h-3.5 w-3.5" />
     </Button>
   </TooltipTrigger>
   <TooltipContent side="top">
     <p>Dibujar croquis</p>
   </TooltipContent>
 </Tooltip>
 <Tooltip>
   <TooltipTrigger className="inline-flex">
     <Button
       variant="ghost"
       size="icon"
       className="btn-icon-sm"
       onClick={() => fileInputRef.current?.click()}
     >
       <Upload className="h-3.5 w-3.5" />
     </Button>
   </TooltipTrigger>
   <TooltipContent side="top">
     <p>Subir croquis</p>
   </TooltipContent>
 </Tooltip>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleInput}
 multiple
 />
 </>
 )}
 </div>
 {sketches && sketches.length > 0 && (
 <Pagination variant="controls" page={currentPage} totalPages={totalPages} total={totalCount} pageSize={pageSize} onPageChange={setPage} />
 )}
 </div>

 {uploading && <p className="app-body text-muted-foreground text-center py-2">Subiendo...</p>}

 {/* Grid */}
 {sketches && sketches.length > 0 ? (
 <>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
 {paginatedSketches.map((sketch) => (
 <div key={sketch.id} className="app-panel space-y-2">
 <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
 {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 with dynamic URL */}
 <img
 src={sketch.sketch_url}
 alt={sketch.label || "Croquis"}
 className="h-full w-full object-contain"
 loading="lazy"
 />
 </div>
 <div className="flex items-center gap-2">
 {editingId === sketch.id ? (
 <>
 <input
 type="text"
 value={editingLabel}
 onChange={(e) => setEditingLabel(e.target.value)}
 className="app-input h-7 flex-1"
 autoFocus
 onKeyDown={(e) => {
 if (e.key === "Enter") saveEdit(sketch.id);
 if (e.key === "Escape") setEditingId(null);
 }}
 />
 <Button
 variant="ghost"
 size="icon"
 className="btn-icon-sm"
 onClick={() => saveEdit(sketch.id)}
 >
 <Check className="h-3.5 w-3.5" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="btn-icon-sm"
 onClick={() => setEditingId(null)}
 >
 <X className="h-3.5 w-3.5" />
 </Button>
 </>
 ) : (
 <>
 <span className="flex-1 truncate text-[10px] font-medium text-foreground">
 {sketch.label || "Sin título"}
 </span>
 {!readOnly && (
 <>
 <Tooltip>
   <TooltipTrigger className="inline-flex">
     <Button
       variant="ghost"
       size="icon"
       className="btn-icon-sm"
       onClick={() => {
         setDrawEditingSketch({ id: sketch.id, url: `/api/inspection/sketch/${sketch.id}/image`, sketchData: sketch.sketch_data, label: sketch.label || "" });
         setMode("draw");
       }}
     >
       <PenTool className="h-3.5 w-3.5" />
     </Button>
   </TooltipTrigger>
   <TooltipContent side="top">
     <p>Dibujar / Editar</p>
   </TooltipContent>
 </Tooltip>
 <Tooltip>
   <TooltipTrigger className="inline-flex">
     <Button
       variant="ghost"
       size="icon"
       className="btn-icon-sm"
       onClick={() => startEdit(sketch)}
     >
       <Pencil className="h-3.5 w-3.5" />
     </Button>
   </TooltipTrigger>
   <TooltipContent side="top">
     <p>Renombrar</p>
   </TooltipContent>
 </Tooltip>
 <Tooltip>
   <TooltipTrigger className="inline-flex">
     <Button
       variant="ghost"
       size="icon"
       className="btn-icon-sm"
       onClick={async () => {
         const ok = await confirmDelete({
           title: "Eliminar croquis",
           description: "¿Estás seguro? Esta acción no se puede deshacer.",
           destructive: true,
           confirmLabel: "Eliminar",
         });
         if (ok) deleteMutation.mutate(sketch.id);
       }}
     >
       <Trash2 className="h-3.5 w-3.5" />
     </Button>
   </TooltipTrigger>
   <TooltipContent side="top">
     <p>Eliminar</p>
   </TooltipContent>
 </Tooltip>
 </>
 )}
 </>
 )}
 </div>
 </div>
 ))}
 </div>

 <div className="pagination-footer">
 <Pagination
 page={currentPage}
 totalPages={totalPages}
 total={totalCount}
 pageSize={pageSize}
 onPageChange={setPage}
 onPageSizeChange={setPageSize}
 />
 </div>
 </>
 ) : (
 <div className="text-center py-8">
 <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
 <p className="mt-2 app-body text-muted-foreground">
 No hay croquis aún. Dibuja o sube uno.
 </p>
 </div>
 )}
 </div>
 </div>
 );
}
