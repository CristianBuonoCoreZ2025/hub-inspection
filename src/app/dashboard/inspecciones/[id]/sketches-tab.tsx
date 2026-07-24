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

export default function SketchesTab({ sessionId, sessionStatus, magicLinkToken }: { sessionId: string; sessionStatus?: string; magicLinkToken?: string }) {
 const queryClient = useQueryClient();
 const [uploading, setUploading] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editingLabel, setEditingLabel] = useState("");
 const [mode, setMode] = useState<"view" | "upload" | "draw">("view");
 const [drawEditingSketch, setDrawEditingSketch] = useState<{ id: string; url: string; label: string } | null>(null);
 const [savingDrawing, setSavingDrawing] = useState(false);
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
 mutationFn: async (data: { sessionId: string; sketchDataUrl: string; label: string; sketchId?: string }) => {
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

 function handleSaveDrawing(dataUrl: string) {
 setSavingDrawing(true);
 sketchMutation.mutate(
 {
 sessionId,
 sketchDataUrl: dataUrl,
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

 // Modo dibujo
 if (mode === "draw") {
 return (
 <div className="app-stack">
 <div className="flex items-center justify-between">
 <h3 className="app-section-title flex items-center gap-2">
 <PenTool className="h-4 w-4" />
 {drawEditingSketch ? "Editar Croquis" : "Dibujar Croquis"}
 </h3>
 <Button variant="outline" size="sm" onClick={() => { setMode("view"); setDrawEditingSketch(null); }}>
 <X className="h-3.5 w-3.5 mr-1" /> Cancelar
 </Button>
 </div>
 <div className="app-panel">
 <DrawingCanvas
 onSave={handleSaveDrawing}
 saving={savingDrawing}
 initialImage={drawEditingSketch?.url}
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

 {/* Botones de acción (ocultos si readOnly) */}
 {!readOnly && (
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 onClick={() => setMode("draw")}
 className="pg-btn-platinum-icon"
 >
 <PenTool className="h-4 w-4" />
 Dibujar
 </Button>
 <Button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="pg-btn-platinum-icon"
 >
 <Upload className="h-4 w-4" />
 Subir
 </Button>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleInput}
 multiple
 />
 </div>
 )}

 {uploading && <p className="app-body text-muted-foreground">Subiendo...</p>}

 {/* Grid */}
 {sketches && sketches.length > 0 ? (
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
 {sketches.map((sketch) => (
 <div key={sketch.id} className="app-panel space-y-3">
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
 className="h-8 w-8"
 onClick={() => saveEdit(sketch.id)}
 >
 <Check className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8"
 onClick={() => setEditingId(null)}
 >
 <X className="h-4 w-4" />
 </Button>
 </>
 ) : (
 <>
 <span className="flex-1 truncate app-body font-medium">
 {sketch.label || "Sin título"}
 </span>
 {!readOnly && (
 <>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8"
 title="Dibujar / Editar"
 onClick={() => {
 setDrawEditingSketch({ id: sketch.id, url: sketch.sketch_url, label: sketch.label || "" });
 setMode("draw");
 }}
 >
 <PenTool className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8"
 title="Renombrar"
 onClick={() => startEdit(sketch)}
 >
 <Pencil className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-rose-500"
 onClick={() => {
 if (confirm("¿Eliminar este croquis?")) {
 deleteMutation.mutate(sketch.id);
 }
 }}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </>
 )}
 </>
 )}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="app-panel text-center py-8">
 <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
 <p className="mt-2 app-body text-muted-foreground">
 No hay croquis aún. Dibuja o sube uno.
 </p>
 </div>
 )}
 </div>
 );
}
