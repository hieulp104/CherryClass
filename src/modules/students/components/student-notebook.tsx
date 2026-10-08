"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  Cake,
  CalendarDays,
  ChevronRight,
  HeartHandshake,
  MessageCircleHeart,
  Minus,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  School,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, InvoiceStateChip, Notice } from "@/components/ui/feedback";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { CherryConfetti, CherryProgress, CountUp } from "@/components/ui/fx";
import { PageHeader, Segmented, SectionTitle } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { adjustCounterAction } from "@/modules/billing/billing.actions";
import { RecordPaymentSheet } from "@/modules/billing/components/payment-sheets";
import { MessageComposer } from "@/modules/messages/components/message-composer";
import type { TemplateItem } from "@/modules/messages/messages.service";
import { parentAddress, type MessageKind } from "@/modules/messages/messages.templates";
import { StudentForm, type ClassroomOption } from "@/modules/students/components/student-form";
import { addNoteAction, deleteNoteAction, setHardshipAction, setStudentStatusAction } from "@/modules/students/students.actions";
import type { StudentNotebook } from "@/modules/students/students.service";
import { fullDate, shortDate, todayKey } from "@/lib/dates";
import { cn, formatDate, formatRelativeTime, formatVnd, givenName } from "@/lib/utils";

type Loose<T> = T extends Date ? string : T extends (infer U)[] ? Loose<U>[] : T extends object ? { [K in keyof T]: Loose<T[K]> } : T;
type Data = Loose<StudentNotebook>;

const STATUS_META = {
  ACTIVE: { label: "Đang học", tone: "leaf" as const },
  PAUSED: { label: "Tạm nghỉ", tone: "amber" as const },
  LEFT: { label: "Đã nghỉ", tone: "muted" as const },
};

