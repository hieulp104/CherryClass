import ExcelJS from "exceljs";

import { getCurrentUser } from "@/modules/auth/auth.service";

/** File mẫu để cô điền danh sách học sinh rồi nhập lại vào app. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Học sinh");
  ws.columns = [
    { header: "Họ và tên", key: "name", width: 26 },
    { header: "Lớp", key: "cls", width: 10 },
    { header: "Ca", key: "shift", width: 10 },
    { header: "Ngày sinh", key: "dob", width: 13 },
    { header: "Phụ huynh", key: "parent", width: 20 },
    { header: "SĐT phụ huynh", key: "pphone", width: 15 },
    { header: "SĐT học sinh", key: "sphone", width: 15 },
    { header: "Trường", key: "school", width: 22 },
    { header: "Học phí/buổi", key: "price", width: 13 },
    { header: "Ngày vào học", key: "joined", width: 14 },
  ];
  ws.addRow({ name: "Nguyễn Văn An", cls: "Lớp 9A", shift: "Ca 1", dob: "15/03/2011", parent: "Chị Lan", pphone: "0912345678", sphone: "0987654321", school: "THCS Nguyễn Du", price: "", joined: "01/09/2026" });
  ws.addRow({ name: "Trần Thị Bình", cls: "Lớp 8", shift: "Ca 2", dob: "02/07/2012", parent: "Anh Hùng", pphone: "0901234567", school: "THCS Lê Lợi", price: 70000 });
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D48" } };
  ws.getRow(1).height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.addRow([]);
  ws.addRow(["Ghi chú: chỉ cột Họ và tên là bắt buộc. Học phí để trống = theo đơn giá mặc định. Có thể xóa 2 dòng ví dụ trên."]);

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("Mau_danh_sach_hoc_sinh.xlsx")}`,
    },
  });
}
