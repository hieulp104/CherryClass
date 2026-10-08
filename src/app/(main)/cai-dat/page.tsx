import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { listTemplates } from "@/modules/messages/messages.service";
import { SettingsView } from "@/modules/settings/components/settings-view";
import { getSettings } from "@/modules/settings/settings.service";
import { listSiblingGroups } from "@/modules/students/students.service";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  const [settings, templates, groups] = await Promise.all([getSettings(), listTemplates(), listSiblingGroups()]);
  return (
    <SettingsView
      settings={settings}
      templates={templates}
      groups={groups.map((g) => ({
        id: g.id,
        label: g.label,
        discountType: g.discountType,
        discountValue: g.discountValue,
        applyTo: g.applyTo,
        students: g.students.map((s) => ({ id: s.id, fullName: s.fullName, avatarHue: s.avatarHue, classroom: s.classroom.name })),
      }))}
    />
  );
}
