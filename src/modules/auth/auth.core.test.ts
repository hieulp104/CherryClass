import { describe, expect, it } from "vitest";

import {
  afterFailedLogin,
  IP_MAX_FAILS,
  IP_WINDOW_MS,
  ipBlocked,
  LOGIN_MAX_FAILS,
  loginGate,
  recentFailures,
  tempPasswordExpiry,
} from "./auth.core";

const now = new Date("2026-10-29T10:00:00+07:00");
const minutesFromNow = (d: Date | null) => (d ? (d.getTime() - now.getTime()) / 60_000 : null);

describe("khóa tạm khi sai mật khẩu", () => {
  it("chưa tới ngưỡng thì chỉ đếm, không khóa", () => {
    for (let f = 0; f < LOGIN_MAX_FAILS - 1; f++) {
      expect(afterFailedLogin(f, true, now)).toEqual({ failedLogins: f + 1, lockedUntil: null });
    }
  });

  it("mật khẩu tự đặt: khóa cố định 15 phút mỗi lần tới ngưỡng", () => {
    expect(minutesFromNow(afterFailedLogin(4, false, now).lockedUntil)).toBe(15);
    expect(minutesFromNow(afterFailedLogin(9, false, now).lockedUntil)).toBe(15);
    expect(minutesFromNow(afterFailedLogin(49, false, now).lockedUntil)).toBe(15);
  });

  it("mật khẩu tạm: mỗi lần khóa gấp đôi, tối đa 24 giờ", () => {
    expect(minutesFromNow(afterFailedLogin(4, true, now).lockedUntil)).toBe(15);
    expect(minutesFromNow(afterFailedLogin(9, true, now).lockedUntil)).toBe(30);
    expect(minutesFromNow(afterFailedLogin(14, true, now).lockedUntil)).toBe(60);
    expect(minutesFromNow(afterFailedLogin(499, true, now).lockedUntil)).toBe(24 * 60);
  });

  it("mật khẩu tạm: một tuần chỉ dò được dưới 1% trong 10.000 khả năng", () => {
    let fails = 0;
    let t = now.getTime();
    const end = now.getTime() + 7 * 24 * 60 * 60_000;
    while (t < end) {
      const r = afterFailedLogin(fails, true, new Date(t));
      fails = r.failedLogins;
      if (r.lockedUntil) t = r.lockedUntil.getTime();
    }
    expect(fails).toBeLessThan(100);
  });
});

describe("giới hạn theo địa chỉ IP", () => {
  const t = now.getTime();

  it("dưới ngưỡng thì cho thử", () => {
    expect(ipBlocked(Array(IP_MAX_FAILS - 1).fill(t), t)).toBe(false);
  });

  it("đủ ngưỡng trong cửa sổ thì chặn", () => {
    expect(ipBlocked(Array(IP_MAX_FAILS).fill(t - 1000), t)).toBe(true);
  });

  it("lần sai cũ hơn cửa sổ không tính", () => {
    const old = Array(IP_MAX_FAILS).fill(t - IP_WINDOW_MS);
    expect(ipBlocked(old, t)).toBe(false);
    expect(recentFailures([...old, t - 5], t)).toEqual([t - 5]);
  });
});

describe("cổng đăng nhập", () => {
  const base = { lockedUntil: null, mustChangePassword: false, tempPasswordExpiresAt: null };

  it("bình thường cho qua", () => {
    expect(loginGate(base, now)).toEqual({ ok: true });
  });

  it("đang khóa: báo số phút còn lại (làm tròn lên)", () => {
    const lockedUntil = new Date(now.getTime() + 90_000);
    expect(loginGate({ ...base, lockedUntil }, now)).toEqual({ ok: false, reason: "LOCKED", minutesLeft: 2 });
  });

  it("hết giờ khóa thì cho thử lại", () => {
    expect(loginGate({ ...base, lockedUntil: new Date(now.getTime() - 1) }, now)).toEqual({ ok: true });
  });

  it("mật khẩu tạm quá hạn thì chặn; đã tự đặt mật khẩu thì hạn không còn tác dụng", () => {
    const expired = new Date(now.getTime() - 1);
    expect(loginGate({ ...base, mustChangePassword: true, tempPasswordExpiresAt: expired }, now)).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
    expect(loginGate({ ...base, mustChangePassword: false, tempPasswordExpiresAt: expired }, now)).toEqual({ ok: true });
  });

  it("mật khẩu tạm dùng được đúng 7 ngày", () => {
    expect(minutesFromNow(tempPasswordExpiry(now))).toBe(7 * 24 * 60);
  });
});
