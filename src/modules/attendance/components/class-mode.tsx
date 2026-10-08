"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type PanInfo } from "motion/react";
import {
  CheckCircle2,
  ChevronLeft,
  CloudOff,
  Lock,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldX,
  StickyNote,
  UserPlus,
  X,
} from "lucide-react";

import { CherryIcon, Mascot } from "@/components/brand/mascot";
import { StudentAvatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip, Notice } from "@/components/ui/feedback";
import { CherryConfetti, CherryProgress } from "@/components/ui/fx";
import { Textarea } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { finalizeSessionAction, type FinalizeResult } from "@/modules/attendance/attendance.actions";
import type { Roster, RosterStudent } from "@/modules/attendance/attendance.service";
import { clearDraft, enqueue, loadDraft, saveDraft } from "@/modules/attendance/offline-queue";
import { isBillable } from "@/modules/billing/billing.core";
import { restoreSessionAction } from "@/modules/classes/classes.actions";
import type { QuickSearchItem } from "@/modules/students/students.service";
import { useStudentSearch } from "@/modules/students/use-student-search";
import { fullDate, weekdayOf, WEEKDAY_LONG } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/use-external";
import { cn, formatVnd, givenName } from "@/lib/utils";

type Status = RosterStudent["status"];
type Row = RosterStudent;

const QUICK_NOTES = ["Đi muộn", "Làm bài tốt", "Quên vở", "Chưa làm bài tập", "Phát biểu hăng hái", "Cần kèm thêm"];

const STATUS_LABEL: Record<Status, string> = {
  PRESENT: "Có mặt",
  EXCUSED: "Vắng có phép",
  UNEXCUSED: "Vắng không phép",
};

