"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, Moon, Pencil, Plus, RotateCcw, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, EmptyState, Notice } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader, Segmented } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  archiveClassroomAction,
  cancelSessionAction,
  createExtraSessionAction,
  deactivateShiftAction,
  restoreSessionAction,
  saveClassroomAction,
  saveShiftAction,
} from "@/modules/classes/classes.actions";
import type { ClassroomWithShifts } from "@/modules/classes/classes.service";
import { MessageComposer } from "@/modules/messages/components/message-composer";
import type { TemplateItem } from "@/modules/messages/messages.service";
import { addDays, fullDate, shortDate, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Loose<T> = T extends Date ? string : T extends (infer U)[] ? Loose<U>[] : T extends object ? { [K in keyof T]: Loose<T[K]> } : T;
type Classroom = Loose<ClassroomWithShifts>;
type Shift = Classroom["shifts"][number];
type WeekSession = { id: string; date: string; startTime: string; endTime: string; status: string; cancelReason: string | null; label: string; color: string };

const COLORS = ["#E11D48", "#F97316", "#F59E0B", "#16A34A", "#0EA5E9", "#8B5CF6", "#EC4899", "#64748B"];

export function ClassesView({
  classrooms,
  sessions,
  week,
  today,
  initialView,
  templates,
  quietHours,
  teacherName,
}: {
  classrooms: Classroom[];
  sessions: WeekSession[];
  week: string;
  today: string;
  initialView: "classes" | "calendar";
  templates: TemplateItem[];
  quietHours: { from: string; to: string };
  teacherName: string;
}) {
  const [view, setView] = useState(initialView);
  const [classSheet, setClassSheet] = useState<Classroom | "new" | null>(null);
  const [shiftSheet, setShiftSheet] = useState<{ classroom: Classroom; shift?: Shift } | null>(null);

  return (
    <div>
      <PageHeader
        title="Lớp học"
        subtitle={`${classrooms.length} lớp · ${classrooms.reduce((s, c) => s + c.shifts.length, 0)} ca · ${classrooms.reduce((s, c) => s + c._count.students, 0)} em đang học`}
        actions={
          <Button size="sm" onClick={() => setClassSheet("new")}>
            <Plus className="size-4" /> Thêm lớp
          </Button>
        }
      />
      <Segmented
        layoutId="classes-view"
        value={view}
        onChange={setView}
        options={[
          { value: "classes", label: "Lớp & ca" },
          { value: "calendar", label: "Lịch tuần" },
        ]}
        className="mb-4 w-fit"
      />

      <AnimatePresence mode="wait">
        {view === "classes" ? (
          <motion.div key="classes" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
            {classrooms.length === 0 ? (
              <EmptyState
                mood="happy"
                title="Bắt đầu bằng việc tạo lớp đầu tiên"
                description="Ví dụ: Lớp 8, Lớp 9A… Sau đó chia ca và đặt lịch học lặp lại hằng tuần."
                action={<Button onClick={() => setClassSheet("new")}>Tạo lớp</Button>}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {classrooms.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="overflow-hidden">
                      <div className="flex items-center gap-3 p-4" style={{ background: `linear-gradient(135deg, ${c.color}22, transparent 70%)` }}>
                        <span className="grid size-12 place-items-center rounded-[16px] text-lg font-extrabold text-white shadow-md" style={{ background: c.color }}>
                          {c.grade}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-extrabold">{c.name}</p>
                          <p className="text-sm text-muted">
                            Khối {c.grade} · {c._count.students} em · {c.shifts.length} ca
                          </p>
                        </div>
                        <Link href={`/hoc-sinh?lop=${c.id}`} className="grid size-10 place-items-center rounded-full bg-surface text-muted shadow-card" aria-label="Học sinh lớp này">
                          <Users className="size-4" />
                        </Link>
                        <button type="button" onClick={() => setClassSheet(c)} className="grid size-10 place-items-center rounded-full bg-surface text-muted shadow-card" aria-label="Sửa lớp">
                          <Pencil className="size-4" />
                        </button>
                      </div>
                      <ul className="divide-y divide-line border-t border-line">
                        {c.shifts.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => setShiftSheet({ classroom: c, shift: s })}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-subtle"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                  {s.name}
                                  {s.room && <span className="ml-2 text-caption font-normal text-muted">· {s.room}</span>}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {s.schedules.map((sc) => (
                                    <Chip key={sc.id} tone="muted" icon={Clock}>
                                      {WEEKDAY_SHORT[sc.weekday]} {sc.startTime}–{sc.endTime}
                                    </Chip>
                                  ))}
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-muted">{s._count.students} em</span>
                              <ChevronRight className="size-4 text-muted" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setShiftSheet({ classroom: c })}
                        className="flex w-full items-center justify-center gap-2 border-t border-dashed border-line py-3 text-sm font-semibold text-primary hover:bg-primary-soft/40"
                      >
                        <Plus className="size-4" /> Thêm ca
                      </button>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="calendar" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <WeekCalendar
              sessions={sessions}
              week={week}
              today={today}
              classrooms={classrooms}
              templates={templates}
              quietHours={quietHours}
              teacherName={teacherName}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ClassroomSheet value={classSheet} onClose={() => setClassSheet(null)} />
      <ShiftSheet value={shiftSheet} onClose={() => setShiftSheet(null)} />
    </div>
  );
}

// ───── Lớp ─────

function ClassroomSheet({ value, onClose }: { value: Classroom | "new" | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const editing = value && value !== "new" ? value : null;
  const [color, setColor] = useState(editing?.color ?? COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      const res = await saveClassroomAction({ id: editing?.id, name: fd.get("name"), grade: fd.get("grade"), color });
      if (!res.ok) return setError(res.message);
      toast.success(editing ? "Đã lưu lớp" : "Đã tạo lớp mới 🎉");
      onClose();
      router.refresh();
    });

  const archive = () =>
    start(async () => {
      if (!editing) return;
      const res = await archiveClassroomAction(editing.id);
      if (!res.ok) return setError(res.message);
      toast.success("Đã lưu trữ lớp");
      onClose();
      router.refresh();
    });

  return (
    <Sheet open={Boolean(value)} onClose={onClose} title={editing ? `Sửa ${editing.name}` : "Lớp mới"} size="sm">
      <form key={editing?.id ?? "new"} action={submit} className="space-y-4 pb-2">
        <Field label="Tên lớp">
          <Input name="name" defaultValue={editing?.name} required placeholder="vd: Lớp 9A" autoFocus />
        </Field>
        <Field label="Khối">
          <Select name="grade" defaultValue={editing?.grade ?? 9}>
            {[6, 7, 8, 9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Màu lớp">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Màu ${c}`}
                className={cn("size-9 rounded-full transition active:scale-90", color === c && "ring-4 ring-offset-2 ring-offset-surface-raised")}
                style={{ background: c, ["--tw-ring-color" as string]: `${c}66` }}
              />
            ))}
          </div>
        </Field>
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button type="submit" size="lg" block loading={pending}>
          {editing ? "Lưu" : "Tạo lớp"}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" block className="text-overdue" onClick={archive} disabled={pending}>
            <Trash2 className="size-4" /> Lưu trữ lớp
          </Button>
        )}
      </form>
    </Sheet>
  );
}

// ───── Ca ─────

type SlotDraft = { weekday: number; startTime: string; endTime: string };

function ShiftSheet({ value, onClose }: { value: { classroom: Classroom; shift?: Shift } | null; onClose: () => void }) {
  return (
    <Sheet
      open={Boolean(value)}
      onClose={onClose}
      title={value?.shift ? `${value.classroom.name} · ${value.shift.name}` : `Thêm ca cho ${value?.classroom.name ?? ""}`}
      description="Lịch lặp lại hằng tuần — buổi học tự sinh theo lịch này"
      size="md"
    >
      {value && <ShiftForm key={value.shift?.id ?? "new"} classroom={value.classroom} shift={value.shift} onDone={onClose} />}
    </Sheet>
  );
}

function ShiftForm({ classroom, shift, onDone }: { classroom: Classroom; shift?: Shift; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [slots, setSlots] = useState<SlotDraft[]>(
    shift?.schedules.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime })) ?? [{ weekday: 2, startTime: "17:30", endTime: "19:00" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const res = await saveShiftAction({ id: shift?.id, classroomId: classroom.id, name: fd.get("name"), room: fd.get("room"), schedules: slots });
      if (!res.ok) return setError(res.message);
      toast.success("Đã lưu ca — lịch các buổi sắp tới đã cập nhật");
      onDone();
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!shift) return;
      const res = await deactivateShiftAction(shift.id);
      if (!res.ok) return setError(res.message);
      toast.success("Đã ngừng ca này");
      onDone();
      router.refresh();
    });

  return (
    <form action={submit} className="space-y-4 pb-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tên ca">
          <Input name="name" defaultValue={shift?.name ?? `Ca ${classroom.shifts.length + 1}`} required />
        </Field>
        <Field label="Phòng (không bắt buộc)">
          <Input name="room" defaultValue={shift?.room ?? ""} placeholder="Phòng 1" />
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Buổi trong tuần</p>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {slots.map((slot, i) => (
              <motion.li
                key={i}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-control border border-line bg-surface p-3"
              >
                <div className="no-scrollbar flex gap-1 overflow-x-auto">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSlots((list) => list.map((s, j) => (j === i ? { ...s, weekday: d } : s)))}
                      className={cn(
                        "min-w-11 rounded-full px-2.5 py-1.5 text-sm font-bold transition active:scale-90",
                        slot.weekday === d ? "bg-primary text-on-primary" : "bg-surface-subtle text-muted",
                      )}
                    >
                      {WEEKDAY_SHORT[d]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input type="time" value={slot.startTime} onChange={(e) => setSlots((l) => l.map((s, j) => (j === i ? { ...s, startTime: e.target.value } : s)))} className="min-h-10" />
                  <span className="text-muted">→</span>
                  <Input type="time" value={slot.endTime} onChange={(e) => setSlots((l) => l.map((s, j) => (j === i ? { ...s, endTime: e.target.value } : s)))} className="min-h-10" />
                  <button
                    type="button"
                    aria-label="Bỏ buổi này"
                    disabled={slots.length === 1}
                    onClick={() => setSlots((l) => l.filter((_, j) => j !== i))}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:text-overdue disabled:opacity-30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <button
          type="button"
          onClick={() => setSlots((l) => [...l, { weekday: Math.min(7, (l.at(-1)?.weekday ?? 1) + 3), startTime: l.at(-1)?.startTime ?? "17:30", endTime: l.at(-1)?.endTime ?? "19:00" }])}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-line-strong py-2.5 text-sm font-semibold text-primary"
        >
          <Plus className="size-4" /> Thêm buổi trong tuần
        </button>
      </div>
      {shift && <p className="text-caption text-muted">Đổi lịch chỉ ảnh hưởng các buổi sắp tới chưa điểm danh; lịch sử giữ nguyên.</p>}
      {error && <Notice tone="overdue">{error}</Notice>}
      <Button type="submit" size="lg" block loading={pending}>
        Lưu ca
      </Button>
      {shift && (
        <Button type="button" variant="ghost" block className="text-overdue" onClick={remove} disabled={pending}>
          Ngừng ca này
        </Button>
      )}
    </form>
  );
}

// ───── Lịch tuần ─────

function WeekCalendar({
  sessions,
  week,
  today,
  classrooms,
  templates,
  quietHours,
  teacherName,
}: {
  sessions: WeekSession[];
  week: string;
  today: string;
  classrooms: Classroom[];
  templates: TemplateItem[];
  quietHours: { from: string; to: string };
  teacherName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [cancelFor, setCancelFor] = useState<WeekSession | null>(null);
  const [notify, setNotify] = useState<{ lop: string; ngay: string; lyDo: string } | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [pending, start] = useTransition();
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const go = (w: string) => router.push(`${pathname}?xem=lich&tuan=${w}`, { scroll: false });

  const restore = (s: WeekSession) =>
    start(async () => {
      const res = await restoreSessionAction(s.id);
      if (!res.ok) return toast.error(res.message);
      toast.success("Đã khôi phục buổi học");
      router.refresh();
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Tuần trước" onClick={() => go(addDays(week, -7))}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="font-bold">
          {shortDate(days[0])} – {shortDate(days[6])}
        </p>
        <div className="flex gap-2">
          <Button variant="soft" size="sm" onClick={() => setExtraOpen(true)}>
            <CalendarPlus className="size-4" /> Buổi ngoài lịch
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Tuần sau" onClick={() => go(addDays(week, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d, di) => {
          const list = sessions.filter((s) => s.date === d);
          return (
            <motion.div
              key={d}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: di * 0.04 }}
              className={cn("rounded-card border bg-surface p-2.5", d === today ? "border-primary/50 shadow-glow" : "border-line")}
            >
              <p className={cn("mb-2 px-1 text-sm font-bold", d === today && "text-primary")}>
                {WEEKDAY_LONG[di + 1]} <span className="font-normal text-muted">{shortDate(d)}</span>
              </p>
              {list.length === 0 ? (
                <p className="px-1 pb-1 text-caption text-muted">Nghỉ</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((s) => {
                    const cancelled = s.status === "CANCELLED";
                    const done = s.status === "COMPLETED";
                    return (
                      <li key={s.id} className={cn("rounded-[12px] border-l-4 bg-surface-subtle px-2.5 py-2", cancelled && "opacity-60")} style={{ borderColor: s.color }}>
                        <Link href={`/diem-danh/${s.id}`} className="block">
                          <p className={cn("text-sm font-semibold", cancelled && "line-through")}>{s.label}</p>
                          <p className="text-caption text-muted tabular">
                            {s.startTime}–{s.endTime} {done && "· ✓"}
                          </p>
                        </Link>
                        {cancelled ? (
                          <button type="button" onClick={() => restore(s)} disabled={pending} className="mt-1 inline-flex items-center gap-1 text-caption font-semibold text-primary">
                            <RotateCcw className="size-3" /> {s.cancelReason} · khôi phục
                          </button>
                        ) : (
                          !done && (
                            <button type="button" onClick={() => setCancelFor(s)} className="mt-1 inline-flex items-center gap-1 text-caption font-semibold text-muted hover:text-overdue">
                              <Moon className="size-3" /> Cho nghỉ
                            </button>
                          )
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          );
        })}
      </div>

      <CancelSheet
        session={cancelFor}
        onClose={() => setCancelFor(null)}
        onCancelled={(reason) => {
          if (cancelFor) setNotify({ lop: cancelFor.label.split(" · ")[0], ngay: `${WEEKDAY_LONG[days.indexOf(cancelFor.date) + 1] ?? ""} ${fullDate(cancelFor.date)}`.trim(), lyDo: reason.toLowerCase() });
          setCancelFor(null);
        }}
      />
      {notify && (
        <MessageComposer
          open
          onClose={() => setNotify(null)}
          kinds={["SESSION_CANCELLED"]}
          initialKind="SESSION_CANCELLED"
          templates={templates}
          quietHours={quietHours}
          vars={{ ...notify, tenCo: teacherName }}
        />
      )}
      <ExtraSessionSheet open={extraOpen} onClose={() => setExtraOpen(false)} classrooms={classrooms} defaultDate={today} />
    </div>
  );
}

const CANCEL_REASONS = ["Nghỉ lễ", "Cô bị ốm", "Cô có việc gia đình", "Trùng lịch thi ở trường", "Mất điện"];

function CancelSheet({ session, onClose, onCancelled }: { session: WeekSession | null; onClose: () => void; onCancelled: (reason: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (!session) return;
      const res = await cancelSessionAction({ sessionId: session.id, reason });
      if (!res.ok) return setError(res.message);
      toast.success("Đã cho nghỉ — buổi này không tính học phí");
      onCancelled(reason);
      setReason("");
      router.refresh();
    });
  return (
    <Sheet open={Boolean(session)} onClose={onClose} title="Cho lớp nghỉ buổi này" description={session ? `${session.label} · ${fullDate(session.date)} ${session.startTime}` : ""} size="sm">
      <div className="space-y-4 pb-2">
        <div className="flex flex-wrap gap-2">
          {CANCEL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn("rounded-full border px-3 py-2 text-sm font-semibold active:scale-95", reason === r ? "border-primary bg-primary-soft text-primary-deep" : "border-line")}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Lý do">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <p className="text-caption text-muted">Sau khi cho nghỉ, em soạn sẵn tin báo phụ huynh để cô gửi.</p>
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button size="lg" block loading={pending} disabled={!reason.trim()} onClick={submit}>
          <Moon className="size-4" /> Cho nghỉ
        </Button>
      </div>
    </Sheet>
  );
}

function ExtraSessionSheet({ open, onClose, classrooms, defaultDate }: { open: boolean; onClose: () => void; classrooms: Classroom[]; defaultDate: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shifts = classrooms.flatMap((c) => c.shifts.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` })));
  const submit = (fd: FormData) =>
    start(async () => {
      const res = await createExtraSessionAction({
        shiftId: fd.get("shiftId"),
        date: fd.get("date"),
        startTime: fd.get("startTime"),
        endTime: fd.get("endTime"),
      });
      if (!res.ok) return setError(res.message);
      toast.success("Đã thêm buổi học");
      onClose();
      router.push(`/diem-danh/${res.data.id}`);
    });
  return (
    <Sheet open={open} onClose={onClose} title="Thêm buổi ngoài lịch" description="Học bù cả ca, dạy tăng cường…" size="sm">
      <form action={submit} className="space-y-4 pb-2">
        <Field label="Ca">
          <Select name="shiftId" required>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ngày">
          <Input type="date" name="date" defaultValue={defaultDate} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bắt đầu">
            <Input type="time" name="startTime" defaultValue="17:30" required />
          </Field>
          <Field label="Kết thúc">
            <Input type="time" name="endTime" defaultValue="19:00" required />
          </Field>
        </div>
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button type="submit" size="lg" block loading={pending}>
          <MapPin className="size-4" /> Thêm & mở điểm danh
        </Button>
      </form>
    </Sheet>
  );
}
