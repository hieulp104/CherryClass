"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Landmark, MessageSquareHeart, Pencil, Plus, Receipt, Search, Trash2, UserRound, Users, X } from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, Notice } from "@/components/ui/feedback";
import { Field, Input, MoneyInput, parseMoney, Select, Switch, Textarea } from "@/components/ui/form";
import { PageHeader, Segmented, SectionTitle } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { computeInvoiceAmounts } from "@/modules/billing/billing.core";
import { deleteTemplateAction, saveTemplateAction } from "@/modules/messages/messages.actions";
import type { TemplateItem } from "@/modules/messages/messages.service";
import { MESSAGE_KIND_META, TEMPLATE_VARIABLES, type MessageKind } from "@/modules/messages/messages.templates";
import { saveSettingsAction } from "@/modules/settings/settings.actions";
import type { AppSettings } from "@/modules/settings/settings.service";
import { deleteSiblingGroupAction, saveSiblingGroupAction } from "@/modules/students/students.actions";
import { useStudentSearch } from "@/modules/students/use-student-search";
import { BANKS } from "@/lib/vietqr";
import { cn, formatVnd } from "@/lib/utils";

type Group = {
  id: string;
  label: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  applyTo: "ALL" | "FROM_SECOND";
  students: { id: string; fullName: string; avatarHue: number; classroom: string }[];
};

