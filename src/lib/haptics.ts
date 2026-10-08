/**
 * Rung nhẹ trên điện thoại khi thao tác thành công.
 * Tắt khi người dùng bật "giảm chuyển động"; iOS Safari không hỗ trợ vibrate → im lặng bỏ qua.
 */
export function haptic(pattern: number | number[] = 12) {
  if (typeof window === "undefined") return;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate?.(pattern);
  } catch {
    // không hỗ trợ — bỏ qua
  }
}
