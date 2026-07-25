"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
} from "@/services/email-templates";
import { getActionTemplates } from "@/services/actions";
import { getBusinessLines } from "@/services/catalogs";
import { detectEmailTemplatePlaceholders } from "@/services/email-render";
import { toast } from "sonner";

interface FormState {
  id?: string;
  name: string;
  action_template_id: string;
  business_line_id: string;
  subject: string;
  body: string;
  is_active: boolean;
  sort_order: number;
}

const emptyForm: FormState = {
  name: "",
  action_template_id: "",
  business_line_id: "",
  subject: "",
  body: "",
  is_active: true,
  sort_order: 0,
};

export default function EmailTemplatesPage() {
  const { user, profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates", companyId],
    queryFn: () => getEmailTemplates({ companyId: companyId!, includeInactive: true }),
    enabled: !!companyId,
  });

  const { data: actionTemplates } = useQuery({
    queryKey: ["action-templates", companyId],
    queryFn: () => getActionTemplates(true),
    enabled: !!companyId,
  });

  const { data: businessLines } = useQuery({
    queryKey: ["business-lines"],
    queryFn: () => getBusinessLines(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      if (!companyId) throw new Error("No se detectó la empresa");
      const placeholders = detectEmailTemplatePlaceholders({ subject: data.subject, body: data.body });
      const input: EmailTemplateInput = {
        company_id: companyId,
        action_template_id: data.action_template_id,
        business_line_id: data.business_line_id || null,
        name: data.name,
        subject: data.subject,
        body: data.body,
        detected_placeholders: placeholders,
        is_active: data.is_active,
        sort_order: Number(data.sort_order) || 0,
        created_by: user?.id,
      };
      if (data.id) {
        return updateEmailTemplate(data.id, input);
      }
      return createEmailTemplate(input);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Plantilla actualizada" : "Plantilla creada");
      queryClient.invalidateQueries({ queryKey: ["email-templates", companyId] });
      setForm(emptyForm);
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmailTemplate(id),
    onSuccess: () => {
      toast.success("Plantilla desactivada");
      queryClient.invalidateQueries({ queryKey: ["email-templates", companyId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleEdit = (t: EmailTemplate) => {
    setForm({
      id: t.id,
      name: t.name,
      action_template_id: t.action_template_id,
      business_line_id: t.business_line_id || "",
      subject: t.subject,
      body: t.body,
      is_active: t.is_active,
      sort_order: t.sort_order,
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setIsEditing(false);
  };

  const placeholdersPreview = useMemo(
    () => detectEmailTemplatePlaceholders({ subject: form.subject, body: form.body }),
    [form.subject, form.body]
  );

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-sky-500 to-blue-500">
            <Mail />
          </div>
          <div>
            <h1 className="app-page-title">Plantillas de E-mail</h1>
            <p className="app-body text-muted-foreground">
              Creá y gestioná plantillas de correo vinculadas a acciones y líneas de negocio.
            </p>
          </div>
        </div>
      </div>

      <div className="app-panel">
        <h2 className="app-section-title mb-4">{isEditing ? "Editar Plantilla" : "Nueva Plantilla"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="app-field-label">Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Aviso de asignación — Comercial" />
          </div>
          <div className="space-y-2">
            <Label className="app-field-label">Acción vinculada</Label>
            <select
              className="app-input h-9 w-full text-[13px]"
              value={form.action_template_id}
              onChange={(e) => setForm({ ...form, action_template_id: e.target.value })}
            >
              <option value="">Seleccionar acción...</option>
              {(actionTemplates || []).map((at) => (
                <option key={at.id} value={at.id}>
                  {at.code ? `${at.code} — ` : ""}{at.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="app-field-label">Línea de negocio</Label>
            <select
              className="app-input h-9 w-full text-[13px]"
              value={form.business_line_id}
              onChange={(e) => setForm({ ...form, business_line_id: e.target.value })}
            >
              <option value="">Todas / sin especificar</option>
              {(businessLines || []).map((bl) => (
                <option key={bl.id} value={bl.id}>
                  {bl.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="app-field-label">Orden</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="app-field-label">Asunto</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ej: Asignación de inspector para siniestro [NUM_LIQUIDACION]" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="app-field-label">Cuerpo del e-mail</Label>
            <Textarea
              className="app-input min-h-[120px]"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Estimado [NOMBRE_ASEGURADO], le informamos que ..."
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label className="app-field-label mb-0">Activa</Label>
          </div>
          {placeholdersPreview.length > 0 && (
            <div className="md:col-span-2">
              <p className="app-field-label text-[11px]">Placeholders detectados:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {placeholdersPreview.map((p) => (
                  <span key={p} className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          {isEditing && (
            <Button type="button" variant="outline" className="pg-btn-platinum" onClick={handleCancel}>
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            className="pg-btn-platinum"
            disabled={!form.name || !form.action_template_id || !form.subject || saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? "Actualizar" : <><Plus className="h-4 w-4 mr-1" /> Crear</>}
          </Button>
        </div>
      </div>

      <div className="app-panel mt-4">
        <h2 className="app-section-title mb-4">Plantillas existentes</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (templates || []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay plantillas de e-mail.</p>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Acción</th>
                  <th>Línea de negocio</th>
                  <th>Asunto</th>
                  <th>Activa</th>
                  <th className="w-[80px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(templates || []).map((t) => (
                  <tr key={t.id}>
                    <td className="text-[12px] font-medium">{t.name}</td>
                    <td className="text-[11px]">{t.action_template?.code || t.action_template?.name || "—"}</td>
                    <td className="text-[11px]">{t.business_line?.name || "Todas"}</td>
                    <td className="text-[11px] truncate max-w-[200px]">{t.subject}</td>
                    <td className="text-[11px]">{t.is_active ? "Sí" : "No"}</td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500" onClick={() => deleteMutation.mutate(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
