"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronRight, HeartHandshake, Search, Send, Wallet } from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, InvoiceStateChip } from "@/components/ui/feedback";
import { CherryConfetti, CountUp } from "@/components/ui/fx";
import { PageHeader, Segmented } from "@/components/ui/page";
import type { InvoiceDisplayState } from "@/modules/billing/billing.core";
import type { InvoiceListItem } from "@/modules/billing/billing.service";
import { ConfirmClaimSheet } from "@/modules/billing/components/payment-sheets";
import { MessageComposer } from "@/modules/messages/components/message-composer";
import type { TemplateItem } from "@/modules/messages/messages.service";
import { parentAddress } from "@/modules/messages/messages.templates";
import { cn, formatVnd, givenName, removeDiacritics } from "@/lib/utils";

type Tab = "READY" | "CLAIMED" | "OVERDUE" | "WAITING" | "PAID";

const TABS: { value: Tab; label: string; states: InvoiceDisplayState[] }[] = [
  { value: "READY", label: "Cần gửi", states: ["READY"] },
  { value: "CLAIMED", label: "Chờ xác nhận", states: ["CLAIMED"] },
  { value: "OVERDUE", label: "Quá hạn", states: ["OVERDUE"] },
  { value: "WAITING", label: "Chờ đóng", states: ["WAITING", "PARTIAL"] },
  { value: "PAID", label: "Đã thu", states: ["PAID"] },
];

const EMPTY: Record<Tab, { title: string; text: string; mood: "sleepy" | "celebrate" | "happy" }> = {
  READY: { title: "Chưa có phiếu nào cần gửi", text: "Em nào đủ buổi, phiếu sẽ tự hiện ở đây ạ.", mood: "sleepy" },
  CLAIMED: { title: "Không có khoản nào chờ xác nhận", text: "Khi phụ huynh bấm 'Tôi đã chuyển khoản', em báo cô ngay.", mood: "happy" },
  OVERDUE: { title: "Không có phiếu quá hạn 🎉", text: "Phụ huynh lớp cô đóng đúng hẹn ghê!", mood: "celebrate" },
  WAITING: { title: "Không có phiếu đang chờ", text: "Mọi phiếu đã gửi đều được đóng rồi ạ.", mood: "celebrate" },
  PAID: { title: "Chưa có phiếu đã thu", text: "", mood: "sleepy" },
};

