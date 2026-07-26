"use client";

import { useParams } from "next/navigation";
import { EmailTemplateEditor } from "../components/EmailTemplateEditor";

export default function EditEmailTemplatePage() {
  const params = useParams<{ id: string }>();
  return <EmailTemplateEditor templateId={params.id} />;
}
