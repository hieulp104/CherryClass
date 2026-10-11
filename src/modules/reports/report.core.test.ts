import { describe, expect, it } from "vitest";

import { monthlyReportText, type MonthlyReportInput } from "@/modules/reports/report.core";

const base: MonthlyReportInput = {
  parent: "chị Lan",
  child: "An",
  month: "2026-10",
  teacher: "cô Hà",
  attendance: { present: 8, excused: 0, unexcused: 0, makeup: 0 },
  homework: { assigned: 4, submitted: 4, onTime: 4 },
  average: 8.5,
  previousAverage: 8,
  note: "",
};

describe("báo cáo tháng cho phụ huynh", () => {
  it("đủ ý: lời chào, chuyên cần, bài tập, điểm, lời cảm ơn", () => {
    const text = monthlyReportText(base);
    expect(text).toContain("Dạ em chào chị Lan ạ");
    expect(text).toContain("tháng 10");
    expect(text).toContain("con An");
    expect(text).toContain("Đi học: 8/8 buổi");
    expect(text).toContain("Bài tập: nộp 4/4 bài, tất cả đúng hạn");
    expect(text).toContain("Điểm trung bình: 8,5 (tăng 0,5 so với tháng trước)");
    expect(text).toMatch(/cảm ơn chị Lan/);
  });

  it("vắng: nói nhẹ nhàng, tách có phép / không phép, không trách", () => {
    const text = monthlyReportText({ ...base, attendance: { present: 6, excused: 1, unexcused: 1, makeup: 1 } });
    expect(text).toContain("Đi học: 6/8 buổi (1 buổi học bù, nghỉ có phép 1, nghỉ không phép 1)");
    expect(text).not.toMatch(/trốn|lười|tệ|kém/i);
  });

  it("điểm giảm: KHÔNG nêu con số giảm", () => {
    const text = monthlyReportText({ ...base, average: 6.5, previousAverage: 8 });
    expect(text).toContain("Điểm trung bình: 6,5");
    expect(text).not.toContain("1,5");
    expect(text).not.toMatch(/giảm/i);
  });

  it("điểm dưới 5: luôn kèm lời cô sẽ kèm thêm", () => {
    const text = monthlyReportText({ ...base, average: 4.25, previousAverage: null });
    expect(text).toContain("4,25");
    expect(text).toMatch(/kèm con|ôn thêm/);
  });

  it("không có dữ liệu thì bỏ dòng đó — không in '0/0'", () => {
    const text = monthlyReportText({
      ...base,
      attendance: { present: 0, excused: 0, unexcused: 0, makeup: 0 },
      homework: { assigned: 0, submitted: 0, onTime: 0 },
      average: null,
      previousAverage: null,
    });
    expect(text).not.toContain("0/0");
    expect(text).not.toContain("Điểm trung bình");
    expect(text).not.toContain("Bài tập");
  });

  it("bài tập: nộp thiếu / nộp muộn nói rõ nhưng nhẹ", () => {
    const text = monthlyReportText({ ...base, homework: { assigned: 5, submitted: 4, onTime: 3 } });
    expect(text).toContain("Bài tập: nộp 4/5 bài, 3 bài đúng hạn");
  });

  it("nhận xét riêng của cô được chèn nguyên văn, cắt khoảng trắng thừa", () => {
    const text = monthlyReportText({ ...base, note: "  Con tiến bộ phần hình học.  " });
    expect(text).toContain("\nCon tiến bộ phần hình học.\n");
  });

  it("không bao giờ so với bạn khác", () => {
    expect(monthlyReportText(base)).not.toMatch(/xếp hạng|hạng|so với bạn|cả lớp/i);
  });
});
