import { DEFAULT_TEMPLATES, type MessageKind } from "@/modules/messages/messages.templates";
import { prisma } from "@/shared/prisma/prisma.service";

export type TemplateItem = { id: string | null; kind: MessageKind; title: string; body: string };

/** Mẫu của cô (DB); loại nào chưa có trong DB thì lấy mẫu mặc định. */
export async function listTemplates(): Promise<TemplateItem[]> {
  const rows = await prisma.messageTemplate.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  const kindsInDb = new Set(rows.map((r) => r.kind));
  return [
    ...rows.map((r) => ({ id: r.id, kind: r.kind as MessageKind, title: r.title, body: r.body })),
    ...DEFAULT_TEMPLATES.filter((t) => !kindsInDb.has(t.kind)).map((t) => ({ id: null, ...t })),
  ];
}