export function StudentNotebookView({
  data,
  classrooms,
  templates,
  teacherName,
  quietHours,
  defaultPrice,
  openMessage,
}: {
  data: Data;
  classrooms: ClassroomOption[];
  templates: TemplateItem[];
  teacherName: string;
  quietHours: { from: string; to: string };
  defaultPrice: number;
  openMessage?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { student, cycle } = data;
  // ?nhan=... (từ trang Hôm nay) mở sẵn khung soạn tin.
  const [msgKind, setMsgKind] = useState<MessageKind | null>(() =>
    openMessage === "ABSENCE_CHECK" || openMessage === "BIRTHDAY" || openMessage === "PRAISE" ? openMessage : null,
  );
  const [editing, setEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [hardship, setHardship] = useState(student.hardship);
  const [, start] = useTransition();

  const full = cycle.count >= cycle.length;
  const sessionRows = data.attendances.filter((a) => a.source === "SESSION").slice(0, 40);

  return (
    <div>
      <CherryConfetti fire={confetti} />
      <PageHeader back="/hoc-sinh" title="Sổ tay học sinh" />

      {/* Đầu sổ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <div className="bg-soft flex flex-wrap items-center gap-4 p-5">
            <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
              <StudentAvatar name={student.fullName} hue={student.avatarHue} size={76} />
            </motion.div>
            <div className="min-w-0 flex-1">
              <h1 className="text-h1 font-extrabold tracking-tight">{student.fullName}</h1>
              <p className="text-muted">
                {student.classroom.name}
                {student.shift ? ` · ${student.shift.name}` : " · chưa xếp ca"} · {student.code}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip tone={STATUS_META[student.status].tone}>{STATUS_META[student.status].label}</Chip>
                {hardship && (
                  <Chip tone="grape" icon={HeartHandshake}>
                    Gia đình khó khăn
                  </Chip>
                )}
                {student.siblingGroup && (
                  <Chip tone="sky" icon={Users}>
                    {student.siblingGroup.label}
                  </Chip>
                )}
                <Chip tone="muted">{data.usesDefaultPrice ? `${formatVnd(data.unitPrice)}/buổi` : `Giá riêng ${formatVnd(data.unitPrice)}/buổi`}</Chip>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Sửa
            </Button>
          </div>

          {/* Chu kỳ */}
          <div className="border-t border-line p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">Chu kỳ hiện tại</p>
              <button type="button" onClick={() => setCounterOpen(true)} className="text-sm font-semibold text-primary">
                Sửa bộ đếm
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <CherryProgress count={cycle.count} cycle={cycle.length} size={28} glow={full} />
              <span className="text-2xl font-extrabold tabular">
                {Math.min(cycle.count, cycle.length)}
                <span className="text-muted">/{cycle.length}</span>
              </span>
            </div>
            {cycle.dates.length > 0 && (
              <p className="mt-2 text-caption text-muted">Đã học: {cycle.dates.map(shortDate).join(", ")}</p>
            )}
          </div>
        </Card>
      </motion.section>

      {/* Hành động nhanh */}
      <section className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <QuickAction icon={Sparkles} label="Khen con" tone="text-amber" onClick={() => setMsgKind("PRAISE")} />
        <QuickAction icon={MessageCircleHeart} label="Hỏi thăm" tone="text-grape" onClick={() => setMsgKind("ABSENCE_CHECK")} />
        <QuickAction icon={Cake} label="Chúc sinh nhật" tone="text-primary" onClick={() => setMsgKind("BIRTHDAY")} />
        <QuickAction icon={Wallet} label="Ghi nhận thu" tone="text-leaf" onClick={() => setPayOpen(true)} />
        <QuickAction icon={UserCog} label="Trạng thái" tone="text-sky" onClick={() => setStatusOpen(true)} />
      </section>

      <div className="mt-2 grid gap-5 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <div>
          {/* Chỉ số */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-sm font-semibold text-muted">Chuyên cần (30 buổi gần nhất)</p>
              <p className="mt-2 text-3xl font-extrabold text-leaf">
                {data.presentRate === null ? "—" : <CountUp value={Math.round(data.presentRate * 100)} format={(n) => `${n}%`} />}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-semibold text-muted">{data.balance >= 0 ? "Còn cần đóng" : "Đóng thừa"}</p>
              <p className={cn("mt-2 text-3xl font-extrabold tabular", data.balance > 0 ? "text-amber" : "text-leaf")}>
                <CountUp value={Math.abs(data.balance)} format={formatVnd} />
              </p>
            </Card>
          </div>

          {/* Lịch sử chuyên cần */}
          <SectionTitle>Lịch sử đi học</SectionTitle>
          <Card className="p-4">
            {sessionRows.length === 0 ? (
              <p className="text-center text-sm text-muted">Chưa có buổi nào.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {[...sessionRows].reverse().map((a, i) => (
                    <motion.span
                      key={a.id}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.012 }}
                      title={`${fullDate(a.date)} · ${a.status === "PRESENT" ? "Có mặt" : a.status === "EXCUSED" ? "Vắng có phép" : "Vắng không phép"}${a.note ? ` · ${a.note}` : ""}`}
                      className={cn(
                        "grid size-7 place-items-center rounded-[9px] text-[10px] font-bold",
                        a.status === "PRESENT" && "bg-leaf-soft text-leaf",
                        a.status === "EXCUSED" && "bg-amber-soft text-amber",
                        a.status === "UNEXCUSED" && "bg-overdue-soft text-overdue",
                        a.isMakeup && "ring-2 ring-sky",
                      )}
                    >
                      {a.date.slice(8, 10)}
                    </motion.span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-caption text-muted">
                  <Legend className="bg-leaf-soft" label="Có mặt" />
                  <Legend className="bg-amber-soft" label="Vắng có phép" />
                  <Legend className="bg-overdue-soft" label="Vắng không phép" />
                  <Legend className="ring-2 ring-sky" label="Học bù" />
                </div>
                {data.attendances.some((a) => a.note) && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {data.attendances
                      .filter((a) => a.note)
                      .slice(0, 5)
                      .map((a) => (
                        <li key={a.id} className="text-muted">
                          <b className="text-foreground">{shortDate(a.date)}</b> · {a.note}
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </Card>

          {/* Phiếu thu */}
          <SectionTitle>Phiếu thu</SectionTitle>
          {data.invoices.length === 0 ? (
            <Card variant="outline" className="p-5 text-center text-sm text-muted">
              Chưa có phiếu nào — đủ {cycle.length} buổi là em tự tạo ạ.
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {data.invoices.map((inv) => (
                <Link key={inv.id} href={`/thu-tien/${inv.id}`} className="flex items-center gap-3 p-4 transition hover:bg-surface-subtle">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {inv.code} · {inv.sessionCount} buổi
                    </p>
                    <p className="text-caption text-muted">{formatDate(inv.issuedAt)}</p>
                  </div>
                  <InvoiceStateChip state={inv.state} />
                  <span className="w-24 text-right font-bold tabular">{formatVnd(inv.amount)}</span>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
              ))}
            </Card>
          )}
        </div>

        <div>
          {/* Thông tin */}
          <SectionTitle>Thông tin</SectionTitle>
          <Card className="space-y-3 p-4 text-sm">
            <Info icon={Phone} label="Phụ huynh">
              {student.parentName ?? "—"}
              {student.parentPhone && (
                <a href={`tel:${student.parentPhone}`} className="ml-2 font-semibold text-primary">
                  {student.parentPhone}
                </a>
              )}
            </Info>
            {student.studentPhone && (
              <Info icon={Phone} label="SĐT con">
                <a href={`tel:${student.studentPhone}`} className="font-semibold text-primary">
                  {student.studentPhone}
                </a>
              </Info>
            )}
            <Info icon={Cake} label="Ngày sinh">
              {student.dob ? fullDate(student.dob) : "—"}
            </Info>
            <Info icon={School} label="Trường">
              {student.school ?? "—"}
            </Info>
            <Info icon={CalendarDays} label="Bắt đầu học">
              {fullDate(student.joinedAt)}
            </Info>
            {student.siblingGroup && (
              <Info icon={Users} label="Anh chị em">
                {student.siblingGroup.students
                  .filter((s) => s.id !== student.id)
                  .map((s) => (
                    <Link key={s.id} href={`/hoc-sinh/${s.id}`} className="mr-2 font-semibold text-primary">
                      {s.fullName}
                    </Link>
                  ))}
              </Info>
            )}
          </Card>

          {/* Riêng tư */}
          <SectionTitle>Riêng tư — chỉ cô thấy</SectionTitle>
          <Card className="space-y-4 p-4">
            <Switch
              checked={hardship}
              onChange={(v) => {
                setHardship(v);
                start(async () => {
                  const res = await setHardshipAction(student.id, v);
                  if (!res.ok) {
                    setHardship(!v);
                    toast.error(res.message);
                  } else toast.success(v ? "App sẽ luôn chọn giọng nhắc nhẹ nhất cho em" : "Đã bỏ đánh dấu");
                });
              }}
              label="Gia đình khó khăn"
              description="Tin nhắc học phí luôn dùng giọng nhẹ nhất"
            />
            <NotesBox studentId={student.id} notes={student.notes} />
          </Card>
        </div>
      </div>

      {/* ───── Sheets ───── */}
      {msgKind && (
        <MessageComposer
          open
          onClose={() => setMsgKind(null)}
          kinds={["PRAISE", "ABSENCE_CHECK", "BIRTHDAY"]}
          initialKind={msgKind}
          templates={templates}
          quietHours={quietHours}
          studentId={student.id}
          vars={{
            tenPhuHuynh: parentAddress(student.parentName),
            tenCon: givenName(student.fullName),
            hoTenCon: student.fullName,
            lop: student.classroom.name,
            tenCo: teacherName,
            ngay: fullDate(todayKey()),
          }}
        />
      )}
      <Sheet open={editing} onClose={() => setEditing(false)} title="Sửa thông tin" size="lg">
        <StudentForm
          classrooms={classrooms}
          defaultPrice={defaultPrice}
          initial={{
            id: student.id,
            fullName: student.fullName,
            classroomId: student.classroom.id,
            shiftId: student.shift?.id ?? null,
            dob: student.dob,
            joinedAt: student.joinedAt,
            school: student.school,
            parentName: student.parentName,
            parentPhone: student.parentPhone,
            studentPhone: student.studentPhone,
            unitPrice: student.unitPrice,
          }}
          onSaved={() => setEditing(false)}
        />
      </Sheet>
      <StatusSheet open={statusOpen} onClose={() => setStatusOpen(false)} studentId={student.id} current={student.status} />
      <CounterSheet open={counterOpen} onClose={() => setCounterOpen(false)} studentId={student.id} onIssued={() => setConfetti((n) => n + 1)} />
      <RecordPaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        studentId={student.id}
        suggested={Math.max(0, data.balance)}
        onRecorded={() => {
          setConfetti((n) => n + 1);
          router.refresh();
        }}
      />
    </div>
  );
}

function QuickAction({ icon: Icon, label, tone, onClick }: { icon: typeof Sparkles; label: string; tone: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-card"
    >
      <Icon className={cn("size-4", tone)} /> {label}
    </motion.button>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[4px]", className)} /> {label}
    </span>
  );
}

function Info({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function NotesBox({ studentId, notes }: { studentId: string; notes: { id: string; content: string; createdAt: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 font-semibold">
        <NotebookPen className="size-4 text-muted" /> Ghi chú về hoàn cảnh, tính cách…
      </p>
      <div className="flex gap-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Chỉ cô xem được, không bao giờ hiện cho phụ huynh" className="min-h-0" />
        <Button
          size="icon"
          aria-label="Thêm ghi chú"
          loading={pending}
          disabled={!text.trim()}
          onClick={() =>
            start(async () => {
              const res = await addNoteAction({ studentId, content: text });
              if (!res.ok) return toast.error(res.message);
              setText("");
              router.refresh();
            })
          }
        >
          {!pending && <Plus className="size-5" />}
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {notes.map((n) => (
          <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group flex items-start gap-2 rounded-control bg-surface-subtle px-3 py-2">
            <p className="min-w-0 flex-1 text-sm">
              {n.content}
              <span className="ml-2 text-caption text-muted">{formatRelativeTime(n.createdAt)}</span>
            </p>
            <button
              type="button"
              aria-label="Xóa ghi chú"
              onClick={() =>
                start(async () => {
                  await deleteNoteAction(n.id);
                  router.refresh();
                })
              }
              className="text-muted hover:text-overdue"
            >
              <Trash2 className="size-4" />
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function StatusSheet({ open, onClose, studentId, current }: { open: boolean; onClose: () => void; studentId: string; current: "ACTIVE" | "PAUSED" | "LEFT" }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const choose = (status: "ACTIVE" | "PAUSED" | "LEFT") =>
    start(async () => {
      const res = await setStudentStatusAction({ studentId, status });
      if (!res.ok) return toast.error(res.message);
      toast.success(`Đã chuyển sang "${STATUS_META[status].label}"`);
      onClose();
      router.refresh();
    });
  return (
    <Sheet open={open} onClose={onClose} title="Trạng thái học" size="sm">
      <div className="grid gap-2 pb-2">
        {(["ACTIVE", "PAUSED", "LEFT"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => choose(s)}
            className={cn(
              "rounded-control border px-4 py-3.5 text-left font-semibold transition active:scale-[0.98]",
              current === s ? "border-primary bg-primary-soft text-primary-deep" : "border-line",
            )}
          >
            {STATUS_META[s].label}
            <span className="block text-caption font-normal text-muted">
              {s === "ACTIVE" && "Hiện trong danh sách điểm danh"}
              {s === "PAUSED" && "Tạm ẩn khỏi điểm danh, vẫn giữ bộ đếm"}
              {s === "LEFT" && "Ẩn khỏi danh sách, giữ nguyên toàn bộ lịch sử"}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function CounterSheet({ open, onClose, studentId, onIssued }: { open: boolean; onClose: () => void; studentId: string; onIssued: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [dir, setDir] = useState<"add" | "sub">("add");
  const [n, setN] = useState(1);
  const [date, setDate] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const res = await adjustCounterAction({ studentId, delta: dir === "add" ? n : -n, date, reason });
      if (!res.ok) return setError(res.message);
      if (res.data.issued.length) {
        onIssued();
        toast.success(`Đủ chu kỳ — đã tạo phiếu ${res.data.issued.map((i) => i.code).join(", ")} 🍒`);
      } else toast.success("Đã sửa bộ đếm");
      setReason("");
      onClose();
      router.refresh();
    });
  return (
    <Sheet open={open} onClose={onClose} title="Sửa bộ đếm buổi" description="Lưu lại kèm lý do, xem được trong lịch sử" size="sm">
      <div className="space-y-4 pb-2">
        <Segmented
          layoutId="counter-dir"
          value={dir}
          onChange={setDir}
          options={[
            { value: "add", label: "Cộng buổi" },
            { value: "sub", label: "Trừ buổi" },
          ]}
        />
        <div className="flex items-center justify-center gap-5">
          <Button variant="outline" size="icon" onClick={() => setN((v) => Math.max(1, v - 1))} aria-label="Bớt">
            <Minus className="size-5" />
          </Button>
          <motion.span key={n} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="w-16 text-center text-4xl font-extrabold tabular">
            {n}
          </motion.span>
          <Button variant="outline" size="icon" onClick={() => setN((v) => Math.min(30, v + 1))} aria-label="Thêm">
            <Plus className="size-5" />
          </Button>
        </div>
        {dir === "add" && (
          <Field label="Ngày ghi nhận">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        <Field label="Lý do (bắt buộc)">
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={dir === "add" ? "vd: Các buổi đã học trước khi dùng app" : "vd: Tính nhầm buổi học bù"}
          />
        </Field>
        {dir === "sub" && <Notice tone="amber">Trừ các buổi GẦN NHẤT chưa vào phiếu. Buổi đã vào phiếu thì cô sửa trong phiếu nhé.</Notice>}
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button size="lg" block loading={pending} disabled={reason.trim().length < 3} onClick={submit}>
          {dir === "add" ? `Cộng ${n} buổi` : `Trừ ${n} buổi`}
        </Button>
      </div>
    </Sheet>
  );
}
