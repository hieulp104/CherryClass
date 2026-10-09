import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/common/guards/page.guard";
import { getGradingQueue } from "@/modules/assignments/assignments.service";
import { GradingView } from "@/modules/assignments/components/grading-view";
import { getSettings } from "@/modules/settings/settings.service";

export const metadata: Metadata = { title: "Chấm bài" };

export default async function GradingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bai?: string }> }) {
  await requirePagePermission("assignment.manage");
  const [{ id }, { bai }] = await Promise.all([params, searchParams]);
  const [queue, settings] = await Promise.all([getGradingQueue(id), getSettings()]);
  if (!queue) notFound();
  return <GradingView key={id} queue={queue} initialId={bai} quickComments={settings.gradingComments} />;
}
