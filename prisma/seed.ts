/**
 * Dữ liệu mẫu cho môi trường dev — CHẠY LẠI ĐƯỢC (xóa sạch dữ liệu cũ rồi tạo mới).
 *   3 lớp · 10 ca · 150 học sinh tên tiếng Việt · ~2 tháng điểm danh (08/08 → hôm qua)
 *   phiếu thu ở đủ trạng thái · thu tiền · chi phí.
 *
 * Phiếu thu được tạo bằng CHÍNH hàm issueDueInvoices của app (không tính tay ở đây),
 * nên số liệu mẫu đi qua đúng lõi tính tiền đã có unit test.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import type { Prisma } from "../src/generated/prisma/client";
import { DEFAULT_BILLING_SETTINGS, effectiveUnitPrice, isBillable } from "../src/modules/billing/billing.core";
import { issueDueInvoices } from "../src/modules/billing/billing.service";
import { ensureSessions } from "../src/modules/classes/classes.service";
import { DEFAULT_TEMPLATES } from "../src/modules/messages/messages.templates";
import { DEFAULT_SETTINGS, saveSetting } from "../src/modules/settings/settings.service";
import { addDays, fromDbDate, todayKey, toDbDate, vnDayStartUtc, weekdayOf } from "../src/lib/dates";
import { hueFromString, removeDiacritics } from "../src/lib/utils";
import { prisma } from "../src/shared/prisma/prisma.service";
import { seedPhase2 } from "./seed-phase2";

// ─────────── Số ngẫu nhiên CỐ ĐỊNH (chạy lại ra cùng dữ liệu) ───────────
let state = 20261008;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const chance = (p: number) => rand() < p;
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Trịnh"];
const DEM_NAM = ["Văn", "Minh", "Đức", "Quang", "Hoàng", "Gia", "Anh", "Tuấn", "Thành", "Hữu", "Bảo", "Nhật", "Trọng"];
const DEM_NU = ["Thị", "Ngọc", "Thu", "Phương", "Khánh", "Bảo", "Minh", "Hoài", "Thảo", "Mai", "Gia", "Diệu", "Hà"];
const TEN_NAM = ["An", "Bình", "Cường", "Dũng", "Đạt", "Hiếu", "Huy", "Khang", "Khoa", "Long", "Minh", "Nam", "Phong", "Phúc", "Quân", "Sơn", "Tài", "Thắng", "Trung", "Tùng", "Việt", "Vinh", "Kiên", "Hưng", "Duy", "Lâm", "Nghĩa", "Tiến"];
const TEN_NU = ["Anh", "Chi", "Diệp", "Giang", "Hà", "Hân", "Hương", "Lan", "Linh", "Ly", "Mai", "My", "Ngân", "Nhi", "Oanh", "Quỳnh", "Trang", "Thư", "Vy", "Yến", "Hạnh", "Thảo", "Uyên", "Ngọc", "Tâm", "Khuê"];
const TRUONG = ["THCS Nguyễn Du", "THCS Lê Quý Đôn", "THCS Trưng Vương", "THCS Chu Văn An", "THCS Ngô Sĩ Liên", "THCS Thành Công"];

const SEED_START = "2026-08-08";
const TODAY = todayKey();
const YESTERDAY = addDays(TODAY, -1);

type ShiftDef = { name: string; room: string; slots: { weekday: number; start: string; end: string }[] };
const CLASSROOMS: { name: string; grade: number; color: string; sizes: number[]; shifts: ShiftDef[] }[] = [
  {
    name: "Lớp 8",
    grade: 8,
    color: "#F97316",
    sizes: [13, 13, 12, 12],
    shifts: [
      { name: "Ca 1", room: "Phòng 1", slots: [{ weekday: 1, start: "17:30", end: "19:00" }, { weekday: 4, start: "17:30", end: "19:00" }] },
      { name: "Ca 2", room: "Phòng 1", slots: [{ weekday: 2, start: "17:30", end: "19:00" }, { weekday: 5, start: "17:30", end: "19:00" }] },
      { name: "Ca 3", room: "Phòng 2", slots: [{ weekday: 6, start: "08:00", end: "09:30" }, { weekday: 7, start: "08:00", end: "09:30" }] },
      { name: "Ca 4", room: "Phòng 2", slots: [{ weekday: 6, start: "14:00", end: "15:30" }, { weekday: 7, start: "14:00", end: "15:30" }] },
    ],
  },
  {
    name: "Lớp 9A",
    grade: 9,
    color: "#E11D48",
    sizes: [17, 17, 16],
    shifts: [
      { name: "Ca 1", room: "Phòng 1", slots: [{ weekday: 1, start: "19:15", end: "20:45" }, { weekday: 4, start: "19:15", end: "20:45" }] },
      { name: "Ca 2", room: "Phòng 1", slots: [{ weekday: 3, start: "17:30", end: "19:00" }, { weekday: 7, start: "17:30", end: "19:00" }] },
      { name: "Ca 3", room: "Phòng 2", slots: [{ weekday: 6, start: "09:45", end: "11:15" }, { weekday: 7, start: "09:45", end: "11:15" }] },
    ],
  },
  {
    name: "Lớp 9B",
    grade: 9,
    color: "#8B5CF6",
    sizes: [17, 17, 16],
    shifts: [
      { name: "Ca 1", room: "Phòng 1", slots: [{ weekday: 2, start: "19:15", end: "20:45" }, { weekday: 5, start: "19:15", end: "20:45" }] },
      { name: "Ca 2", room: "Phòng 1", slots: [{ weekday: 3, start: "19:15", end: "20:45" }, { weekday: 7, start: "19:15", end: "20:45" }] },
      { name: "Ca 3", room: "Phòng 2", slots: [{ weekday: 6, start: "15:45", end: "17:15" }, { weekday: 7, start: "15:45", end: "17:15" }] },
    ],
  },
];

async function wipe() {
  // Thứ tự xóa theo khóa ngoại.
  await prisma.messageLog.deleteMany();
  await prisma.invoiceAdjustment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.submissionPage.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignmentTarget.deleteMany();
  await prisma.assignmentFile.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.parentLink.deleteMany();
  await prisma.studentNote.deleteMany();
  await prisma.student.deleteMany();
  await prisma.siblingGroup.deleteMany();
  await prisma.shiftSchedule.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

/** Giờ VN (vd "20:30") của một ngày → Date UTC. */
function at(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00.000+07:00`);
}

async function main() {
  const t0 = Date.now();
  console.log("🍒 Xóa dữ liệu cũ…");
  await wipe();

  // ─────────── Tài khoản & cài đặt ───────────
  const teacher = await prisma.user.create({
    data: {
      email: process.env.SEED_TEACHER_EMAIL ?? "co.ha@teamcherry.vn",
      username: (process.env.SEED_TEACHER_EMAIL ?? "co.ha@teamcherry.vn").toLowerCase(),
      passwordHash: await bcrypt.hash(process.env.SEED_DEFAULT_PASSWORD ?? "Cherry@2026", 10),
      displayName: "cô Hà",
      role: "TEACHER",
    },
  });
  await saveSetting("teacherName", "cô Hà");
  await saveSetting("billing", DEFAULT_BILLING_SETTINGS);
  await saveSetting("bank", { bin: "970436", bankName: "Vietcombank", accountNo: "1029384756", accountName: "NGUYEN THU HA" });
  await saveSetting("reminders", DEFAULT_SETTINGS.reminders);
  await saveSetting("quietHours", DEFAULT_SETTINGS.quietHours);
  await saveSetting("examDate", "2027-06-02");
  const settings = DEFAULT_BILLING_SETTINGS;

  await prisma.messageTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((t, i) => ({ ...t, isDefault: true, sortOrder: i })),
  });

  const categories = await Promise.all(
    [
      { name: "Photo đề", icon: "printer", color: "#0EA5E9" },
      { name: "Thuê phòng", icon: "home", color: "#8B5CF6" },
      { name: "Điện nước", icon: "zap", color: "#F59E0B" },
      { name: "Quà cho học sinh", icon: "gift", color: "#E11D48" },
      { name: "Văn phòng phẩm", icon: "pencil", color: "#16A34A" },
      { name: "Khác", icon: "shapes", color: "#64748B" },
    ].map((c, i) => prisma.expenseCategory.create({ data: { ...c, sortOrder: i } })),
  );

  // ─────────── Lớp · ca · học sinh ───────────
  console.log("🍒 Tạo lớp, ca và 150 học sinh…");
  const usedNames = new Set<string>();
  const usedPhones = new Set<string>();
  let seq = 0;
  type SeedStudent = {
    id: string;
    fullName: string;
    shiftId: string;
    joinedAt: string;
    leftOn: string | null; // tạm nghỉ / đã nghỉ từ ngày này
    absentFrom: string | null; // vắng liên tục từ ngày này (để có việc "hỏi thăm")
    unitPrice: number | null;
    priceFrom?: { date: string; price: number };
  };
  const students: SeedStudent[] = [];

  function makeName(): string {
    for (;;) {
      const female = chance(0.5);
      const name = `${pick(HO)} ${pick(female ? DEM_NU : DEM_NAM)} ${pick(female ? TEN_NU : TEN_NAM)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
  }
  function makePhone(): string {
    for (;;) {
      const p = `0${pick(["9", "8", "3", "7"])}${String(int(10_000_000, 99_999_999))}`;
      if (!usedPhones.has(p)) {
        usedPhones.add(p);
        return p;
      }
    }
  }

  // Các em trong ví dụ của tài liệu thiết kế — để cô dễ đối chiếu.
  const SPECIAL: Record<string, Partial<SeedStudent> & { fullName: string; classroom: string; shift: string }> = {
    an: { fullName: "Nguyễn Văn An", classroom: "Lớp 9B", shift: "Ca 1", joinedAt: "2026-09-15" },
    binh: { fullName: "Trần Minh Bình", classroom: "Lớp 9A", shift: "Ca 2" },
    chau: { fullName: "Trần Minh Châu", classroom: "Lớp 8", shift: "Ca 2" },
    dung: { fullName: "Lê Hoàng Dũng", classroom: "Lớp 8", shift: "Ca 1" },
  };
  for (const s of Object.values(SPECIAL)) usedNames.add(s.fullName);
  const specialIds: Record<string, string> = {};

  for (const cls of CLASSROOMS) {
    const classroom = await prisma.classroom.create({
      data: { name: cls.name, grade: cls.grade, color: cls.color, sortOrder: cls.grade },
    });
    for (let si = 0; si < cls.shifts.length; si++) {
      const def = cls.shifts[si];
      const shift = await prisma.shift.create({
        data: {
          classroomId: classroom.id,
          name: def.name,
          room: def.room,
          createdAt: at("2026-08-01", "08:00"),
          schedules: { create: def.slots.map((s) => ({ weekday: s.weekday, startTime: s.start, endTime: s.end })) },
        },
      });
      const specials = Object.entries(SPECIAL).filter(([, s]) => s.classroom === cls.name && s.shift === def.name);
      for (let k = 0; k < cls.sizes[si]; k++) {
        const special = specials[k];
        const fullName = special ? special[1].fullName : makeName();
        seq += 1;
        const code = `HS${String(seq).padStart(4, "0")}`;
        const late = chance(0.12);
        const joinedAt = special?.[1].joinedAt ?? (late ? addDays("2026-08-20", int(0, 30)) : "2026-08-03");
        const birthYear = cls.grade === 8 ? 2012 : 2011;
        // Hai em có sinh nhật hôm nay để trang Hôm nay có lời nhắc.
        const dob = seq === 7 || seq === 88 ? `${birthYear}${TODAY.slice(4)}` : `${birthYear}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
        const parentGiven = pick(chance(0.6) ? TEN_NU : TEN_NAM);
        const parentName = `${chance(0.6) ? "Chị" : "Anh"} ${parentGiven}`;
        const row = await prisma.student.create({
          data: {
            code,
            fullName,
            searchName: removeDiacritics(fullName),
            classroomId: classroom.id,
            shiftId: shift.id,
            dob: toDbDate(dob),
            school: pick(TRUONG),
            parentName,
            parentPhone: makePhone(),
            studentPhone: cls.grade === 9 && chance(0.7) ? makePhone() : null,
            joinedAt: toDbDate(joinedAt),
            avatarHue: hueFromString(`${code}${fullName}`),
            createdAt: at(joinedAt, "09:00"),
          },
        });
        if (special) specialIds[special[0]] = row.id;
        students.push({
          id: row.id,
          fullName,
          shiftId: shift.id,
          joinedAt,
          leftOn: null,
          absentFrom: null,
          unitPrice: null,
        });
      }
    }
  }

  // Trạng thái đặc biệt
  const byId = new Map(students.map((s) => [s.id, s]));
  const regular = students.filter((s) => !Object.values(specialIds).includes(s.id));
  const pickRegular = () => {
    for (;;) {
      const s = pick(regular);
      if (!s.leftOn && !s.absentFrom && s.unitPrice === null) return s;
    }
  };
  for (let i = 0; i < 3; i++) {
    const s = pickRegular();
    s.leftOn = "2026-09-26";
    await prisma.student.update({ where: { id: s.id }, data: { status: "PAUSED", statusChangedAt: at("2026-09-26", "10:00") } });
  }
  for (let i = 0; i < 2; i++) {
    const s = pickRegular();
    s.leftOn = "2026-09-10";
    await prisma.student.update({ where: { id: s.id }, data: { status: "LEFT", statusChangedAt: at("2026-09-10", "10:00") } });
  }
  // Hai em vắng liên tục mấy buổi gần đây → việc "hỏi thăm".
  for (let i = 0; i < 2; i++) pickRegular().absentFrom = addDays(TODAY, -6);

  // Hoàn cảnh khó khăn + đơn giá riêng
  const hardship: string[] = [];
  for (let i = 0; i < 3; i++) {
    const s = pickRegular();
    s.unitPrice = 60_000;
    hardship.push(s.id);
    await prisma.student.update({ where: { id: s.id }, data: { hardship: true, unitPrice: 60_000 } });
    await prisma.studentNote.create({
      data: { studentId: s.id, content: pick(["Bố mẹ đi làm xa, con ở với bà.", "Mẹ đang điều trị bệnh, kinh tế khó khăn.", "Nhà đông anh em, cô giảm học phí."]) },
    });
  }
  for (let i = 0; i < 4; i++) {
    const s = pickRegular();
    s.unitPrice = 70_000;
    await prisma.student.update({ where: { id: s.id }, data: { unitPrice: 70_000 } });
  }
  // Bình: tăng đơn giá lên 90.000đ từ 01/10 (ví dụ 2).
  byId.get(specialIds.binh)!.priceFrom = { date: "2026-10-01", price: 90_000 };

  // Nhóm anh chị em
  const binhChau = await prisma.siblingGroup.create({
    data: { label: "Nhà anh Tuấn (Bình, Châu)", discountType: "PERCENT", discountValue: 10, applyTo: "ALL" },
  });
  await prisma.student.updateMany({ where: { id: { in: [specialIds.binh, specialIds.chau] } }, data: { siblingGroupId: binhChau.id } });
  for (let i = 0; i < 4; i++) {
    const a = pickRegular();
    let b = pickRegular();
    while (b.id === a.id) b = pickRegular();
    const fixed = i === 3;
    const g = await prisma.siblingGroup.create({
      data: {
        label: `Nhà ${a.fullName.split(" ")[0]} ${a.fullName.split(" ").at(-1)} & ${b.fullName.split(" ").at(-1)}`,
        discountType: fixed ? "FIXED" : "PERCENT",
        discountValue: fixed ? 50_000 : 10,
        applyTo: fixed ? "FROM_SECOND" : "ALL",
      },
    });
    await prisma.student.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { siblingGroupId: g.id } });
    // Anh chị em thường chung phụ huynh
    const parent = await prisma.student.findUniqueOrThrow({ where: { id: a.id }, select: { parentName: true, parentPhone: true } });
    await prisma.student.update({ where: { id: b.id }, data: parent });
    a.unitPrice = a.unitPrice ?? null;
  }

  // ─────────── Buổi học ───────────
  console.log("🍒 Sinh buổi học và điểm danh 2 tháng…");
  await ensureSessions(SEED_START, addDays(TODAY, 21));
  // Nghỉ lễ 2/9 và một ngày cô ốm.
  const cancelDays: Record<string, string> = { "2026-09-02": "Nghỉ lễ Quốc khánh 2/9", "2026-09-19": "Cô bị ốm" };
  for (const [day, reason] of Object.entries(cancelDays)) {
    await prisma.session.updateMany({ where: { date: toDbDate(day) }, data: { status: "CANCELLED", cancelReason: reason } });
  }

  const sessions = await prisma.session.findMany({
    where: { date: { gte: toDbDate(SEED_START), lte: toDbDate(YESTERDAY) }, status: "SCHEDULED" },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: { id: true, shiftId: true, date: true, endTime: true },
  });

  const byShift = new Map<string, SeedStudent[]>();
  for (const s of students) byShift.set(s.shiftId, [...(byShift.get(s.shiftId) ?? []), s]);

  const anRows: Record<string, "EXCUSED"> = { "2026-09-25": "EXCUSED" }; // ví dụ 1
  const dungRows: Record<string, "UNEXCUSED"> = { "2026-09-14": "UNEXCUSED" }; // ví dụ 3
  let invoiceCount = 0;

  for (const session of sessions) {
    const date = fromDbDate(session.date);
    // Bỏ sót điểm danh 1 buổi tuần này để có việc "chưa điểm danh".
    if (date === addDays(TODAY, -2) && weekdayOf(date) <= 6 && session.endTime === "19:00") continue;

    const members = (byShift.get(session.shiftId) ?? []).filter(
      (s) => s.joinedAt <= date && (!s.leftOn || date < s.leftOn),
    );
    const rows: Prisma.AttendanceCreateManyInput[] = members.map((s) => {
      let status: "PRESENT" | "EXCUSED" | "UNEXCUSED" =
        chance(0.91) ? "PRESENT" : chance(0.55) ? "EXCUSED" : "UNEXCUSED";
      if (s.id === specialIds.an) status = anRows[date] ?? "PRESENT";
      if (s.id === specialIds.dung) status = dungRows[date] ?? "PRESENT";
      if (s.id === specialIds.binh || s.id === specialIds.chau) status = "PRESENT";
      if (s.absentFrom && date >= s.absentFrom) status = "UNEXCUSED";
      const price = s.priceFrom && date >= s.priceFrom.date ? s.priceFrom.price : effectiveUnitPrice(s.unitPrice, settings);
      return {
        sessionId: session.id,
        studentId: s.id,
        date: session.date,
        status,
        note: status === "PRESENT" && chance(0.03) ? pick(["Làm bài tốt", "Đi muộn 10 phút", "Quên vở"]) : null,
        billable: isBillable(status, settings),
        unitPrice: price,
      };
    });
    // Thỉnh thoảng có em học bù từ ca khác.
    if (chance(0.08)) {
      const other = pick(students.filter((s) => s.shiftId !== session.shiftId && s.joinedAt <= date && !s.leftOn));
      if (other && !rows.some((r) => r.studentId === other.id) && !Object.values(specialIds).includes(other.id)) {
        rows.push({
          sessionId: session.id,
          studentId: other.id,
          date: session.date,
          status: "PRESENT",
          isMakeup: true,
          billable: true,
          unitPrice: effectiveUnitPrice(other.unitPrice, settings),
        });
      }
    }
    await prisma.attendance.createMany({ data: rows });
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: at(date, session.endTime) },
    });

    for (const r of rows) {
      const issued = await issueDueInvoices(prisma as unknown as Prisma.TransactionClient, r.studentId, settings, teacher.id);
      for (const inv of issued) {
        invoiceCount += 1;
        await prisma.invoice.update({ where: { id: inv.id }, data: { issuedAt: at(date, session.endTime) } });
      }
    }
  }

  // Bình được tăng giá chính thức từ 01/10.
  await prisma.student.update({ where: { id: specialIds.binh }, data: { unitPrice: 90_000 } });

  // ─────────── Gửi phiếu & thu tiền ───────────
  console.log("🍒 Gửi phiếu, thu tiền…");
  const invoices = await prisma.invoice.findMany({ orderBy: { issuedAt: "asc" } });
  const nowMs = Date.now();
  const claimed: { invoiceId: string; studentId: string; amount: number; code: string }[] = [];
  for (const inv of invoices) {
    const issuedDay = todayKey(inv.issuedAt);
    if (issuedDay >= addDays(TODAY, -1)) continue; // phiếu mới tinh → "Cần gửi"
    const sentAt = new Date(inv.issuedAt.getTime() + int(1, 20) * 3_600_000);
    if (sentAt.getTime() > nowMs) continue;
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "SENT", sentAt } });
    await prisma.messageLog.create({
      data: { invoiceId: inv.id, studentId: inv.studentId, kind: "FEE_SOFT", content: "(tin mẫu)", createdAt: sentAt },
    });

    const isDung = inv.studentId === specialIds.dung;
    const roll = rand();
    const payDay = new Date(sentAt.getTime() + int(1, 6) * 86_400_000);
    if (isDung && inv.cycleNo === 1) {
      // Ví dụ 3: đóng thiếu 500.000đ
      if (payDay.getTime() < nowMs)
        await prisma.payment.create({
          data: { studentId: inv.studentId, invoiceId: inv.id, amount: 500_000, paidAt: payDay, method: "BANK_TRANSFER", status: "CONFIRMED", confirmedAt: payDay, source: "PARENT_CLAIM", note: "Phụ huynh xin đóng trước một phần" },
        });
      continue;
    }
    if (hardship.includes(inv.studentId) && chance(0.5)) continue; // chưa đóng — cô tạm không nhắc
    if (roll < 0.72 && payDay.getTime() < nowMs) {
      const cash = chance(0.1);
      await prisma.payment.create({
        data: {
          studentId: inv.studentId,
          invoiceId: inv.id,
          amount: inv.amount,
          paidAt: payDay,
          method: cash ? "CASH" : "BANK_TRANSFER",
          source: cash ? "MANUAL" : "PARENT_CLAIM",
          status: "CONFIRMED",
          confirmedAt: payDay,
        },
      });
    } else if (roll < 0.8 && payDay.getTime() < nowMs) {
      const part = Math.max(100_000, Math.floor((inv.amount * (0.5 + rand() * 0.3)) / 50_000) * 50_000);
      await prisma.payment.create({
        data: { studentId: inv.studentId, invoiceId: inv.id, amount: part, paidAt: payDay, method: "BANK_TRANSFER", status: "CONFIRMED", confirmedAt: payDay, source: "PARENT_CLAIM" },
      });
    } else if (roll < 0.87 && claimed.length < 4) {
      claimed.push({ invoiceId: inv.id, studentId: inv.studentId, amount: inv.amount, code: inv.code });
    }
  }
  for (const c of claimed) {
    const when = new Date(nowMs - int(1, 30) * 3_600_000);
    await prisma.payment.create({
      data: { studentId: c.studentId, invoiceId: c.invoiceId, amount: c.amount, paidAt: when, method: "BANK_TRANSFER", source: "PARENT_CLAIM", status: "PENDING" },
    });
    const st = await prisma.student.findUniqueOrThrow({ where: { id: c.studentId }, select: { fullName: true } });
    await prisma.notification.create({
      data: {
        userId: teacher.id,
        kind: "PARENT_PAYMENT_CLAIM",
        title: `Phụ huynh ${st.fullName} báo đã chuyển ${c.amount.toLocaleString("vi-VN")}đ`,
        body: `Phiếu ${c.code} — cô kiểm tra tài khoản rồi xác nhận giúp em nhé.`,
        link: `/thu-tien/${c.invoiceId}`,
        createdAt: when,
      },
    });
  }

  // ─────────── Chi phí ───────────
  console.log("🍒 Chi phí 2 tháng…");
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;
  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  for (const month of ["2026-08", "2026-09", "2026-10"]) {
    const d = (day: number) => toDbDate(`${month}-${String(day).padStart(2, "0")}`);
    expenses.push({ categoryId: cat("Thuê phòng"), amount: 2_500_000, spentOn: d(5), note: "Tiền phòng học tháng" });
    if (month !== "2026-10") {
      expenses.push({ categoryId: cat("Điện nước"), amount: int(32, 48) * 10_000, spentOn: d(25), note: "Điện + nước" });
      for (const day of [3, 10, 17, 24]) {
        expenses.push({ categoryId: cat("Photo đề"), amount: int(12, 30) * 10_000, spentOn: d(day), note: `Photo đề tuần ${Math.ceil(day / 7)}` });
      }
      expenses.push({ categoryId: cat("Văn phòng phẩm"), amount: int(8, 20) * 10_000, spentOn: d(int(1, 28)), note: "Bút, giấy kiểm tra" });
    } else {
      expenses.push({ categoryId: cat("Photo đề"), amount: 240_000, spentOn: d(2), note: "Photo đề kiểm tra giữa kỳ" });
    }
  }
  expenses.push({ categoryId: cat("Quà cho học sinh"), amount: 650_000, spentOn: toDbDate("2026-09-25"), note: "Bánh Trung thu cho cả lớp 🥮" });
  expenses.push({ categoryId: cat("Quà cho học sinh"), amount: 180_000, spentOn: toDbDate("2026-08-29"), note: "Phần thưởng em tiến bộ" });
  expenses.push({ categoryId: cat("Khác"), amount: 120_000, spentOn: toDbDate("2026-09-08"), note: "Sửa quạt phòng 2" });
  await prisma.expense.createMany({ data: expenses.filter((e) => fromDbDate(e.spentOn as Date) <= TODAY) });

  const [nStudents, nAtt, nInv, nPay] = await Promise.all([
    prisma.student.count(),
    prisma.attendance.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
  ]);
  console.log(
    `✅ Xong trong ${((Date.now() - t0) / 1000).toFixed(1)}s: ${nStudents} học sinh · ${nAtt} lượt điểm danh · ${nInv} phiếu (${invoiceCount} tạo qua issueDueInvoices) · ${nPay} khoản thu · ${expenses.length} khoản chi`,
  );
  console.log("🍒 Giai đoạn 2: tài khoản, bài tập, bài nộp…");
  const p2 = await seedPhase2(teacher.id, specialIds, { rand, chance, int, pick });
  console.log(`   ${p2.pages} trang bài làm đã tải lên MinIO`);
  console.log(`   Đăng nhập cô giáo: ${teacher.email} / ${process.env.SEED_DEFAULT_PASSWORD ?? "Cherry@2026"}`);
  console.log(`   Học sinh (Trần Minh Bình, 9A): ${p2.studentLogin} / ${p2.password}`);
  console.log(`   Phụ huynh (Bình + Châu): ${p2.parentLogin} / ${p2.password}`);
  console.log(`   Hôm nay (VN): ${TODAY} · bắt đầu dữ liệu: ${SEED_START} · ${vnDayStartUtc(TODAY).toISOString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