export function ClassMode({ roster }: { roster: Roster }) {
  const router = useRouter();
  const toast = useToast();
  const { session, billing } = roster;
  const [rows, setRows] = useState<Row[]>(roster.students);

  // Nháp đọc SAU khi mount (localStorage không có ở server — đọc trong useState sẽ lệch hydrate).
  // Chỉ lấy trạng thái cô đã chọn; số buổi đã đếm / khóa luôn lấy từ server.
  useEffect(() => {
    const draft = loadDraft<Row[]>(session.id);
    if (!draft) return;
    const server = new Map(roster.students.map((r) => [r.id, r]));
    const merged = draft
      .filter((d) => server.has(d.id) || d.isMakeup)
      .map((d) => {
        const s = server.get(d.id);
        return s ? { ...s, status: s.locked ? s.status : d.status, note: d.note, isMakeup: d.isMakeup } : d;
      });
    for (const s of roster.students) if (!merged.some((m) => m.id === s.id)) merged.push(s);
    // Đồng bộ một lần từ localStorage sau khi mount — không đọc được lúc render server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(merged);
  }, [roster.students, session.id]);
  const [noteFor, setNoteFor] = useState<Row | null>(null);
  const [actionFor, setActionFor] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const online = useOnline();
  const [pending, start] = useTransition();
  const [confetti, setConfetti] = useState(0);

  // Lưu nháp mỗi lần đổi — tắt trang / mất mạng mở lại vẫn còn.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveDraft(session.id, rows);
  }, [rows, session.id]);

  const update = useCallback((id: string, patch: Partial<Row>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const setStatus = useCallback(
    (row: Row, status: Status) => {
      if (row.locked) {
        toast.error(`Buổi này của ${givenName(row.fullName)} đã nằm trong phiếu đã gửi. Cô sửa trong phiếu thu nhé.`);
        return;
      }
      if (row.status === status) return;
      const prev = row.status;
      update(row.id, { status });
      haptic(status === "PRESENT" ? 10 : [12, 30, 12]);
      toast.undoable(
        status === "PRESENT" ? `${givenName(row.fullName)} có mặt` : `${givenName(row.fullName)}: ${STATUS_LABEL[status].toLowerCase()}`,
        { onUndo: () => update(row.id, { status: prev }) },
      );
    },
    [toast, update],
  );

  const counts = useMemo(() => {
    const present = rows.filter((r) => r.status === "PRESENT").length;
    return { present, absent: rows.length - present };
  }, [rows]);

  const willComplete = (r: Row) => r.counted + (isBillable(r.status, billing) ? 1 : 0) >= billing.cycleLength;
  const completing = rows.filter(willComplete).length;

  function payload() {
    return {
      sessionId: session.id,
      clientOpId: crypto.randomUUID(),
      entries: rows.map((r) => ({ studentId: r.id, status: r.status, note: r.note, isMakeup: r.isMakeup })),
    };
  }

  function finalize() {
    toast.dismissAll();
    const input = payload();
    const label = `${session.classroom.name} · ${session.shiftName} ${fullDate(session.date)}`;
    if (!navigator.onLine) {
      enqueue(input, label);
      clearDraft(session.id);
      setQueuedOffline(true);
      haptic([20, 40, 20]);
      return;
    }
    start(async () => {
      try {
        const res = await finalizeSessionAction(input);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        clearDraft(session.id);
        setResult(res.data);
        haptic([15, 60, 15, 60, 30]);
        if (res.data.completed.length > 0) setConfetti((n) => n + 1);
        router.refresh();
      } catch {
        // Rớt mạng giữa chừng → lưu hàng đợi, tự gửi khi có mạng.
        enqueue(input, label);
        clearDraft(session.id);
        setQueuedOffline(true);
      }
    });
  }

  const addMakeup = (s: QuickSearchItem) => {
    if (rows.some((r) => r.id === s.id)) {
      toast.info(`${givenName(s.fullName)} đã có trong danh sách rồi ạ`);
      return;
    }
    setRows((list) => [
      ...list,
      {
        id: s.id,
        fullName: s.fullName,
        avatarHue: s.avatarHue,
        classroom: s.classroom.name,
        status: "PRESENT",
        note: null,
        isMakeup: true,
        saved: false,
        locked: false,
        counted: 0,
        birthdayToday: false,
      },
    ]);
    haptic(12);
    toast.undoable(`Đã thêm ${givenName(s.fullName)} học bù`, {
      onUndo: () => setRows((list) => list.filter((r) => r.id !== s.id)),
    });
    setAddOpen(false);
  };

  const removeMakeup = (row: Row) => {
    setRows((list) => list.filter((r) => r.id !== row.id));
    toast.undoable(`Đã bỏ ${givenName(row.fullName)} khỏi buổi này`, {
      onUndo: () => setRows((list) => [...list, row]),
    });
  };

  const isCompleted = session.status === "COMPLETED";

  return (
    <div className="min-h-dvh bg-background pb-36">
      <CherryConfetti fire={confetti} />

      {/* ───── Thanh trên ───── */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5">
          <Link
            href="/diem-danh"
            aria-label="Thoát chế độ đứng lớp"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-card active:scale-90"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold leading-tight">
              <span className="mr-1.5 inline-block size-2.5 rounded-full align-middle" style={{ background: session.classroom.color }} />
              {session.classroom.name} · {session.shiftName}
            </p>
            <p className="truncate text-caption text-muted">
              {WEEKDAY_LONG[weekdayOf(session.date)]}, {fullDate(session.date)} · {session.startTime}–{session.endTime}
              {session.room ? ` · ${session.room}` : ""}
            </p>
          </div>
          {!online && (
            <Chip tone="amber" icon={CloudOff}>
              Ngoại tuyến
            </Chip>
          )}
        </div>
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pb-2.5">
          <motion.span key={`p${counts.present}`} initial={{ scale: 1.15 }} animate={{ scale: 1 }}>
            <Chip tone="leaf" icon={CheckCircle2}>
              Có mặt {counts.present}
            </Chip>
          </motion.span>
          <motion.span key={`a${counts.absent}`} initial={{ scale: 1.15 }} animate={{ scale: 1 }}>
            <Chip tone={counts.absent ? "overdue" : "muted"} icon={ShieldX}>
              Vắng {counts.absent}
            </Chip>
          </motion.span>
          {completing > 0 && (
            <Chip tone="primary" className="ml-auto">
              🍒 {completing} em đủ chu kỳ
            </Chip>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 pt-3">
        {session.status === "CANCELLED" ? (
          <CancelledNotice sessionId={session.id} reason={session.cancelReason} />
        ) : (
          <>
            {isCompleted && (
              <Notice tone="leaf" icon={ShieldCheck} className="mb-3">
                Buổi này đã chốt. Cô sửa rồi bấm <b>Lưu thay đổi</b> — app tự tính lại học phí cho đúng.
              </Notice>
            )}
            <p className="mb-2 px-1 text-caption text-muted">
              Mặc định <b>cả lớp có mặt</b>. Vuốt trái thẻ để đánh vắng · chạm giữ để ghi chú.
            </p>

            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {rows.map((row, i) => (
                  <motion.li
                    key={row.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 15) * 0.025 } }}
                    exit={{ opacity: 0, x: -60, height: 0, marginTop: 0 }}
                  >
                    <SwipeCard
                      row={row}
                      cycle={billing.cycleLength}
                      pendingCherry={isBillable(row.status, billing) ? 1 : 0}
                      glow={willComplete(row)}
                      onStatus={(s) => setStatus(row, s)}
                      onLongPress={() => setNoteFor(row)}
                      onMore={() => setActionFor(row)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong py-4 font-semibold text-muted transition hover:border-primary hover:text-primary active:scale-[0.99]"
            >
              <UserPlus className="size-5" /> Thêm em học bù từ ca khác
            </button>
          </>
        )}
      </main>

      {/* ───── Nút chốt ───── */}
      {session.status !== "CANCELLED" && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent pt-6">
          <div className="mx-auto max-w-2xl px-3 pb-3">
            <Button size="xl" block onClick={finalize} loading={pending} className="h-16 rounded-[20px] text-lg shadow-fab">
              {!pending && <CheckCircle2 className="size-6" />}
              {isCompleted ? "Lưu thay đổi" : `Xong buổi · ${counts.present}/${rows.length} có mặt`}
            </Button>
          </div>
        </div>
      )}

      {/* ───── Ghi chú nhanh ───── */}
      <NoteSheet
        row={noteFor}
        onClose={() => setNoteFor(null)}
        onSave={(note) => {
          if (noteFor) update(noteFor.id, { note });
          setNoteFor(null);
          haptic(10);
        }}
      />

      {/* ───── Thao tác (cho người không quen vuốt) ───── */}
      <Sheet open={Boolean(actionFor)} onClose={() => setActionFor(null)} title={actionFor?.fullName ?? ""} size="sm">
        {actionFor && (
          <div className="grid gap-2 pb-2">
            {(["PRESENT", "EXCUSED", "UNEXCUSED"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatus(actionFor, s);
                  setActionFor(null);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-control border px-4 py-3.5 text-left font-semibold transition active:scale-[0.98]",
                  actionFor.status === s ? "border-primary bg-primary-soft text-primary-deep" : "border-line bg-surface",
                )}
              >
                {s === "PRESENT" ? <CheckCircle2 className="size-5 text-leaf" /> : s === "EXCUSED" ? <ShieldCheck className="size-5 text-amber" /> : <ShieldX className="size-5 text-overdue" />}
                {STATUS_LABEL[s]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setNoteFor(actionFor);
                setActionFor(null);
              }}
              className="flex items-center gap-3 rounded-control border border-line bg-surface px-4 py-3.5 font-semibold active:scale-[0.98]"
            >
              <StickyNote className="size-5 text-sky" /> Ghi chú nhanh
            </button>
            {actionFor.isMakeup && (
              <button
                type="button"
                onClick={() => {
                  removeMakeup(actionFor);
                  setActionFor(null);
                }}
                className="flex items-center gap-3 rounded-control px-4 py-3 font-semibold text-overdue active:scale-[0.98]"
              >
                <X className="size-5" /> Bỏ khỏi buổi này
              </button>
            )}
          </div>
        )}
      </Sheet>

      <MakeupSearch open={addOpen} onClose={() => setAddOpen(false)} onPick={addMakeup} />

      <AnimatePresence>
        {result && <DoneOverlay result={result} rows={rows} onClose={() => router.push("/diem-danh")} />}
        {queuedOffline && <OfflineSavedOverlay onClose={() => router.push("/diem-danh")} />}
      </AnimatePresence>
    </div>
  );
}

// ───── Thẻ học sinh vuốt được ─────

function SwipeCard({
  row,
  cycle,
  pendingCherry,
  glow,
  onStatus,
  onLongPress,
  onMore,
}: {
  row: Row;
  cycle: number;
  pendingCherry: number;
  glow: boolean;
  onStatus: (s: Status) => void;
  onLongPress: () => void;
  onMore: () => void;
}) {
  const controls = useAnimationControls();
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const absent = row.status !== "PRESENT";
  const REVEAL = -196;

  const close = () => {
    setOpen(false);
    void controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 36 } });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) {
      setOpen(true);
      haptic(8);
      void controls.start({ x: REVEAL, transition: { type: "spring", stiffness: 500, damping: 38 } });
    } else close();
  };

  const startPress = () => {
    moved.current = false;
    pressTimer.current = setTimeout(() => {
      if (!moved.current) {
        haptic(20);
        onLongPress();
      }
    }, 520);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const choose = (s: Status) => {
    onStatus(s);
    close();
  };

  return (
    <div className="relative overflow-hidden rounded-card">
      {/* Nút lộ ra khi vuốt */}
      <div className="absolute inset-y-0 right-0 flex w-[196px] items-stretch gap-1.5 p-1.5">
        {absent ? (
          <button
            type="button"
            onClick={() => choose("PRESENT")}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[16px] bg-leaf text-sm font-bold text-white active:scale-95"
          >
            <RotateCcw className="size-5" /> Có mặt
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => choose("EXCUSED")}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 rounded-[16px] text-sm font-bold active:scale-95",
            row.status === "EXCUSED" ? "hidden" : "bg-amber text-white",
          )}
        >
          <ShieldCheck className="size-5" /> Có phép
        </button>
        <button
          type="button"
          onClick={() => choose("UNEXCUSED")}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 rounded-[16px] text-sm font-bold active:scale-95",
            row.status === "UNEXCUSED" ? "hidden" : "bg-overdue text-white",
          )}
        >
          <ShieldX className="size-5" /> Không phép
        </button>
      </div>

      <motion.div
        drag={row.locked ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: REVEAL, right: 0 }}
        dragElastic={{ left: 0.1, right: 0.05 }}
        onDragStart={() => {
          moved.current = true;
          cancelPress();
        }}
        onDragEnd={onDragEnd}
        animate={controls}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onClick={() => open && close()}
        onContextMenu={(e) => {
          e.preventDefault();
          onLongPress();
        }}
        className={cn(
          "relative flex touch-pan-y select-none items-center gap-3 rounded-card border bg-surface p-3 shadow-card transition-[border-color,box-shadow]",
          absent ? "border-line opacity-[0.92]" : "border-line",
          glow && !absent && "border-primary/60 shadow-glow ring-2 ring-primary/25",
        )}
      >
        <div className="relative">
          <StudentAvatar name={row.fullName} hue={row.avatarHue} size={52} className={cn(absent && "grayscale-[0.6]")} />
          {row.birthdayToday && <span className="absolute -right-1 -top-1 text-lg">🎂</span>}
          {absent && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full text-white ring-2 ring-surface",
                row.status === "EXCUSED" ? "bg-amber" : "bg-overdue",
              )}
            >
              {row.status === "EXCUSED" ? <ShieldCheck className="size-3.5" /> : <ShieldX className="size-3.5" />}
            </motion.span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn("truncate text-[17px] font-bold", absent && "text-muted")}>{row.fullName}</p>
            {row.locked && <Lock className="size-3.5 shrink-0 text-muted" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <CherryProgress count={row.counted} pending={pendingCherry} cycle={cycle} size={15} glow={glow} />
            <span className="text-caption font-semibold text-muted tabular">
              {Math.min(row.counted + pendingCherry, cycle)}/{cycle}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {absent && <Chip tone={row.status === "EXCUSED" ? "amber" : "overdue"}>{STATUS_LABEL[row.status]}</Chip>}
            {row.isMakeup && <Chip tone="sky">Học bù · {row.classroom}</Chip>}
            {glow && !absent && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Chip tone="primary">Đủ chu kỳ 🎉</Chip>
              </motion.span>
            )}
            {row.note && (
              <Chip tone="muted" icon={MessageSquareText}>
                {row.note}
              </Chip>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Thao tác với ${row.fullName}`}
          onClick={(e) => {
            e.stopPropagation();
            onMore();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-subtle active:scale-90"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </motion.div>
    </div>
  );
}

function NoteSheet({ row, onClose, onSave }: { row: Row | null; onClose: () => void; onSave: (note: string | null) => void }) {
  return (
    <Sheet open={Boolean(row)} onClose={onClose} title={row ? `Ghi chú cho ${givenName(row.fullName)}` : ""} size="sm">
      {row && <NoteBody key={row.id} initial={row.note} onSave={onSave} />}
    </Sheet>
  );
}

function NoteBody({ initial, onSave }: { initial: string | null; onSave: (note: string | null) => void }) {
  const [value, setValue] = useState(initial ?? "");
  return (
    <div className="pb-2">
      <div className="flex flex-wrap gap-2">
        {QUICK_NOTES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95",
              value === n ? "border-primary bg-primary-soft text-primary-deep" : "border-line bg-surface",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <Textarea className="mt-3" rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Hoặc gõ ghi chú…" />
      <div className="mt-3 flex gap-2">
        {initial && (
          <Button variant="ghost" onClick={() => onSave(null)}>
            Xóa ghi chú
          </Button>
        )}
        <Button block onClick={() => onSave(value.trim() || null)}>
          Lưu
        </Button>
      </div>
    </div>
  );
}

function MakeupSearch({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: QuickSearchItem) => void }) {
  const { q, setQuery, results: items, pending, reset } = useStudentSearch();
  const close = () => {
    reset();
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="Thêm em học bù" description="Tìm theo tên, gõ không dấu cũng được" size="sm">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="vd: nguyen van an"
          className="min-h-12 w-full rounded-control border border-line-strong bg-surface pl-11 pr-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
      </div>
      <ul className="mt-3 min-h-32 space-y-1">
        {pending && items.length === 0 && <li className="py-4 text-center text-sm text-muted">Đang tìm…</li>}
        {items.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                onPick(s);
                reset();
              }}
              className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left transition hover:bg-surface-subtle active:scale-[0.99]"
            >
              <StudentAvatar name={s.fullName} hue={s.avatarHue} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.fullName}</p>
                <p className="text-caption text-muted">
                  {s.classroom.name}
                  {s.shift ? ` · ${s.shift.name}` : ""}
                </p>
              </div>
              <Plus className="size-5 text-primary" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function CancelledNotice({ sessionId, reason }: { sessionId: string; reason: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Mascot mood="sleepy" size={110} />
      <p className="text-lg font-bold">Buổi này đã được nghỉ</p>
      <p className="text-muted">{reason ?? "Không có lý do"}</p>
      <Button
        variant="soft"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await restoreSessionAction(sessionId);
            if (res.ok) {
              toast.success("Đã khôi phục buổi học");
              router.refresh();
            } else toast.error(res.message);
          })
        }
      >
        <RotateCcw className="size-4" /> Khôi phục buổi để điểm danh
      </Button>
    </div>
  );
}

// ───── Màn chúc mừng sau khi chốt ─────

function DoneOverlay({ result, rows, onClose }: { result: FinalizeResult; rows: Row[]; onClose: () => void }) {
  const reduce = useReducedMotion();
  const present = rows.filter((r) => r.status === "PRESENT").slice(0, 14);
  const [basketFull, setBasketFull] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBasketFull(true), reduce ? 0 : 400 + present.length * 90);
    return () => clearTimeout(t);
  }, [present.length, reduce]);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-overlay backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 80, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="pb-safe w-full max-w-md rounded-t-sheet border border-line bg-surface-raised p-6 shadow-pop sm:rounded-sheet"
      >
        {/* Giỏ cherry */}
        <div className="relative mx-auto h-40 w-56">
          {present.map((r, i) => (
            <motion.span
              key={r.id}
              className="absolute left-1/2 top-0"
              initial={{ y: -60, x: (i % 2 ? 1 : -1) * (12 + (i % 5) * 9) - 12, opacity: 0, rotate: -20 }}
              animate={{ y: 58 + (i % 3) * 5, opacity: 1, rotate: 0 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 14, delay: 0.15 + i * 0.09 }}
            >
              <CherryIcon size={24} />
            </motion.span>
          ))}
          <motion.svg
            viewBox="0 0 220 90"
            className="absolute bottom-0 left-0 w-full"
            animate={basketFull && !reduce ? { rotate: [0, -3, 3, -2, 0] } : {}}
            transition={{ duration: 0.6 }}
            style={basketFull ? { filter: "drop-shadow(0 0 14px rgb(251 113 133 / 0.65))" } : undefined}
          >
            <path d="M14 22 H206 L188 84 Q186 88 180 88 H40 Q34 88 32 84 Z" fill="#C2410C" />
            <path d="M14 22 H206 L203 32 H17 Z" fill="#9A3412" />
            {[40, 70, 100, 130, 160].map((x) => (
              <path key={x} d={`M${x} 32 L${x + 6} 86`} stroke="#9A3412" strokeWidth={3} opacity={0.6} />
            ))}
            <path d="M30 50 H190" stroke="#9A3412" strokeWidth={3} opacity={0.5} />
            <path d="M26 22 Q110 -24 194 22" stroke="#9A3412" strokeWidth={6} fill="none" strokeLinecap="round" />
          </motion.svg>
        </div>

        <div className="mt-2 text-center">
          <p className="text-2xl font-extrabold">Xong rồi nè! 🎉</p>
          <p className="mt-1 text-muted">
            {result.present} em có mặt
            {result.excused ? ` · ${result.excused} vắng có phép` : ""}
            {result.unexcused ? ` · ${result.unexcused} vắng không phép` : ""}
          </p>
        </div>

        {result.completed.length > 0 && (
          <div className="mt-4 rounded-card bg-primary-soft p-4">
            <p className="font-bold text-primary-deep">Cô ơi, có {result.completed.length} em đủ buổi rồi ạ 🍒</p>
            <ul className="mt-2 space-y-1.5">
              {result.completed.map((c) => (
                <li key={c.invoiceId}>
                  <Link href={`/thu-tien/${c.invoiceId}`} className="flex items-center justify-between rounded-control bg-surface px-3 py-2 font-semibold active:scale-[0.99]">
                    <span>{c.name}</span>
                    <span className="text-primary-deep tabular">{formatVnd(c.amount)} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 grid gap-2">
          {result.completed.length > 0 && (
            <ButtonLink href="/thu-tien?tab=READY" size="lg" block>
              Gửi phiếu thu ngay
            </ButtonLink>
          )}
          <Button variant={result.completed.length ? "ghost" : "primary"} size="lg" block onClick={onClose}>
            Về danh sách buổi học
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OfflineSavedOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-overlay backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pb-safe w-full max-w-md rounded-t-sheet border border-line bg-surface-raised p-6 text-center shadow-pop sm:rounded-sheet"
      >
        <Mascot mood="worried" size={110} className="mx-auto" />
        <p className="mt-2 text-xl font-extrabold">Mạng đang chập chờn</p>
        <p className="mt-1 text-muted">
          Em đã giữ điểm danh trên máy rồi ạ. Có mạng lại là em tự gửi và tính học phí — cô không cần làm gì thêm.
        </p>
        <Button size="lg" block className="mt-5" onClick={onClose}>
          Đã hiểu
        </Button>
      </motion.div>
    </motion.div>
  );
}