export function InvoiceBoard({
  invoices,
  outstanding,
  initialTab,
  templates,
  teacherName,
  quietHours,
  appUrl,
}: {
  invoices: InvoiceListItem[];
  outstanding: { total: number; students: number };
  initialTab?: string;
  templates: TemplateItem[];
  teacherName: string;
  quietHours: { from: string; to: string };
  appUrl: string;
}) {
  const router = useRouter();
  const counts = useMemo(() => {
    const c = {} as Record<Tab, number>;
    for (const t of TABS) c[t.value] = invoices.filter((i) => t.states.includes(i.state)).length;
    return c;
  }, [invoices]);
  const firstNonEmpty = TABS.find((t) => counts[t.value] > 0 && t.value !== "PAID")?.value ?? "PAID";
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === initialTab) ? (initialTab as Tab) : firstNonEmpty);
  const [q, setQ] = useState("");
  const [composeFor, setComposeFor] = useState<InvoiceListItem | null>(null);
  const [claimFor, setClaimFor] = useState<InvoiceListItem | null>(null);
  const [confetti, setConfetti] = useState(0);

  const states = TABS.find((t) => t.value === tab)!.states;
  const list = invoices
    .filter((i) => states.includes(i.state))
    .filter((i) => !q.trim() || removeDiacritics(i.student.fullName).includes(removeDiacritics(q)))
    .sort((a, b) => (tab === "PAID" ? b.issuedAt.localeCompare(a.issuedAt) : (b.daysSinceSent ?? 0) - (a.daysSinceSent ?? 0)));

  const totalInTab = list.reduce((s, i) => s + (tab === "PAID" ? i.amount : i.totalDue), 0);

  return (
    <div>
      <CherryConfetti fire={confetti} />
      <PageHeader title="Thu tiền" subtitle="Phiếu tự tạo khi em đủ chu kỳ — cô chỉ cần gửi và xác nhận" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-hero relative overflow-hidden rounded-card p-5 text-white shadow-pop"
      >
        <div className="sparkle-overlay absolute inset-0" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/80">Còn cần thu</p>
            <p className="mt-1 text-[2.25rem] font-extrabold leading-none tracking-tight">
              <CountUp value={outstanding.total} format={formatVnd} />
            </p>
            <p className="mt-1.5 text-sm text-white/85">từ {outstanding.students} em</p>
          </div>
          <Wallet className="size-14 text-white/30" />
        </div>
      </motion.div>

      <div className="sticky top-14 z-20 -mx-4 mt-5 bg-background/90 px-4 py-2 backdrop-blur lg:top-0">
        <Segmented
          layoutId="bill-tab"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ value: t.value, label: t.label, count: t.value === "PAID" ? undefined : counts[t.value] }))}
        />
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lọc theo tên…"
            className="min-h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {list.length > 0 && (
        <p className="mb-2 mt-2 px-1 text-sm text-muted">
          {list.length} phiếu · <b className="text-foreground">{formatVnd(totalInTab)}</b>
        </p>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        {list.length === 0 ? (
          <motion.div key={`empty-${tab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
            <EmptyState mood={EMPTY[tab].mood} title={EMPTY[tab].title} description={EMPTY[tab].text} />
          </motion.div>
        ) : (
          <motion.ul key={tab} className="space-y-2.5" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            {list.slice(0, 120).map((inv, i) => (
              <motion.li
                key={inv.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.03 } }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 shadow-card">
                  <Link href={`/thu-tien/${inv.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <StudentAvatar name={inv.student.fullName} hue={inv.student.avatarHue} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-bold">
                        {inv.student.fullName}
                        {inv.student.hardship && <HeartHandshake className="size-4 shrink-0 text-grape" aria-label="Gia đình khó khăn" />}
                      </p>
                      <p className="truncate text-caption text-muted">
                        {inv.student.classroom} · {inv.sessionCount} buổi · {inv.code}
                        {inv.daysSinceSent !== null && inv.state !== "PAID" ? ` · gửi ${inv.daysSinceSent} ngày trước` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <InvoiceStateChip state={inv.state} />
                        {inv.priorDebt > 0 && inv.state !== "PAID" && (
                          <span className="text-caption font-semibold text-amber">+ nợ cũ {formatVnd(inv.priorDebt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-extrabold tabular", inv.state === "PAID" ? "text-leaf" : "text-foreground")}>
                        {formatVnd(inv.state === "PAID" ? inv.amount : inv.totalDue)}
                      </p>
                    </div>
                  </Link>
                  <div className="hidden sm:block">
                    <RowAction inv={inv} onCompose={() => setComposeFor(inv)} onClaim={() => setClaimFor(inv)} />
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted sm:hidden" />
                </div>
                <div className="mt-1.5 flex justify-end sm:hidden">
                  <RowAction inv={inv} onCompose={() => setComposeFor(inv)} onClaim={() => setClaimFor(inv)} />
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {composeFor && (
        <MessageComposer
          open
          onClose={() => setComposeFor(null)}
          kinds={["FEE_SOFT", "FEE_GENTLE", "FEE_CLEAR"]}
          initialKind={composeFor.state === "READY" ? "FEE_SOFT" : composeFor.tone}
          templates={templates}
          hardship={composeFor.student.hardship}
          quietHours={quietHours}
          studentId={composeFor.student.id}
          invoiceId={composeFor.id}
          markSentOnCopy={composeFor.state === "READY"}
          onDone={() => router.refresh()}
          vars={{
            tenPhuHuynh: parentAddress(composeFor.student.parentName),
            tenCon: givenName(composeFor.student.fullName),
            hoTenCon: composeFor.student.fullName,
            lop: composeFor.student.classroom,
            soBuoi: composeFor.sessionCount,
            soTien: formatVnd(composeFor.totalDue),
            link: `${appUrl}/p/${composeFor.publicToken}`,
            tenCo: teacherName,
          }}
        />
      )}
      <ConfirmClaimSheet
        claim={claimFor?.claim ?? null}
        studentName={claimFor ? givenName(claimFor.student.fullName) : ""}
        onClose={() => setClaimFor(null)}
        onConfirmed={() => setConfetti((n) => n + 1)}
      />
    </div>
  );
}

function RowAction({ inv, onCompose, onClaim }: { inv: InvoiceListItem; onCompose: () => void; onClaim: () => void }) {
  if (inv.state === "CLAIMED" && inv.claim)
    return (
      <Button size="sm" variant="leaf" onClick={onClaim}>
        <CheckCircle2 className="size-4" /> Xác nhận
      </Button>
    );
  if (inv.state === "PAID") return null;
  return (
    <Button size="sm" variant={inv.state === "READY" ? "primary" : "soft"} onClick={onCompose}>
      <Send className="size-4" /> {inv.state === "READY" ? "Gửi phiếu" : "Nhắc"}
    </Button>
  );
}
