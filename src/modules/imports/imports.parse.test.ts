import { describe, expect, it } from "vitest";

import { detectColumns, matchClassroom, parseDateCell, parseRows } from "./imports.parse";

describe("nhận diện cột Excel", () => {
  it("nhận tiêu đề có dấu, không dấu, viết tắt", () => {
    const cols = detectColumns(["STT", "Họ và tên", "Lớp", "Ngày sinh", "SĐT phụ huynh", "SDT hoc sinh", "Trường"]);
    expect([...cols.values()]).toEqual(
      expect.arrayContaining(["fullName", "classroom", "dob", "parentPhone", "studentPhone", "school"]),
    );
    expect(cols.get(0)).toBeUndefined(); // STT bỏ qua
    expect(cols.get(4)).toBe("parentPhone");
    expect(cols.get(5)).toBe("studentPhone");
  });

  it("'SĐT' chung chung hiểu là SĐT phụ huynh", () => {
    expect(detectColumns(["Tên học sinh", "SĐT"]).get(1)).toBe("parentPhone");
  });

  it("tách cột Họ và Tên riêng", () => {
    const cols = detectColumns(["Họ", "Tên", "Lớp"]);
    expect(cols.get(0)).toBe("lastName");
    expect(cols.get(1)).toBe("firstName");
  });
});

describe("đọc dữ liệu", () => {
  const sheet = [
    ["DANH SÁCH HỌC SINH LỚP CÔ HÀ"],
    [],
    ["STT", "Họ", "Tên", "Lớp", "SĐT", "Ngày sinh", "Học phí"],
    [1, "nguyễn văn", "an", "9A", "912345678", "15/03/2011", "80k"],
    [2, "", "", "", "", "", ""],
    [3, "Trần Thị", "Bình", "Lớp 8", "0987 654 321", new Date("2012-07-01T00:00:00Z"), 90000],
    [4, "Lê", "", "9B", "12345", "31/02/2011", ""],
    [],
    ["", "Ghi chú: chỉ cột Họ và tên là bắt buộc"],
  ];

  it("tìm dòng tiêu đề, bỏ dòng trống, chuẩn hóa tên/SĐT/ngày/giá", () => {
    const r = parseRows(sheet);
    expect(r.headerRow).toBe(2);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({
      fullName: "Nguyễn Văn An",
      classroom: "9A",
      parentPhone: "0912345678",
      dob: "2011-03-15",
      unitPrice: 80000,
      problems: [],
    });
    expect(r.rows[1]).toMatchObject({ fullName: "Trần Thị Bình", parentPhone: "0987654321", dob: "2012-07-01", unitPrice: 90000 });
    expect(r.rows[2].problems).toEqual(expect.arrayContaining(["SĐT phụ huynh chưa đúng", "Ngày sinh không đọc được"]));
  });

  it("ngày không tồn tại bị từ chối", () => {
    expect(parseDateCell("31/02/2011")).toBeNull();
    expect(parseDateCell("2011-02-28")).toBe("2011-02-28");
    expect(parseDateCell("5-9-11")).toBe("2011-09-05");
  });

  it("ghép tên lớp", () => {
    const cls = [
      { id: "a", name: "Lớp 9A" },
      { id: "b", name: "Lớp 8" },
    ];
    expect(matchClassroom("9a", cls)).toBe("a");
    expect(matchClassroom("Lop 9A", cls)).toBe("a");
    expect(matchClassroom("8", cls)).toBe("b");
    expect(matchClassroom("7", cls)).toBeNull();
  });
});
