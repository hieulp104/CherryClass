/** Đường dẫn trong cổng — dùng được cả ở server lẫn client (portal-frame là file "use client"). */

type LinkFrame = { base: "/cua-em" | "/phu-huynh"; studentId: string; children: unknown[] };

/** Thêm ?con= cho link phía phụ huynh để giữ đúng con đang xem. */
export function portalHref(frame: LinkFrame, path = "") {
  const url = `${frame.base}${path}`;
  return frame.base === "/phu-huynh" && frame.children.length > 1 ? `${url}?con=${frame.studentId}` : url;
}
