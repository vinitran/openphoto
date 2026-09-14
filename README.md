# openphoto

Trình chỉnh sửa ảnh chạy trên trình duyệt, xây dựng bằng Next.js, React, TypeScript và Tailwind CSS.

OpenPhoto sử dụng kiến trúc command-first: thao tác từ giao diện, preset và AI đều đi qua cùng một tool registry có schema. Ảnh gốc không bị ghi đè; lịch sử chỉ lưu transaction và tham số chỉnh sửa.

## Nền tảng hiện có

- 14 công cụ ánh sáng/màu có JSON Schema
- WebGL2 renderer với Canvas 2D fallback
- Transaction history, undo/redo và preview không commit
- AI Tool Lab để thử `EditPlan` JSON trước khi kết nối API
- Autosave project và ảnh nguồn trong IndexedDB
- Xuất/nhập project JSON có `schemaVersion`
- Xuất ảnh JPG đã render
- Mask engine nhiều vùng với brush, radial và linear gradient
- Mỗi mask có đủ 14 thông số chỉnh sửa, feather, opacity, invert và bật/tắt
- AI có thể tạo mask qua `mask.create`, cập nhật qua `mask.update` và dùng mọi `adjust.*` với target mask
- AI Vision thật qua Next.js API: gửi preview thu nhỏ, tạo `EditPlan`, preview và chỉ commit sau khi duyệt
- Semantic mask dạng polygon chuẩn hóa cho subject, sky, background, face hoặc vùng AI nhận diện
- `AiEditingHarness` tự tạo preview, đo luminance/clipping/RGB, gọi provider, validate plan và chạy thử qua editor engine
- Project schema v2; project v1 được migrate tự động

## Luồng AI theo vùng

Mở ảnh sẽ mở trợ lý AI. Bấm gửi preview (tối đa 1280px) để nhận phân tích,
chọn từng vùng hoặc toàn ảnh, xem thông số, xem trước rồi duyệt. Chỉ thông số
và polygon được trả về; renderer local áp màu và giữ ảnh nguồn. Chọn vùng đã
duyệt ở cột trái để tinh chỉnh thủ công.

Vùng chọn hỗ trợ làm mờ (blur), màu matte (fade), sáng/tối, nhiệt độ,
sắc độ, độ rực, bão hòa, clarity và vignette. Feather điều chỉnh biên mask;
blur điều chỉnh nội dung ảnh. AI được hướng dẫn bảo vệ da, tóc và chi tiết chủ thể.
Vùng nền có thể là polygon chủ thể đảo ngược. Polygon từ vision vẫn là ước lượng,
chưa phải segmentation pixel; cần xem overlay trước khi duyệt.
Không còn chức năng clone/xóa người. Project cũ bỏ qua dữ liệu clone khi nạp,
các thông số màu còn lại được giữ nguyên. Bản cũ vẫn có trong lịch sử Git.

## Chạy local

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

AI chờ gateway tối đa 180 giây; client chờ tối đa 210 giây và hiển thị thời gian
đã chờ. Đóng bảng AI sẽ hủy request. Route khai báo maxDuration=240 giây;
khi deploy cần bảo đảm hosting/reverse proxy cho phép thời gian xử lý tương ứng.
Giới hạn từ gateway/hosting vẫn có thể kết thúc request sớm hơn.
