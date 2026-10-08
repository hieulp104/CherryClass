"use client";

import type { FinalizeSessionInput } from "@/modules/attendance/attendance.schema";

/**
 * Hàng đợi điểm danh ngoại tuyến (localStorage). Mỗi buổi giữ đúng MỘT bản gửi mới nhất —
 * vì server nhận trạng thái cuối (không phải chuỗi thao tác), gửi lại bản cuối là đủ và an toàn.
 */

const QUEUE_KEY = "tc-attendance-queue";
const DRAFT_PREFIX = "tc-attendance-draft:";
export const QUEUE_EVENT = "tc-queue-changed";

type Queue = Record<string, FinalizeSessionInput & { queuedAt: number; label?: string }>;

function read(): Queue {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "{}") as Queue;
  } catch {
    return {};
  }
}

function write(q: Queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {
    // bộ nhớ đầy / bị chặn — bỏ qua, người dùng vẫn thấy cảnh báo chưa gửi được
  }
}

export function enqueue(input: FinalizeSessionInput, label?: string) {
  const q = read();
  q[input.sessionId] = { ...input, queuedAt: Date.now(), label };
  write(q);
}

export function dequeue(sessionId: string) {
  const q = read();
  delete q[sessionId];
  write(q);
}

export function queued(): Queue[string][] {
  return Object.values(read()).sort((a, b) => a.queuedAt - b.queuedAt);
}

/** Nháp điểm danh đang làm dở (mở lại trang vẫn còn). */
export function saveDraft(sessionId: string, value: unknown) {
  try {
    localStorage.setItem(DRAFT_PREFIX + sessionId, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // bỏ qua
  }
}

export function loadDraft<T>(sessionId: string, maxAgeMs = 12 * 3_600_000): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + sessionId);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw) as { at: number; value: T };
    return Date.now() - at < maxAgeMs ? value : null;
  } catch {
    return null;
  }
}

export function clearDraft(sessionId: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + sessionId);
  } catch {
    // bỏ qua
  }
}