export function SettingsView({
  settings,
  templates,
  groups,
}: {
  settings: AppSettings;
  templates: TemplateItem[];
  groups: Group[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Cài đặt" subtitle="Cách tính học phí, tài khoản nhận tiền, mẫu tin nhắn" />
      <GeneralForm settings={settings} />
      <SiblingGroups groups={groups} />
      <Templates templates={templates} />
    </div>
  );
}

// ───── Cài đặt chung + học phí + ngân hàng ─────

function GeneralForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [billing, setBilling] = useState(settings.billing);
  const [bankBin, setBankBin] = useState(settings.bank.bin);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Ví dụ sống: một chu kỳ đủ buổi với cài đặt đang chọn.
  const sample = computeInvoiceAmounts({
    lines: Array.from({ length: billing.cycleLength }, () => ({ unitPrice: billing.defaultUnitPrice })),
    roundTo: billing.roundTo,
  });

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const bank = BANKS.find((b) => b.bin === bankBin);
      const res = await saveSettingsAction({
        teacherName: fd.get("teacherName"),
        billing: {
          ...billing,
          defaultUnitPrice: parseMoney(fd.get("defaultUnitPrice")),
          cycleLength: Number(fd.get("cycleLength")),
        },
        bank: {
          bin: bankBin,
          bankName: bank?.name ?? "",
          accountNo: String(fd.get("accountNo") ?? ""),
          accountName: String(fd.get("accountName") ?? ""),
        },
        reminders: { gentleAfterDays: fd.get("gentleAfterDays"), clearAfterDays: fd.get("clearAfterDays") },
      });
      if (!res.ok) return setError(res.message);
      toast.success("Đã lưu cài đặt 🍒");
      router.refresh();
    });

  return (
    <form action={submit} className="space-y-5">
      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserRound className="size-5 text-primary" /> Cô giáo
        </h2>
        <Field label="Tên hiển thị" hint='Dùng trong lời chào và tin nhắn, vd "cô Hà"'>
          <Input name="teacherName" defaultValue={settings.teacherName} required />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Receipt className="size-5 text-primary" /> Học phí
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Đơn giá mặc định / buổi">
            <MoneyInput
              name="defaultUnitPrice"
              defaultValue={billing.defaultUnitPrice}
              onValueChange={(v) => setBilling((b) => ({ ...b, defaultUnitPrice: v }))}
            />
          </Field>
          <Field label="Số buổi mỗi chu kỳ">
            <Input
              name="cycleLength"
              type="number"
              min={1}
              max={60}
              inputMode="numeric"
              defaultValue={billing.cycleLength}
              onChange={(e) => setBilling((b) => ({ ...b, cycleLength: Math.max(1, Math.min(60, Number(e.target.value) || 1)) }))}
            />
          </Field>
        </div>
        <div className="divide-y divide-line rounded-control border border-line">
          <div className="p-3.5">
            <Switch
              checked={billing.countExcused}
              onChange={(v) => setBilling((b) => ({ ...b, countExcused: v }))}
              label="Vắng có phép vẫn tính tiền"
              description="Buổi vắng có phép được đếm vào chu kỳ"
            />
          </div>
          <div className="p-3.5">
            <Switch
              checked={billing.countUnexcused}
              onChange={(v) => setBilling((b) => ({ ...b, countUnexcused: v }))}
              label="Vắng không phép vẫn tính tiền"
              description="Buổi vắng không phép được đếm vào chu kỳ"
            />
          </div>
          <div className="p-3.5">
            <Switch
              checked={billing.roundTo === 1000}
              onChange={(v) => setBilling((b) => ({ ...b, roundTo: v ? 1000 : 1 }))}
              label="Làm tròn xuống tới nghìn đồng"
              description="vd 737.500đ → 737.000đ — phụ huynh không bao giờ phải trả thừa"
            />
          </div>
        </div>
        <motion.div
          key={`${sample.amount}-${billing.cycleLength}`}
          initial={{ scale: 0.98, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-control bg-primary-soft px-4 py-3 text-sm"
        >
          Ví dụ: đủ <b>{billing.cycleLength} buổi</b> × {formatVnd(billing.defaultUnitPrice)} ={" "}
          <b className="text-primary-deep">{formatVnd(sample.amount)}</b>
          <span className="mt-1 block text-caption text-muted">
            Thay đổi chỉ áp dụng cho các buổi chốt sau khi lưu — buổi đã chốt giữ nguyên.
          </span>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chuyển sang 'Nhắc khéo' sau (ngày)">
            <Input name="gentleAfterDays" type="number" min={1} defaultValue={settings.reminders.gentleAfterDays} />
          </Field>
          <Field label="Chuyển sang 'Nhắc rõ' sau (ngày)">
            <Input name="clearAfterDays" type="number" min={2} defaultValue={settings.reminders.clearAfterDays} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Landmark className="size-5 text-primary" /> Tài khoản nhận học phí
        </h2>
        <p className="text-sm text-muted">
          Dùng để tạo mã VietQR trên phiếu — phụ huynh quét là chuyển đúng số tiền, đúng nội dung.
        </p>
        <Field label="Ngân hàng">
          <Select value={bankBin} onChange={(e) => setBankBin(e.target.value)}>
            <option value="">— Chọn ngân hàng —</option>
            {BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số tài khoản">
            <Input name="accountNo" inputMode="numeric" defaultValue={settings.bank.accountNo} />
          </Field>
          <Field label="Tên chủ tài khoản">
            <Input name="accountName" defaultValue={settings.bank.accountName} className="uppercase" />
          </Field>
        </div>
      </Card>

      {error && <Notice tone="overdue">{error}</Notice>}
      <div className="pb-safe sticky bottom-20 z-10 lg:bottom-4">
        <Button type="submit" size="lg" block loading={pending} className="shadow-fab">
          Lưu cài đặt
        </Button>
      </div>
    </form>
  );
}

// ───── Nhóm anh chị em ─────

function SiblingGroups({ groups }: { groups: Group[] }) {
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  return (
    <>
      <SectionTitle
        action={
          <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Nhóm mới
          </Button>
        }
      >
        <span className="inline-flex items-center gap-2">
          <Users className="size-5 text-primary" /> Anh chị em ruột
        </span>
      </SectionTitle>
      {groups.length === 0 ? (
        <Card variant="outline" className="p-5 text-center text-sm text-muted">
          Chưa có nhóm nào. Liên kết các em là anh chị em để tự giảm học phí.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <button key={g.id} type="button" onClick={() => setEditing(g)} className="text-left">
              <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{g.label}</p>
                  <Pencil className="size-4 text-muted" />
                </div>
                <div className="mt-2 flex -space-x-2">
                  {g.students.map((s) => (
                    <StudentAvatar key={s.id} name={s.fullName} hue={s.avatarHue} size={34} className="ring-2 ring-surface" />
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">{g.students.map((s) => s.fullName.split(" ").at(-1)).join(", ")}</p>
                <Chip tone="leaf" className="mt-2">
                  Giảm {g.discountType === "PERCENT" ? `${g.discountValue}%` : formatVnd(g.discountValue)}
                  {g.applyTo === "FROM_SECOND" ? " · từ em thứ 2" : " · mọi em"}
                </Chip>
              </Card>
            </button>
          ))}
        </div>
      )}
      <GroupSheet value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function GroupSheet({ value, onClose }: { value: Group | "new" | null; onClose: () => void }) {
  const g = value && value !== "new" ? value : null;
  return (
    <Sheet open={Boolean(value)} onClose={onClose} title={g ? "Sửa nhóm anh chị em" : "Nhóm anh chị em mới"} size="md">
      {value && <GroupForm key={g?.id ?? "new"} g={g} onClose={onClose} />}
    </Sheet>
  );
}

function GroupForm({ g, onClose }: { g: Group | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [members, setMembers] = useState<Group["students"]>(g?.students ?? []);
  const [type, setType] = useState<"PERCENT" | "FIXED">(g?.discountType ?? "PERCENT");
  const [applyTo, setApplyTo] = useState<"ALL" | "FROM_SECOND">(g?.applyTo ?? "ALL");
  const { q, setQuery, results, reset } = useStudentSearch();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const res = await saveSiblingGroupAction({
        id: g?.id,
        label: fd.get("label"),
        discountType: type,
        discountValue: type === "PERCENT" ? fd.get("percent") : parseMoney(fd.get("fixed")),
        applyTo,
        studentIds: members.map((m) => m.id),
      });
      if (!res.ok) return setError(res.message);
      toast.success("Đã lưu nhóm — áp dụng cho phiếu tạo từ giờ");
      onClose();
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!g) return;
      const res = await deleteSiblingGroupAction(g.id);
      if (!res.ok) return setError(res.message);
      toast.success("Đã bỏ nhóm");
      onClose();
      router.refresh();
    });

  return (
    <form action={submit} className="space-y-4 pb-2">
      <Field label="Tên nhóm">
        <Input name="label" defaultValue={g?.label ?? ""} placeholder="vd: Nhà chị Lan" required />
      </Field>
      <Field label="Các em trong nhóm">
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {members.map((m) => (
              <motion.span
                key={m.id}
                layout
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="inline-flex items-center gap-2 rounded-full bg-surface-subtle py-1 pl-1 pr-2"
              >
                <StudentAvatar name={m.fullName} hue={m.avatarHue} size={26} />
                <span className="text-sm font-semibold">{m.fullName}</span>
                <button
                  type="button"
                  aria-label={`Bỏ ${m.fullName}`}
                  onClick={() => setMembers((l) => l.filter((x) => x.id !== m.id))}
                  className="text-muted hover:text-overdue"
                >
                  <X className="size-4" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm em để thêm…" className="pl-9" />
        </div>
        {results.length > 0 && (
          <ul className="mt-1 max-h-48 overflow-y-auto rounded-control border border-line">
            {results
              .filter((r) => !members.some((m) => m.id === r.id))
              .map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMembers((l) => [
                        ...l,
                        { id: r.id, fullName: r.fullName, avatarHue: r.avatarHue, classroom: r.classroom.name },
                      ]);
                      reset();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-subtle"
                  >
                    <StudentAvatar name={r.fullName} hue={r.avatarHue} size={28} />
                    {r.fullName} <span className="text-muted">· {r.classroom.name}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Field>
      <Segmented
        layoutId="disc-type"
        value={type}
        onChange={setType}
        options={[
          { value: "PERCENT", label: "Giảm theo %" },
          { value: "FIXED", label: "Giảm số tiền" },
        ]}
      />
      {type === "PERCENT" ? (
        <Field label="Phần trăm giảm mỗi phiếu">
          <Input
            name="percent"
            type="number"
            min={0}
            max={100}
            defaultValue={g?.discountType === "PERCENT" ? g.discountValue : 10}
          />
        </Field>
      ) : (
        <Field label="Số tiền giảm mỗi phiếu">
          <MoneyInput name="fixed" defaultValue={g?.discountType === "FIXED" ? g.discountValue : 50000} />
        </Field>
      )}
      <Segmented
        layoutId="disc-apply"
        value={applyTo}
        onChange={setApplyTo}
        options={[
          { value: "ALL", label: "Giảm cho mọi em" },
          { value: "FROM_SECOND", label: "Từ em thứ 2" },
        ]}
      />
      {applyTo === "FROM_SECOND" && (
        <p className="text-caption text-muted">Em đầu tiên = em nhập học sớm nhất trong nhóm, giữ nguyên giá.</p>
      )}
      {error && <Notice tone="overdue">{error}</Notice>}
      <Button type="submit" size="lg" block loading={pending} disabled={members.length < 2}>
        Lưu nhóm
      </Button>
      {g && (
        <Button type="button" variant="ghost" block className="text-overdue" onClick={remove} disabled={pending}>
          <Trash2 className="size-4" /> Bỏ nhóm
        </Button>
      )}
    </form>
  );
}

// ───── Mẫu tin nhắn ─────

function Templates({ templates }: { templates: TemplateItem[] }) {
  const [editing, setEditing] = useState<TemplateItem | null>(null);
  const kinds = Object.keys(MESSAGE_KIND_META) as MessageKind[];
  return (
    <>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <MessageSquareHeart className="size-5 text-primary" /> Mẫu tin nhắn
        </span>
      </SectionTitle>
      <div className="space-y-3 pb-10">
        {kinds.map((k) => (
          <Card key={k} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">
                {MESSAGE_KIND_META[k].emoji} {MESSAGE_KIND_META[k].label}
                <span className="ml-2 text-caption font-normal text-muted">{MESSAGE_KIND_META[k].hint}</span>
              </p>
              <button
                type="button"
                onClick={() => setEditing({ id: null, kind: k, title: "", body: "" })}
                className="text-sm font-semibold text-primary"
              >
                + Thêm
              </button>
            </div>
            <ul className="mt-2 space-y-2">
              {templates
                .filter((t) => t.kind === k)
                .map((t, i) => (
                  <li key={`${t.id}-${i}`}>
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="w-full rounded-control bg-surface-subtle px-3 py-2.5 text-left transition hover:bg-line/60"
                    >
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="line-clamp-2 text-caption text-muted">{t.body}</p>
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
      <TemplateSheet value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function TemplateSheet({ value, onClose }: { value: TemplateItem | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(value)} onClose={onClose} title={value ? `Mẫu "${MESSAGE_KIND_META[value.kind].label}"` : ""} size="md">
      {value && <TemplateForm key={`${value.id}-${value.kind}-${value.title}`} value={value} onClose={onClose} />}
    </Sheet>
  );
}

function TemplateForm({ value, onClose }: { value: TemplateItem; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState(value.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (fd: FormData) =>
    start(async () => {
      const res = await saveTemplateAction({ id: value.id, kind: value.kind, title: fd.get("title"), body });
      if (!res.ok) return setError(res.message);
      toast.success("Đã lưu mẫu");
      onClose();
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      if (!value.id) return;
      await deleteTemplateAction(value.id);
      toast.success("Đã xóa mẫu");
      onClose();
      router.refresh();
    });
  return (
    <form action={submit} className="space-y-4 pb-2">
      <Field label="Tên mẫu">
        <Input name="title" defaultValue={value.title} required />
      </Field>
      <Field label="Nội dung">
        <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div>
        <p className="mb-1.5 text-caption font-semibold text-muted">Chạm để chèn thông tin tự điền:</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.label}
              onClick={() => setBody((b) => `${b}{${v.key}}`)}
              className={cn("rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-deep active:scale-95")}
            >
              {`{${v.key}}`}
            </button>
          ))}
        </div>
      </div>
      {error && <Notice tone="overdue">{error}</Notice>}
      <Button type="submit" size="lg" block loading={pending}>
        Lưu mẫu
      </Button>
      {value.id && (
        <Button type="button" variant="ghost" block className="text-overdue" onClick={remove} disabled={pending}>
          Xóa mẫu
        </Button>
      )}
    </form>
  );
}
