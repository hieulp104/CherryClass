/**
 * Dữ liệu mẫu Giai đoạn 2: tài khoản học sinh / phụ huynh, bài tập, bài nộp có ảnh, điểm, nét chấm.
 * Gọi từ prisma/seed.ts sau khi đã có học sinh + điểm danh.
 * Ảnh đề / bài làm vẽ bằng SVG → JPEG (sharp) rồi đẩy lên MinIO như ảnh thật.
 */
import bcrypt from "bcryptjs";
import sharp from "sharp";

import type { Prisma } from "../src/generated/prisma/client";
import { createParentAccount, createStudentAccount } from "../src/modules/accounts/accounts.service";
import { buildObjectKey, putObject } from "../src/lib/minio";
import { addDays, todayKey } from "../src/lib/dates";
import { prisma } from "../src/shared/prisma/prisma.service";

type Rand = { rand: () => number; chance: (p: number) => boolean; int: (a: number, b: number) => number; pick: <T>(l: readonly T[]) => T };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Trang đề in: tiêu đề + các bài toán. */
function examSvg(title: string, lines: string[]) {
  const body = lines.map((l, i) => `<text x="70" y="${190 + i * 62}" font-size="30" fill="#222">${esc(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1360">
    <rect width="1000" height="1360" fill="#fdfdfb"/>
    <text x="500" y="90" font-size="40" font-weight="700" text-anchor="middle" fill="#111">${esc(title)}</text>
    <line x1="70" y1="120" x2="930" y2="120" stroke="#999" stroke-width="2"/>
    ${body}
  </svg>`;
}

/** Trang vở ô li có "chữ viết tay" (nét sóng) + vài dòng lời giải. */
function workSvg(name: string, page: number, r: Rand) {
  const lines: string[] = [];
  for (let y = 120; y < 1300; y += 44) lines.push(`<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="#c7d7ef" stroke-width="1.5"/>`);
  const ink = r.pick(["#1d3a8a", "#1f2937", "#3730a3"]);
  const scribbles: string[] = [];
  const formulas = ["x² − 5x + 6 = 0", "Δ = b² − 4ac = 1", "x₁ = 3 ; x₂ = 2", "∠ABC + ∠ADC = 180°", "⇒ tứ giác ABCD nội tiếp", "S = ½·a·h = 24 cm²", "Vậy x = 4"];
  for (let row = 0; row < 18; row++) {
    const y = 160 + row * 44 + r.int(-4, 4);
    if (row % 4 === 0) {
      scribbles.push(`<text x="${r.int(70, 110)}" y="${y}" font-size="30" font-style="italic" fill="${ink}">${esc(r.pick(formulas))}</text>`);
      continue;
    }
    let d = `M ${r.int(70, 110)} ${y}`;
    let x = 110;
    const end = r.int(500, 900);
    while (x < end) {
      x += r.int(14, 26);
      d += ` q ${r.int(4, 9)} ${r.int(-14, -6)} ${r.int(10, 16)} 0 t ${r.int(10, 16)} 0`;
    }
    scribbles.push(`<path d="${d}" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1360">
    <rect width="1000" height="1360" fill="#fffef6"/>
    ${lines.join("")}
    <line x1="60" y1="0" x2="60" y2="1360" stroke="#f3a5a5" stroke-width="2"/>
    <text x="80" y="70" font-size="30" font-style="italic" fill="${ink}">${esc(name)} — trang ${page}</text>
    ${scribbles.join("")}
  </svg>`;
}

/** Lớp chấm của cô: khoanh tròn + dấu tick + chữ "Tốt!" (PNG trong suốt cùng kích thước 1000×1360). */
function annotationSvg(r: Rand) {
  const cx = r.int(250, 700);
  const cy = r.int(300, 900);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1360">
    <ellipse cx="${cx}" cy="${cy}" rx="170" ry="48" stroke="#E11D48" stroke-width="7" fill="none" transform="rotate(-4 ${cx} ${cy})"/>
    <path d="M820 220 l30 34 l60 -80" stroke="#16A34A" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M820 640 l30 34 l60 -80" stroke="#16A34A" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${cx + 190}" y="${cy + 10}" font-size="44" font-weight="700" fill="#E11D48">Xem lại!</text>
  </svg>`;
}

async function uploadSvg(svg: string, name: string, kind: "jpeg" | "png", uploadedById: string | null, prefix: string) {
  const img = sharp(Buffer.from(svg));
  const body = kind === "jpeg" ? await img.jpeg({ quality: 70 }).toBuffer() : await img.png().toBuffer();
  const mime = kind === "jpeg" ? "image/jpeg" : "image/png";
  const key = buildObjectKey(prefix, name);
  await putObject(key, body, mime);
  return prisma.fileAsset.create({ data: { objectKey: key, fileName: name, mimeType: mime, size: body.length, uploadedById } });
}

const at = (dateKey: string, time: string) => new Date(`${dateKey}T${time}:00.000+07:00`);

export async function seedPhase2(teacherId: string, specialIds: Record<string, string>, r: Rand) {
  const password = process.env.SEED_DEFAULT_PASSWORD ?? "Cherry@2026";
  const hash = await bcrypt.hash(password, 10);
  const tx = prisma as unknown as Prisma.TransactionClient;
  const today = todayKey();

  // ─── Tài khoản ───
  // Bình (9A) và Châu (8) là anh em → chung SĐT phụ huynh → MỘT tài khoản phụ huynh xem được cả hai.
  const binh = await prisma.student.findUniqueOrThrow({ where: { id: specialIds.binh } });
  await prisma.student.update({ where: { id: specialIds.chau }, data: { parentName: binh.parentName, parentPhone: binh.parentPhone } });
  const binhAcc = await createStudentAccount(tx, specialIds.binh, teacherId);
  await createParentAccount(tx, specialIds.binh, teacherId);
  await createParentAccount(tx, specialIds.chau, teacherId); // liên kết thêm Châu
  // Hai tài khoản demo đổi sẵn mật khẩu quen thuộc, không bắt đổi lần đầu.
  await prisma.user.updateMany({ where: { username: { in: [binhAcc.username, binh.parentPhone!] } }, data: { passwordHash: hash, mustChangePassword: false } });

  // Cả lớp 9A có tài khoản học sinh (đa số chưa đăng nhập lần đầu) — để cô thấy trạng thái thật.
  const nineA = await prisma.classroom.findFirstOrThrow({ where: { name: "Lớp 9A" } });
  const nineAStudents = await prisma.student.findMany({ where: { classroomId: nineA.id, status: "ACTIVE", account: null }, select: { id: true } });
  for (const s of nineAStudents) await createStudentAccount(tx, s.id, teacherId);

  // ─── Bài tập ───
  const classes = await prisma.classroom.findMany({ select: { id: true, name: true, grade: true } });
  const nine = classes.filter((c) => c.grade === 9);
  const eight = classes.filter((c) => c.grade === 8);
  const defs = [
    { title: "Căn bậc hai — luyện tập", due: addDays(today, -32), cls: nine, gradeRate: 1, submitRate: 0.95, lines: ["Bài 1. Rút gọn: √12 + √27 − √48", "Bài 2. Tìm x biết √(2x − 1) = 3", "Bài 3. So sánh 2√3 và 3√2", "Bài 4. Rút gọn A = (√x + 1)/(√x − 1) − …"] },
    { title: "Hình học — Tứ giác nội tiếp", due: addDays(today, -10), cls: nine, gradeRate: 1, submitRate: 0.92, lines: ["Bài 1. Cho tam giác ABC nhọn nội tiếp (O)…", "a) Chứng minh tứ giác BCEF nội tiếp.", "b) Chứng minh AE·AC = AF·AB.", "Bài 2. Cho đường tròn (O) đường kính AB…", "Chứng minh ∠AMB = 90°."] },
    { title: "Phương trình bậc hai — Bài 1–6", due: addDays(today, -3), cls: nine, gradeRate: 0.45, submitRate: 0.88, lines: ["Bài 1. Giải phương trình x² − 5x + 6 = 0", "Bài 2. Giải phương trình 2x² + 3x − 2 = 0", "Bài 3. Tìm m để phương trình có nghiệm kép", "Bài 4–6. Hệ thức Vi-ét (SGK trang 52)"] },
    { title: "Ôn tập hệ phương trình", due: addDays(today, 2), cls: nine, gradeRate: 0, submitRate: 0.25, lines: ["Bài 1. Giải hệ: x + y = 5 ; x − y = 1", "Bài 2. Giải hệ bằng phương pháp thế", "Bài 3. Bài toán chuyển động — lập hệ phương trình"] },
    { title: "Phân tích đa thức thành nhân tử", due: addDays(today, 1), cls: eight, gradeRate: 0, submitRate: 0.3, lines: ["Bài 1. x² − 9", "Bài 2. x³ + 8", "Bài 3. x² − 2xy + y² − 4", "Bài 4. Tìm x biết x² − 4x = 0"] },
    { title: "Hằng đẳng thức đáng nhớ", due: addDays(today, -6), cls: eight, gradeRate: 1, submitRate: 0.85, lines: ["Bài 1. Khai triển (2x + 3)²", "Bài 2. Tính nhanh 101²", "Bài 3. Rút gọn (x − 1)(x + 1) − x²"] },
  ];

  const comments = ["Bài làm rất tốt! 🌟", "Trình bày sạch đẹp, cô khen!", "Em xem lại phần tính toán nhé.", "Tiến bộ nhiều so với bài trước 👏", "Cần ghi rõ lời giải từng bước hơn."];
  let pages = 0;

  for (const def of defs) {
    const dueAt = at(def.due, "21:00");
    const createdAt = new Date(dueAt.getTime() - 5 * 86_400_000);
    const exam = await uploadSvg(examSvg(def.title, def.lines), "de-bai.jpg", "jpeg", teacherId, "assignment/seed");
    const students = await prisma.student.findMany({
      where: { classroomId: { in: def.cls.map((c) => c.id) }, status: "ACTIVE", joinedAt: { lte: createdAt } },
      select: { id: true, fullName: true, account: { select: { id: true } }, parentLinks: { select: { userId: true } } },
    });
    const a = await prisma.assignment.create({
      data: {
        title: def.title,
        description: "Các em trình bày đầy đủ lời giải, chụp rõ từng trang nhé!",
        dueAt,
        createdAt,
        files: { create: [{ fileId: exam.id, sortOrder: 0 }] },
        targets: { create: def.cls.map((c) => ({ kind: "CLASSROOM" as const, refId: c.id, label: c.name })) },
      },
    });
    for (const s of students) {
      const isDemo = s.id === specialIds.binh || s.id === specialIds.chau;
      const submits = isDemo ? def.due < today || def.submitRate > 0.5 : r.chance(def.submitRate);
      if (!submits) {
        await prisma.submission.create({ data: { assignmentId: a.id, studentId: s.id } });
        continue;
      }
      const late = !isDemo && r.chance(0.12);
      const submittedAt = late
        ? new Date(dueAt.getTime() + r.int(1, 30) * 3_600_000)
        : new Date(Math.min(dueAt.getTime() - r.int(1, 60) * 3_600_000, Date.now() - 3_600_000));
      if (submittedAt.getTime() > Date.now()) {
        await prisma.submission.create({ data: { assignmentId: a.id, studentId: s.id } });
        continue;
      }
      const uploader = s.account?.id ?? s.parentLinks[0]?.userId ?? null;
      const nPages = r.int(1, 2);
      const pageRows: { fileId: string; sortOrder: number; annotationFileId?: string }[] = [];
      const graded = submittedAt < new Date(Date.now() - 86_400_000) && r.chance(def.gradeRate);
      for (let p = 0; p < nPages; p++) {
        const f = await uploadSvg(workSvg(s.fullName, p + 1, r), `bai-lam-${p + 1}.jpg`, "jpeg", uploader, "submission/seed");
        pages++;
        const row: (typeof pageRows)[number] = { fileId: f.id, sortOrder: p };
        if (graded && p === 0 && r.chance(0.6)) row.annotationFileId = (await uploadSvg(annotationSvg(r), "cham.png", "png", teacherId, "annotation/seed")).id;
        pageRows.push(row);
      }
      // Điểm: phần lớn 6–10, thỉnh thoảng thấp để thấy lời động viên. Bình tiến bộ dần.
      let score = Math.round((r.chance(0.1) ? r.int(30, 48) / 10 : r.int(60, 100) / 10) * 4) / 4;
      if (s.id === specialIds.binh) score = def.title.startsWith("Căn") ? 7 : def.title.startsWith("Hình") ? 8.5 : 9;
      const low = score < 5;
      await prisma.submission.create({
        data: {
          assignmentId: a.id,
          studentId: s.id,
          status: graded ? "GRADED" : "SUBMITTED",
          submittedAt,
          note: r.chance(0.15) ? r.pick(["Bài 4 em chưa làm được ạ", "Cô xem giúp em bài 2 với ạ", "Em chụp hơi mờ, cô thông cảm ạ"]) : null,
          score: graded ? score : null,
          comment: graded ? (low ? "Em xem lại cách làm bài 1 và bài 3 nhé." : r.pick(comments)) : null,
          reviewHint: graded && low ? "Ôn lại công thức nghiệm và cách tính Δ (SGK trang 44)" : null,
          gradedAt: graded ? new Date(Math.min(submittedAt.getTime() + r.int(10, 48) * 3_600_000, Date.now() - 600_000)) : null,
          seenAt: graded && !isDemo && r.chance(0.7) ? new Date() : null,
          pages: { create: pageRows },
        },
      });
    }
  }
  return { studentLogin: binhAcc.username, parentLogin: binh.parentPhone!, password, pages };
}
