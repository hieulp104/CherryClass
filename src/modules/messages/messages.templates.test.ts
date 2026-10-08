import { describe, expect, it } from "vitest";

import { inQuietHours, parentAddress, renderTemplate } from "./messages.templates";

describe("mẫu tin nhắn", () => {
  it("điền biến, giữ nguyên biến thiếu", () => {
    expect(renderTemplate("Con {tenCon} học {soBuoi} buổi {abc}", { tenCon: "An", soBuoi: 10 })).toBe(
      "Con An học 10 buổi {abc}",
    );
  });

  it("cách gọi phụ huynh", () => {
    expect(parentAddress(null)).toBe("anh/chị");
    expect(parentAddress("Chị Lan")).toBe("chị Lan");
    expect(parentAddress("Nguyễn Thị Lan")).toBe("anh/chị Lan");
  });

  it("giờ yên tĩnh qua nửa đêm", () => {
    const q = { from: "21:30", to: "06:30" };
    expect(inQuietHours("22:00", q)).toBe(true);
    expect(inQuietHours("05:59", q)).toBe(true);
    expect(inQuietHours("06:30", q)).toBe(false);
    expect(inQuietHours("21:29", q)).toBe(false);
  });
});
