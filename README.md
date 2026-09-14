# openphoto

Trình chỉnh sửa ảnh chạy trên trình duyệt, xây dựng bằng Next.js, React, TypeScript và Tailwind CSS.

OpenPhoto sử dụng kiến trúc command-first: thao tác từ giao diện, preset và AI đều đi qua cùng một tool registry có schema. Ảnh gốc không bị ghi đè; lịch sử chỉ lưu transaction và tham số chỉnh sửa.

## Nền tảng hiện có

- 12 công cụ ánh sáng/màu có JSON Schema
- WebGL2 renderer với Canvas 2D fallback
- Transaction history, undo/redo và preview không commit
- AI Tool Lab để thử `EditPlan` JSON trước khi kết nối API
- Autosave project và ảnh nguồn trong IndexedDB
- Xuất/nhập project JSON có `schemaVersion`
- Xuất ảnh JPG đã render
- Mask engine nhiều vùng với brush, radial và linear gradient
- Mỗi mask có đủ 12 thông số chỉnh sửa, feather, opacity, invert và bật/tắt
- AI có thể tạo mask qua `mask.create`, cập nhật qua `mask.update` và dùng mọi `adjust.*` với target mask
- AI Vision thật qua Next.js API: gửi preview thu nhỏ, tạo `EditPlan`, preview và chỉ commit sau khi duyệt
- Semantic mask dạng polygon chuẩn hóa cho subject, sky, background, face hoặc vùng AI nhận diện
- `AiEditingHarness` tự tạo preview, đo luminance/clipping/RGB, gọi provider, validate plan và chạy thử qua editor engine
- Project schema v2; project v1 được migrate tự động

## Chạy local

## Luồng AI theo vùng

Mở ảnh sẽ mở trợ lý AI. Bấm gửi preview (tối đa 1280px) để nhận phân tích,
chọn từng vùng hoặc toàn ảnh, xem thông số, xem trước rồi duyệt. Chỉ thông số
và polygon được trả về; renderer local áp màu và giữ ảnh nguồn. Chọn vùng đã
duyệt ở cột trái để tinh chỉnh thủ công.

“Xóa người / clone nền” nằm dưới vùng đang chọn. Khoanh người bằng cọ hoặc
dùng vùng AI, dịch nguồn ngang/dọc tới nền sạch, xem trước và duyệt.
Clone được lưu bằng tọa độ chuẩn hóa trong transaction/project và dùng khi
export. Đây là clone local, chưa phải AI inpainting; nền phức tạp và biên tóc
cần chỉnh mask thủ công. Polygon AI cũng chỉ là vùng ước lượng.

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

Tạo `.env.local` để bật AI:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://ai.hoanxu.com/v1
# Model có trong gateway HoanXu
OPENAI_MODEL=cx/gpt-5.6-sol
```
