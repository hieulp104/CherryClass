import { describe, expect, it } from "vitest";

import {
  daysUntil,
  formatScore,
  friendlyReminder,
  fullAttendanceWeeks,
  garden,
  isLowScore,
  lowScoreCheer,
  monthAverage,
  normalizeScore,
  selfComparison,
  submissionState,
} from "./assignments.core";

const due = new Date("2026-10-10T21:00:00+07:00");

describe("trạng thái bài", () => {
  it("chưa nộp: còn hạn / sắp hạn / quá hạn", () => {
    const s = { status: "ASSIGNED" as const, submittedAt: null };
    expect(submissionState(s, due, new Date("2026-10-08T12:00:00+07:00"))).toBe("TODO");
    expect(submissionState(s, due, new Date("2026-10-10T08:00:00+07:00"))).toBe("DUE_SOON");
    expect(submissionState(s, due, new Date("2026-10-10T21:00:01+07:00"))).toBe("MISSING");
  });

  it("nộp đúng giờ hạn chót vẫn là đúng hạn; trễ 1 giây là muộn", () => {
    expect(submissionState({ status: "SUBMITTED", submittedAt: new Date(due) }, due, new Date())).toBe("SUBMITTED");
    expect(submissionState({ status: "SUBMITTED", submittedAt: new Date(due.getTime() + 1000) }, due, new Date())).toBe("LATE");
  });

  it("đã chấm luôn là GRADED", () => {
    expect(submissionState({ status: "GRADED", submittedAt: null }, due, new Date())).toBe("GRADED");
  });
});

describe("điểm", () => {
  it("làm tròn bước 0,25 và chặn ngoài thang", () => {
    expect(normalizeScore(8.3, 10)).toBe(8.25);
    expect(normalizeScore(8.4, 10)).toBe(8.5);
    expect(normalizeScore(10, 10)).toBe(10);
    expect(normalizeScore(10.5, 10)).toBeNull();
    expect(normalizeScore(-1, 10)).toBeNull();
    expect(normalizeScore(Number.NaN, 10)).toBeNull();
  });

  it("định dạng kiểu Việt Nam", () => {
    expect(formatScore(8.25)).toBe("8,25");
    expect(formatScore(9)).toBe("9");
  });

  it("điểm thấp tính theo thang 10", () => {
    expect(isLowScore(4.75, 10)).toBe(true);
    expect(isLowScore(5, 10)).toBe(false);
    expect(isLowScore(9, 20)).toBe(true); // 4,5/10
  });

  it("trung bình tháng quy về thang 10", () => {
    const g = [
      { month: "2026-10", score: 8, max: 10 },
      { month: "2026-10", score: 18, max: 20 },
      { month: "2026-09", score: 5, max: 10 },
    ];
    expect(monthAverage(g, "2026-10")).toBe(8.5);
    expect(monthAverage(g, "2026-08")).toBeNull();
  });

  it("so với chính mình — không bao giờ chê", () => {
    expect(selfComparison(8.3, 7.5)).toEqual({ tone: "up", text: "Điểm trung bình tháng này của em tăng 0,8 so với tháng trước 🎉" });
    expect(selfComparison(7.5, 7.55).tone).toBe("same");
    const down = selfComparison(6, 8);
    expect(down.tone).toBe("down");
    expect(down.text).not.toMatch(/\d/); // không nêu con số giảm
    expect(selfComparison(null, 8).tone).toBe("none");
  });

  it("lời động viên ổn định theo bài", () => {
    expect(lowScoreCheer("abc")).toBe(lowScoreCheer("abc"));
  });
});

describe("lời nhắc", () => {
  it("giọng theo thời gian còn lại", () => {
    expect(friendlyReminder("Hình học", 50)).toContain("Còn 2 ngày");
    expect(friendlyReminder("Hình học", 10)).toContain("chưa tới 1 ngày");
    expect(friendlyReminder("Hình học", 1)).toContain("Sắp tới giờ");
    expect(friendlyReminder("Hình học", -2)).toContain("vẫn chấm");
  });
});

describe("vườn cherry", () => {
  it("tuần đầy đủ = mọi buổi trong tuần đều có mặt", () => {
    const rows = [
      { date: "2026-09-14", status: "PRESENT" as const }, // T2 tuần 14/09
      { date: "2026-09-17", status: "PRESENT" as const },
      { date: "2026-09-21", status: "PRESENT" as const }, // tuần 21/09
      { date: "2026-09-24", status: "EXCUSED" as const },
      { date: "2026-09-27", status: "PRESENT" as const }, // CN vẫn thuộc tuần 21/09
    ];
    expect(fullAttendanceWeeks(rows)).toEqual(["2026-09-14"]);
  });

  it("đếm quả và mở huy hiệu theo mốc", () => {
    expect(garden({ onTimeSubmissions: 0, fullWeeks: 0 })).toMatchObject({ fruits: 0, unlocked: [], progress: 0 });
    const g = garden({ onTimeSubmissions: 7, fullWeeks: 5 });
    expect(g.fruits).toBe(12);
    expect(g.unlocked.map((b) => b.at)).toEqual([5, 10]);
    expect(g.next?.at).toBe(20);
    expect(g.progress).toBeCloseTo(0.2);
    expect(garden({ onTimeSubmissions: 60, fullWeeks: 0 }).next).toBeNull();
  });
});

describe("đếm ngược", () => {
  it("số ngày tới kỳ thi", () => {
    expect(daysUntil("2026-10-09", "2027-06-02")).toBe(236);
    expect(daysUntil("2027-06-02", "2027-06-02")).toBe(0);
  });
});
