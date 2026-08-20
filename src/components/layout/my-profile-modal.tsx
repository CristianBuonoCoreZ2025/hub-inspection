"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { User, Upload, X } from "lucide-react";
import { uploadFileToStorage } from "@/lib/supabase/storage-upload";

/**
 * Modal "Mi Perfil" — el usuario autenticado edita SOLO:
 *   - avatar (foto, subida a R2 igual que el logo de empresa)
 *   - teléfono
 *   - RUT (con validación de DV si es Chile + unicidad)
 *
 * No puede tocar: email, rol, nombre, apellido, país, clientes.
 */
export function MyProfileModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { profile } = useAuth();

  // Key basado solo en `open`: cuando el modal se abre, el componente interior
  // monta fresco con el profile actual (useState se inicializa con los valores
  // más recientes). Cuando se cierra, desmonta. Después de un guardado,
  // onSuccess cierra el modal + invalida la cache; la próxima vez que se abre,
  // el profile ya tiene los datos actualizados.
  // NO incluir datos del profile en el key: eso causa remounts durante el
  // render cuando la cache se invalida, disparando setState en componentes
  // que escuchan el QueryClient (GlobalLoadingOverlay).
  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-sm" showCloseButton={false}>
        {open && <MyProfileInner key="profile-inner" profile={profile} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function MyProfileInner({
  profile,
  onOpenChange,
}: {
  profile: ReturnType<typeof useAuth>["profile"];
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(profile?.phone || "");
  const [rut, setRut] = useState(profile?.rut || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (input: { phone?: string; rut?: string; avatar_url?: string }) => {
      const res = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al actualizar perfil");
      return result;
    },
    onSuccess: () => {
      toast.success("Perfil actualizado");
      // Invalidar la cache de useAuth para que el profile se refresque
      // en la topbar y en cualquier componente que lo use.
      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      phone,
      rut,
      avatar_url: avatarUrl,
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop()?.toLowerCase() : "";
      const avatarPath = `avatars/${profile?.user_id}/avatar${ext}`;
      const url = await uploadFileToStorage(file, avatarPath);
      setAvatarUrl(url);
      toast.success("Foto subida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const getInitials = (email?: string | null) => {
    if (!email) return "U";
    const parts = email.split("@")[0].split(/[._-]/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <>
      <div className="modal-header">
        <DialogTitle className="modal-title flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
            <User className="h-4 w-4" />
          </div>
          Mi Perfil
        </DialogTitle>
        <DialogDescription className="modal-subtitle">
          Actualiza tu foto, teléfono y RUT. El resto lo gestiona el administrador.
        </DialogDescription>
      </div>

      <div className="modal-body">
        {/* Avatar + subida (mismo patrón que el logo de empresa) */}
        <div className="my-profile-avatar-section">
          <div className="my-profile-avatar-wrap">
            <Avatar size="lg">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={profile?.full_name || "Avatar"} />
              ) : null}
              <AvatarFallback className="bg-primary/20 text-primary text-base border border-primary/20">
                {getInitials(profile?.email)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="my-profile-avatar-actions">
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarUpload}
            />
            <label htmlFor="avatar-upload" className="cursor-pointer">
              <span className="my-profile-upload-btn">
                <Upload className="mr-1.5 h-3 w-3" />
                {avatarUploading ? "Subiendo..." : "Subir foto"}
              </span>
            </label>
            {avatarUrl && (
              <button
                type="button"
                className="my-profile-remove-btn"
                onClick={() => setAvatarUrl("")}
              >
                <X className="h-3 w-3" />
                Quitar
              </button>
            )}
          </div>
        </div>

        <div className="modal-grid">
          {/* Datos no editables (informativos) */}
          <div className="modal-field modal-field-full">
            <Label className="app-field-label">Nombre</Label>
            <Input className="app-input" value={profile?.full_name || ""} disabled />
          </div>
          <div className="modal-field modal-field-full">
            <Label className="app-field-label">Email</Label>
            <Input className="app-input" value={profile?.email || ""} disabled />
          </div>

          {/* Datos editables */}
          <div className="modal-field">
            <Label className="app-field-label">Teléfono</Label>
            <Input
              className="app-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+56 9 1234 5678"
            />
          </div>
          <div className="modal-field">
            <Label className="app-field-label">RUT</Label>
            <Input
              className="app-input"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12.345.678-9"
            />
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="pg-btn-platinum" onClick={() => onOpenChange(false)}>
          Cancelar
        </button>
        <button
          type="button"
          className="pg-btn-platinum"
          disabled={updateMutation.isPending}
          onClick={handleSave}
        >
          {updateMutation.isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </>
  );
}
