const fs = require("fs");
const path = require("path");

const formPath = path.join(__dirname, "..", "src", "app", "dashboard", "claims", "[id]", "edit-claim-form.tsx");
const validationsPath = path.join(__dirname, "..", "src", "lib", "validations.ts");

const formContent = fs.readFileSync(formPath, "utf8");

const match = formContent.match(/interface FormValues \{([\s\S]*?)\n\}/);
if (!match) {
  console.error("❌ No se encontró interface FormValues");
  process.exit(1);
}
const block = match[1];

const fields = block
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("//"))
  .map((l) => {
    const m = l.match(/^([a-zA-Z][a-zA-Z0-9_]*):\s*([^;]+);?$/);
    if (!m) return null;
    return { name: m[1], type: m[2].trim() };
  })
  .filter(Boolean);

const zodLines = fields.map((f) => {
  let schema = "z.string()";
  if (f.type === "boolean") schema = "z.boolean()";
  else if (f.type === "boolean | undefined") schema = "z.boolean().optional()";
  else if (f.type === "number | undefined") schema = "z.number().optional()";
  else if (f.type === "string | undefined") schema = "z.string().optional()";
  return `  ${f.name}: ${schema},`;
});

const schemaBlock = `\n// ═══════════════════════════════════════════════════════════════\n// EDITAR SINIESTRO\n// ═══════════════════════════════════════════════════════════════\n\nexport const editClaimSchema = z.object({\n${zodLines.join("\n")}\n});\n\nexport type EditClaimInput = z.infer<typeof editClaimSchema>;\n`;

fs.appendFileSync(validationsPath, schemaBlock);
console.log(`✅ Appended editClaimSchema con ${fields.length} campos a src/lib/validations.ts`);

let newForm = formContent.replace(/interface FormValues \{[\s\S]*?\n\}/, "type FormValues = EditClaimInput;");

const importBlock = `import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";\nimport { editClaimSchema, type EditClaimInput } from "@/lib/validations";`;
newForm = newForm.replace(/"use client";\n/, `"use client";\n\n${importBlock}\n`);

newForm = newForm.replace(
  /const form = useForm<FormValues>\(\{\n(\s+)defaultValues:/,
  'const form = useForm<FormValues>({\n$1resolver: standardSchemaResolver(editClaimSchema),\n$1defaultValues:'
);

fs.writeFileSync(formPath, newForm);
console.log("✅ Actualizado src/app/dashboard/claims/[id]/edit-claim-form.tsx");
