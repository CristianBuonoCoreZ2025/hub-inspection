import { z } from "zod";
import { validateRut } from "./rut-validator";

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Nombre completo requerido"),
    email: z.string().email("Correo electrónico inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
    companyName: z.string().min(2, "Nombre de empresa requerido"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const claimSchema = z.object({
  claimNumber: z.string().min(1, "Número de siniestro requerido"),
  policyNumber: z.string().min(1, "Número de póliza requerido"),
  insuranceCompany: z.string().optional(),
  insuredName: z.string().min(1, "Nombre del asegurado requerido"),
  lastName: z.string().optional(),
  rut: z.string().optional().or(z.literal("")),
  insuredEmail: z.string().email("Correo inválido").optional().or(z.literal("")),
  insuredPhone: z.string().optional(),
  cellPhone: z.string().optional(),
  address: z.string().min(1, "Dirección requerida"),
  city: z.string().min(1, "Ciudad requerida"),
  commune: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional().default("Chile"),
  claimDate: z.string().min(1, "Fecha del siniestro requerida"),
  reportDate: z.string().optional().or(z.literal("")),
  assignmentDate: z.string().optional().or(z.literal("")),
  claimType: z.string().min(1, "Tipo de siniestro requerido"),
  claimCause: z.string().optional(),
  summary: z.string().optional(),
  assignedAdjusterId: z.string().optional(),
  inspectorId: z.string().optional(),
  adjusterId: z.string().optional(),
  auditorId: z.string().optional(),
  dispatcherId: z.string().optional(),
  assistantId: z.string().optional(),
  brokerName: z.string().optional(),
  brokerExecutive: z.string().optional(),
  brokerNumber: z.string().optional(),
  builderName: z.string().optional(),
  advisor: z.string().optional(),
  internalNumber: z.string().optional(),
  companyReportNumber: z.string().optional(),
  mclarensOneNumber: z.string().optional(),
  liquidationNumber: z.string().optional(),
  isSpecialClaim: z.boolean().optional().default(false),
  recoveryTypeLegal: z.string().optional(),
  recoveryTypeMaterial: z.string().optional(),
  recoveryComments: z.string().optional(),
  companyId: z.string().min(1, "Empresa requerida"),
  notes: z.string().optional(),
});

export type ClaimInput = z.infer<typeof claimSchema>;

export const companySchema = z
  .object({
    name: z.string().min(1, "Nombre requerido"),
    slug: z.string().optional(),
    countryId: z.string().min(1, "País requerido"),
    rut: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    email: z.string().email("Correo inválido").optional().or(z.literal("")),
    logoUrl: z.string().optional().or(z.literal("")),
    primaryColor: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      // Validar RUT solo si el país es Chile (code CL)
      if (!data.rut || data.rut.trim() === "") return true;
      return validateRut(data.rut);
    },
    {
      message: "RUT inválido",
      path: ["rut"],
    }
  );

export type CompanyInput = z.infer<typeof companySchema>;

export const inviteUserSchema = z.object({
  email: z.string().email("Correo inválido"),
  fullName: z.string().min(1, "Nombre requerido"),
  role: z.enum(["admin", "supervisor", "adjuster", "inspector", "client"]),
  companyId: z.string().optional(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
