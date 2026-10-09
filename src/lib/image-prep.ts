"use client";

/**
 * Xử lý ảnh bài làm NGAY TRÊN ĐIỆN THOẠI trước khi tải lên:
 *  1. Tự xoay đúng chiều theo EXIF (ảnh chụp dọc không bị nằm ngang).
 *  2. Thu nhỏ cạnh dài về 1800px — đủ đọc chữ, nhẹ mạng (~250–400KB thay vì 4MB).
 *  3. "Làm nét": tăng tương phản, làm trắng nền giấy, làm đậm nét bút — đọc như bản scan.
 * Xoay tay thêm 90° nếu em chụp nghiêng.
 */

const MAX_EDGE = 1800;

export type PrepOptions = { rotate?: 0 | 90 | 180 | 270; enhance?: boolean };

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Trình duyệt cũ: dùng <img> (vẫn tự xoay theo EXIF ở trình duyệt hiện đại).
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Bảng tra tăng tương phản kiểu "scan tài liệu" từ histogram độ sáng (256 mức).
 * - Mốc trắng = phân vị 90% (màu giấy — chiếm phần lớn ảnh) → thành trắng tinh.
 * - Mốc đen = phân vị 1%, nhưng trang ít chữ thì mốc này cũng rơi vào màu giấy → ép tối thiểu
 *   cách mốc trắng 160 mức để nét bút vẫn được làm đậm.
 * Hàm thuần — test ở image-prep.test.ts.
 */
export function documentLut(hist: ArrayLike<number>, total: number): Uint8ClampedArray | null {
  const percentile = (p: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) if ((acc += hist[i]) >= total * p) return i;
    return 255;
  };
  const hi = percentile(0.9);
  if (hi < 60) return null; // ảnh tối (chụp đêm, bảng đen) — không đoán, giữ nguyên
  const lo = Math.min(percentile(0.01), Math.max(0, hi - 160));
  const scale = 255 / Math.max(1, hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const v = (i - lo) * scale;
    // đường cong nhẹ: tối đậm hơn, sáng trắng hơn
    lut[i] = v < 128 ? v * 0.85 : Math.min(255, v * 1.06);
  }
  return lut;
}

function enhance(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[((d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000) | 0]++;
  const lut = documentLut(hist, w * h);
  if (!lut) return;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);
}

export async function prepareImage(file: Blob, opts: PrepOptions = {}): Promise<Blob> {
  const src = await decode(file);
  const sw = "width" in src ? src.width : 0;
  const sh = "height" in src ? src.height : 0;
  const ratio = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const w = Math.round(sw * ratio);
  const h = Math.round(sh * ratio);
  const rotate = opts.rotate ?? 0;
  const swap = rotate === 90 || rotate === 270;

  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(src as CanvasImageSource, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opts.enhance !== false) enhance(ctx, canvas.width, canvas.height);
  if ("close" in src) src.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Không xử lý được ảnh"))), "image/jpeg", 0.82),
  );
}

/** Tải một file lên /api/tep, có tiến độ (XHR vì fetch chưa báo tiến độ upload). */
export function uploadFile(
  file: Blob,
  name: string,
  purpose: "assignment" | "submission" | "annotation" | "voice",
  onProgress?: (fraction: number) => void,
): Promise<{ id: string; fileName: string; mimeType: string; size: number }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file, name);
    fd.append("purpose", purpose);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/tep");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText) as { ok: boolean; data?: never; message?: string };
        if (res.ok && res.data) resolve(res.data);
        else reject(new Error(res.message ?? "Tải lên chưa được"));
      } catch {
        reject(new Error("Tải lên chưa được"));
      }
    };
    xhr.onerror = () => reject(new Error("Mạng đang chập chờn — thử lại giúp em nhé."));
    xhr.send(fd);
  });
}

export const fileUrl = (id: string) => `/api/tep/${id}`;
