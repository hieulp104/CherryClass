/**
 * Xóa các trang đã cache bởi service worker (public/sw.js, cache "<version>-pages").
 * Gọi khi đăng xuất / mở màn đăng nhập: điện thoại dùng chung (phụ huynh – con, anh chị em)
 * thì người sau lúc mất mạng không được thấy trang của người trước.
 */
export function clearPageCache() {
  if (typeof caches === "undefined") return;
  caches
    .keys()
    .then((keys) => Promise.all(keys.filter((k) => k.endsWith("-pages")).map((k) => caches.delete(k))))
    .catch(() => {
      // trình duyệt chặn Cache API — không có gì để xóa
    });
}
