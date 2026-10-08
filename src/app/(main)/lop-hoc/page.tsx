import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { listClassrooms, weekSessions } from "@/modules/classes/classes.service";
import { ClassesView } from "@/modules/classes/components/classes-view";
import { listTemplates } from "@/modules/messages/messages.service";
import { getSettings } from "@/modules/settings/settings.service";
import { addDays, todayKey, weekdayOf } from "@/lib/dates";

export const metadata: Metadata = { title: "Lớp học" };

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ tuan?: string; xem?: string }> }) {
  await requirePagePermission("class.manage");
  const sp = await searchParams;
  const today = todayKey();
  const monday = addDays(today, 1 - weekdayOf(today));
  const week = sp.tuan && /^\d{4}-\d{2}-\d{2}$/.test(sp.tuan) ? addDays(sp.tuan, 1 - weekdayOf(sp.tuan)) : monday;
  const [classrooms, sessions, templates, settings] = await Promise.all([
    listClassrooms(),
    weekSessions(week),
    listTemplates(),
    getSettings(),
  ]);
  return (
    <ClassesView
      classrooms={JSON.parse(JSON.stringify(classrooms))}
      sessions={sessions}
      week={week}
      today={today}
      initialView={sp.xem === "lich" ? "calendar" : "classes"}
      templates={templates}
      quietHours={settings.quietHours}
      teacherName={settings.teacherName}
    />
  );
}
