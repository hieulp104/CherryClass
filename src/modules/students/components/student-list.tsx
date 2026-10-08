"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { FileSpreadsheet, HeartHandshake, Search, UserPlus, Users } from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Chip, EmptyState } from "@/components/ui/feedback";
import { CherryDots } from "@/components/ui/fx";
import { PageHeader, Segmented } from "@/components/ui/page";
import type { StudentListItem } from "@/modules/students/students.service";
import { cn, formatVnd } from "@/lib/utils";

export function StudentList({
  students,
  cycleLength,
  classrooms,
  filter,
}: {
  students: StudentListItem[];
  cycleLength: number;
  classrooms: { id: string; name: string; count: number }[];
  filter: { status: "ACTIVE" | "PAUSED" | "LEFT"; classroomId: string; q: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(filter.q);
  const [pending, start] = useTransition();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (q === filter.q) return;
    const t = setTimeout(() => setParam("q", q.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div>
      <PageHeader
        title="Học sinh"
        subtitle={`${students.length} em ${filter.status === "ACTIVE" ? "đang học" : filter.status === "PAUSED" ? "tạm nghỉ" : "đã nghỉ"}`}
        actions={
          <>
            <ButtonLink href="/hoc-sinh/nhap-excel" variant="outline" size="sm">
              <FileSpreadsheet className="size-4" /> Nhập Excel
            </ButtonLink>
            <ButtonLink href="/hoc-sinh/them" size="sm">
              <UserPlus className="size-4" /> Thêm em
            </ButtonLink>
          </>
        }
      />

      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên (gõ không dấu cũng được), SĐT, mã HS…"
            className="min-h-12 w-full rounded-full border border-line bg-surface pl-11 pr-4 shadow-card focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </div>
        <Segmented
          layoutId="cls"
          value={filter.classroomId || "ALL"}
          onChange={(v) => setParam("lop", v === "ALL" ? "" : v)}
          options={[{ value: "ALL", label: "Tất cả" }, ...classrooms.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <Segmented
          layoutId="st"
          value={filter.status}
          onChange={(v) => setParam("trangthai", v === "ACTIVE" ? "" : v)}
          options={[
            { value: "ACTIVE", label: "Đang học" },
            { value: "PAUSED", label: "Tạm nghỉ" },
            { value: "LEFT", label: "Đã nghỉ" },
          ]}
        />
      </div>

      <div className={cn("mt-4 transition-opacity", pending && "opacity-60")}>
        {students.length === 0 ? (
          filter.q ? (
            <EmptyState mood="thinking" title={`Chưa thấy em nào khớp "${filter.q}"`} description="Cô thử gõ ít chữ hơn nhé." />
          ) : (
            <EmptyState
              mood="sleepy"
              title="Chưa có học sinh nào ở đây"
              description="Thêm từng em hoặc nhập cả danh sách từ Excel ạ."
              action={
                <ButtonLink href="/hoc-sinh/nhap-excel">
                  <FileSpreadsheet className="size-4" /> Nhập từ Excel
                </ButtonLink>
              }
            />
          )
        ) : (
          <ul className="grid gap-2.5 md:grid-cols-2">
            {students.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 16) * 0.02 }}
              >
                <Link
                  href={`/hoc-sinh/${s.id}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop active:scale-[0.99]"
                >
                  <StudentAvatar name={s.fullName} hue={s.avatarHue} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-bold">
                      {s.fullName}
                      {s.hardship && <HeartHandshake className="size-4 shrink-0 text-grape" />}
                      {s.siblingGroupId && <Users className="size-3.5 shrink-0 text-sky" aria-label="Có anh chị em" />}
                    </p>
                    <p className="truncate text-caption text-muted">
                      {s.classroom.name}
                      {s.shift ? ` · ${s.shift.name}` : ""} · {s.code}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <CherryDots count={s.counted} cycle={cycleLength} />
                      <span className="text-[11px] font-semibold text-muted tabular">
                        {Math.min(s.counted, cycleLength)}/{cycleLength}
                      </span>
                    </div>
                  </div>
                  {s.balance > 0 && <Chip tone="amber">{formatVnd(s.balance)}</Chip>}
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
