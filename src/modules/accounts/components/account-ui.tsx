"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Copy, KeyRound, Lock, LockOpen, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, Notice } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  createAccountAction,
  createClassAccountsAction,
  resetPasswordAction,
  setAccountActiveAction,
} from "@/modules/accounts/accounts.actions";
import { credentialMessage, type Credential } from "@/modules/accounts/accounts.message";
import { formatRelativeTime } from "@/lib/utils";

type AccountRow = { id: string; username: string; isActive: boolean; lastLoginAt: string | null; mustChangePassword: boolean };
type ParentRow = AccountRow & { displayName: string; parentLinks: { student: { fullName: string } }[] };

/** Thẻ "Tài khoản" trong sổ tay học sinh. Khối 9 gợi ý tài khoản học sinh, khối 8 gợi ý phụ huynh. */
export function AccountsCard({
  studentId,
  grade,
  accounts,
  appUrl,
  teacherName,
}: {
  studentId: string;
  grade: number;
  accounts: { student: AccountRow | null; parents: ParentRow[] };
  appUrl: string;
  teacherName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [pending, start] = useTransition();

  const create = (kind: "STUDENT" | "PARENT") =>
    start(async () => {
      const res = await createAccountAction({ studentId, kind });
      if (!res.ok) return toast.error(res.message);
      setCreds([res.data]);
      router.refresh();
    });

  const reset = (userId: string, kind: "STUDENT" | "PARENT", displayName: string) =>
    start(async () => {
      const res = await resetPasswordAction(userId);
      if (!res.ok) return toast.error(res.message);
      setCreds([{ kind, studentId, studentName: displayName, displayName, username: res.data.username, password: res.data.password }]);
    });

  const toggle = (userId: string, active: boolean) =>
    start(async () => {
      const res = await setAccountActiveAction(userId, active);
      if (!res.ok) return toast.error(res.message);
      toast.success(active ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
      router.refresh();
    });

  const preferStudent = grade >= 9;

  return (
    <Card className="space-y-3 p-4">
      <AccountLine
        title="Tài khoản của em"
        hint={preferStudent ? "Khối 9: em tự xem đề, nộp bài, xem điểm" : "Thường khối 8 dùng tài khoản phụ huynh"}
        row={accounts.student}
        onCreate={() => create("STUDENT")}
        onReset={(id) => reset(id, "STUDENT", "học sinh")}
        onToggle={toggle}
        pending={pending}
        highlight={preferStudent}
      />
      <div className="border-t border-line pt-3">
        {accounts.parents.length === 0 ? (
          <AccountLine
            title="Tài khoản phụ huynh"
            hint="Đăng nhập bằng SĐT phụ huynh. Anh chị em dùng chung một tài khoản."
            row={null}
            onCreate={() => create("PARENT")}
            onReset={() => {}}
            onToggle={toggle}
            pending={pending}
            highlight={!preferStudent}
          />
        ) : (
          accounts.parents.map((p) => (
            <AccountLine
              key={p.id}
              title={`Phụ huynh · ${p.displayName}`}
              hint={p.parentLinks.length > 1 ? `Xem được: ${p.parentLinks.map((l) => l.student.fullName.split(" ").at(-1)).join(", ")}` : undefined}
              row={p}
              onCreate={() => {}}
              onReset={(id) => reset(id, "PARENT", p.displayName)}
              onToggle={toggle}
              pending={pending}
            />
          ))
        )}
      </div>
      <CredentialSheet creds={creds} onClose={() => setCreds(null)} appUrl={appUrl} teacherName={teacherName} />
    </Card>
  );
}

function AccountLine({
  title,
  hint,
  row,
  onCreate,
  onReset,
  onToggle,
  pending,
  highlight,
}: {
  title: string;
  hint?: string;
  row: AccountRow | null;
  onCreate: () => void;
  onReset: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  pending: boolean;
  highlight?: boolean;
}) {
  if (!row) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {hint && <p className="text-caption text-muted">{hint}</p>}
        </div>
        <Button size="sm" variant={highlight ? "primary" : "outline"} onClick={onCreate} loading={pending}>
          <UserPlus className="size-4" /> Cấp tài khoản
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-semibold">{title}</p>
        {!row.isActive ? (
          <Chip tone="muted" icon={Lock}>
            Đã khóa
          </Chip>
        ) : row.mustChangePassword ? (
          <Chip tone="amber">Chưa đăng nhập lần đầu</Chip>
        ) : (
          <Chip tone="leaf">Đang dùng</Chip>
        )}
      </div>
      <p className="text-sm text-muted">
        Tên đăng nhập: <b className="text-foreground">{row.username}</b>
        {row.lastLoginAt && ` · vào lần cuối ${formatRelativeTime(row.lastLoginAt)}`}
      </p>
      {hint && <p className="text-caption text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onReset(row.id)} disabled={pending}>
          <KeyRound className="size-4" /> Cấp lại mật khẩu
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onToggle(row.id, !row.isActive)} disabled={pending}>
          {row.isActive ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
          {row.isActive ? "Khóa" : "Mở khóa"}
        </Button>
      </div>
    </div>
  );
}

/** Hiện thông tin đăng nhập MỘT LẦN kèm tin nhắn soạn sẵn để cô sao chép gửi. */
export function CredentialSheet({
  creds,
  onClose,
  appUrl,
  teacherName,
  skipped = [],
}: {
  creds: Credential[] | null;
  onClose: () => void;
  appUrl: string;
  teacherName: string;
  skipped?: string[];
}) {
  const toast = useToast();
  const [copied, setCopied] = useState<number | "all" | null>(null);
  const copy = async (text: string, key: number | "all") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Đã sao chép");
    } catch {
      toast.error("Chưa sao chép được — cô chạm giữ để chọn chữ nhé.");
    }
  };
  const all = (creds ?? []).map((c) => credentialMessage(c, appUrl, teacherName)).join("\n\n———\n\n");
  return (
    <Sheet
      open={Boolean(creds)}
      onClose={onClose}
      title={creds && creds.length > 1 ? `Đã cấp ${creds.length} tài khoản` : "Thông tin đăng nhập"}
      description="Mật khẩu tạm chỉ hiện lần này — cô sao chép gửi cho em / phụ huynh nhé"
      size="md"
      footer={
        creds && creds.length > 1 ? (
          <Button block size="lg" onClick={() => copy(all, "all")} variant={copied === "all" ? "leaf" : "primary"}>
            {copied === "all" ? <Check className="size-5" /> : <Copy className="size-5" />} Sao chép tất cả
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 pb-2">
        {skipped.length > 0 && (
          <Notice tone="amber">
            Bỏ qua {skipped.length} em: {skipped.slice(0, 3).join(" · ")}
            {skipped.length > 3 ? " …" : ""}
          </Notice>
        )}
        {creds?.length === 0 && <p className="py-6 text-center text-muted">Không có tài khoản mới nào cần cấp.</p>}
        {creds?.map((c, i) => (
          <motion.div
            key={`${c.username}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
            className="rounded-card border border-line bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              {c.kind === "PARENT" ? <Users className="size-4 text-sky" /> : <UserPlus className="size-4 text-primary" />}
              <p className="min-w-0 flex-1 truncate font-bold">{c.kind === "PARENT" ? `${c.displayName} (PH của ${c.studentName})` : c.studentName}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-control bg-surface-subtle px-3 py-2">
                <p className="text-caption text-muted">Tên đăng nhập</p>
                <p className="font-bold tabular">{c.username}</p>
              </div>
              <div className="rounded-control bg-primary-soft px-3 py-2">
                <p className="text-caption text-muted">Mật khẩu tạm</p>
                <p className="font-bold tabular text-primary-deep">{c.password ?? "(dùng mật khẩu cũ)"}</p>
              </div>
            </div>
            <Button size="sm" variant={copied === i ? "leaf" : "soft"} className="mt-3" onClick={() => copy(credentialMessage(c, appUrl, teacherName), i)}>
              {copied === i ? <Check className="size-4" /> : <Copy className="size-4" />} Sao chép tin nhắn
            </Button>
          </motion.div>
        ))}
      </div>
    </Sheet>
  );
}

/** Nút "Cấp tài khoản cả lớp" trên thẻ lớp. */
export function ClassAccountsButton({ classroomId, grade, appUrl, teacherName }: { classroomId: string; grade: number; appUrl: string; teacherName: string }) {
  const toast = useToast();
  const [result, setResult] = useState<{ created: Credential[]; skipped: string[] } | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createClassAccountsAction(classroomId);
            if (!res.ok) return toast.error(res.message);
            setResult(res.data);
          })
        }
        className="flex w-full items-center justify-center gap-2 border-t border-line py-3 text-sm font-semibold text-sky hover:bg-sky-soft/50 disabled:opacity-60"
      >
        <KeyRound className="size-4" />
        {pending ? "Đang cấp…" : grade >= 9 ? "Cấp tài khoản học sinh cả lớp" : "Cấp tài khoản phụ huynh cả lớp"}
      </button>
      <CredentialSheet creds={result?.created ?? null} skipped={result?.skipped} onClose={() => setResult(null)} appUrl={appUrl} teacherName={teacherName} />
    </>
  );
}
