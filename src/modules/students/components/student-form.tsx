"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, MoneyInput, parseMoney, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { saveStudentAction } from "@/modules/students/students.actions";
import { todayKey } from "@/lib/dates";
import { formatVnd } from "@/lib/utils";

export type ClassroomOption = { id: string; name: string; shifts: { id: string; name: string }[] };

export type StudentFormValue = {
  id?: string;
  fullName: string;
  classroomId: string;
  shiftId: string | null;
  dob: string | null;
  joinedAt: string;
  school: string | null;
  parentName: string | null;
  parentPhone: string | null;
  studentPhone: string | null;
  unitPrice: number | null;
};

export function StudentForm({
  classrooms,
  initial,
  defaultPrice,
  onSaved,
}: {
  classrooms: ClassroomOption[];
  initial?: StudentFormValue;
  defaultPrice: number;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [classroomId, setClassroomId] = useState(initial?.classroomId ?? classrooms[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shifts = classrooms.find((c) => c.id === classroomId)?.shifts ?? [];

  const submit = (form: FormData) =>
    start(async () => {
      setError(null);
      const price = String(form.get("unitPrice") ?? "").trim();
      const res = await saveStudentAction({
        id: initial?.id,
        fullName: form.get("fullName"),
        classroomId,
        shiftId: form.get("shiftId") || null,
        dob: form.get("dob") || null,
        joinedAt: form.get("joinedAt"),
        school: form.get("school"),
        parentName: form.get("parentName"),
        parentPhone: form.get("parentPhone"),
        studentPhone: form.get("studentPhone"),
        unitPrice: price ? parseMoney(price) : null,
      });
      if (!res.ok) return setError(res.message);
      toast.success(initial?.id ? "Đã lưu thông tin" : "Đã thêm học sinh 🍒");
      if (onSaved) onSaved(res.data.id);
      else router.push(`/hoc-sinh/${res.data.id}`);
      router.refresh();
    });

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Họ và tên" className="sm:col-span-2">
        <Input name="fullName" defaultValue={initial?.fullName} required autoFocus={!initial} placeholder="vd: Nguyễn Văn An" />
      </Field>
      <Field label="Lớp">
        <Select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} required>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ca học chính" hint={shifts.length === 0 ? "Lớp này chưa có ca — tạo ở trang Lớp học" : undefined}>
        <Select key={classroomId} name="shiftId" defaultValue={initial?.classroomId === classroomId ? (initial?.shiftId ?? "") : ""}>
          <option value="">— Chưa xếp ca —</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ngày sinh">
        <Input type="date" name="dob" defaultValue={initial?.dob ?? ""} />
      </Field>
      <Field label="Ngày bắt đầu học" hint="Chu kỳ học phí tính từ buổi đầu em đi học">
        <Input type="date" name="joinedAt" defaultValue={initial?.joinedAt ?? todayKey()} required />
      </Field>
      <Field label="Phụ huynh" hint="vd: Chị Lan — dùng để xưng hô trong tin nhắn">
        <Input name="parentName" defaultValue={initial?.parentName ?? ""} />
      </Field>
      <Field label="SĐT phụ huynh">
        <Input name="parentPhone" inputMode="tel" defaultValue={initial?.parentPhone ?? ""} />
      </Field>
      <Field label="SĐT học sinh">
        <Input name="studentPhone" inputMode="tel" defaultValue={initial?.studentPhone ?? ""} />
      </Field>
      <Field label="Trường">
        <Input name="school" defaultValue={initial?.school ?? ""} />
      </Field>
      <Field label="Đơn giá riêng / buổi" hint={`Để trống = theo mặc định (${formatVnd(defaultPrice)}). Đổi giá chỉ áp dụng từ buổi sau.`} className="sm:col-span-2">
        <MoneyInput name="unitPrice" defaultValue={initial?.unitPrice ?? ""} placeholder={String(defaultPrice).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} />
      </Field>
      {error && (
        <Notice tone="overdue" className="sm:col-span-2">
          {error}
        </Notice>
      )}
      <Button type="submit" size="lg" loading={pending} className="sm:col-span-2">
        {initial?.id ? "Lưu thay đổi" : "Thêm học sinh"}
      </Button>
    </form>
  );
}
