import { describe, expect, it } from "vitest";

import { documentLut } from "./image-prep";

/** Histogram giả: `paper` % pixel ở mức `bg`, phần còn lại là mực ở mức `ink`. */
function hist(bg: number, ink: number, inkShare: number) {
  const h = new Array(256).fill(0);
  h[bg] = Math.round(10000 * (1 - inkShare));
  h[ink] = Math.round(10000 * inkShare);
  return h;
}

describe("làm nét ảnh bài làm", () => {
  it("giấy be nhiều chữ → nền trắng, mực đậm hơn", () => {
    const lut = documentLut(hist(225, 70, 0.1), 10000)!;
    expect(lut[225]).toBe(255);
    expect(lut[70]).toBeLessThan(70);
  });

  it("trang ÍT chữ (mực < 1%) vẫn được làm trắng nền — lỗi cũ: bỏ qua cả ảnh", () => {
    const lut = documentLut(hist(225, 60, 0.004), 10000)!;
    expect(lut).not.toBeNull();
    expect(lut[225]).toBe(255);
    expect(lut[60]).toBeLessThan(40);
  });

  it("ảnh rất tối thì giữ nguyên", () => {
    expect(documentLut(hist(40, 10, 0.2), 10000)).toBeNull();
  });
});
