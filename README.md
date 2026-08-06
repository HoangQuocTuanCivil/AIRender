# AIRender

Web app biến **sketch tay, ảnh chụp màn hình 3D (SketchUp/Revit/Rhino) hoặc mặt đứng CAD** thành **ảnh render kiến trúc chân thực** bằng AI — giữ nguyên hình khối và tỉ lệ của thiết kế gốc.

---

## Bắt đầu nhanh

```bash
# 1. Cài dependencies (đã cài sẵn nếu bạn vừa nhận project)
npm install

# 2. Cấu hình API key
cp .env.example .env.local     # rồi mở .env.local điền FAL_KEY

# 3. Tạo database SQLite
npm run db:push

# 4. Chạy
npm run dev
```

Mở http://localhost:3000

### Lấy API key

| Provider | Link | Ghi chú |
|---|---|---|
| **fal.ai** (khuyến nghị) | https://fal.ai/dashboard/keys | Nhanh nhất, ControlNet tốt nhất cho kiến trúc. ~$0.04/megapixel |
| Replicate | https://replicate.com/account/api-tokens | Dự phòng, dùng FLUX Tools của Black Forest Labs |

Chỉ cần **một** trong hai. App tự chọn provider nào có key; ép cứng bằng `RENDER_PROVIDER=fal` hoặc `replicate`.

---

## Cách dùng

### Luồng cơ bản

1. **Kéo thả ảnh nguồn** vào panel trái — sketch, ảnh 3D chưa gán vật liệu, mặt đứng, hoặc ảnh chụp hiện trạng.
2. **Chọn phong cách** từ 12 preset có sẵn (xem bảng dưới). Preset tự set luôn prompt và tham số tối ưu.
3. **Chỉnh ControlNet** nếu cần — đây là thứ quyết định ảnh có giữ đúng thiết kế hay không.
4. Bấm **Render**. Mất khoảng 20–60 giây.
5. Kéo thanh trượt để **so sánh trước/sau**, rồi **tải ảnh về**.

Mọi lần render tự động lưu vào **Thư viện** — xem lại, ghim yêu thích, hoặc render lại với đúng tham số cũ.

### Chọn chế độ ControlNet

Đây là quyết định quan trọng nhất. Sai chế độ → AI vẽ ra một công trình khác.

| Chế độ | Dùng khi | Cơ chế |
|---|---|---|
| **Depth** — giữ khối | Ảnh 3D SketchUp/Revit/Lumion clay, ảnh chụp công trình | Bám theo chiều sâu, giữ đúng hình khối và bố cục không gian |
| **Canny** — giữ đường nét | Sketch tay, line-art xuất từ CAD, mặt đứng 2D | Bám theo từng cạnh đã vẽ, giữ đúng tỉ lệ chi tiết |
| **Không** — img2img | Muốn AI sáng tạo tự do, chỉ lấy ảnh gốc làm gợi ý màu | Không ràng buộc hình học |

**Độ bám hình khối** (`control_lora_strength`):
- `0.85 – 1.0` → giữ đúng thiết kế. Dùng cho bài nộp khách hàng.
- `0.6 – 0.85` → cho AI nới tay chút, đẹp hơn nhưng có thể lệch chi tiết.
- `< 0.6` → gần như tự do sáng tác.

**Mức biến đổi ảnh gốc** (`strength`):
- `0.9 – 1.0` → vẽ lại hoàn toàn. **Bắt buộc** cho sketch và clay model (nếu không, ảnh ra vẫn còn nét chì / vẫn xám).
- `0.5 – 0.8` → giữ lại nhiều màu sắc ảnh gốc. Dùng khi ảnh nguồn đã có vật liệu đúng.

### Preset có sẵn

| Nhóm | Preset |
|---|---|
| **Ngoại thất** | Ban ngày · Hoàng hôn · Chạng vạng (blue hour) |
| **Nội thất** | Hiện đại · Scandinavian · Cao cấp |
| **Cảnh quan & đô thị** | Phối cảnh đô thị · Tổng thể aerial · Sân vườn |
| **Kỹ thuật** | Sketch → ảnh thật · Clay/3D → ảnh thật · Ảnh thi công |

Sửa prompt bất kỳ lúc nào — app tự chuyển sang chế độ *Tuỳ chỉnh*, bấm **Reset** để về prompt gốc của preset.

> **Prompt nên viết bằng tiếng Anh.** FLUX được huấn luyện chủ yếu trên tiếng Anh; prompt tiếng Việt cho kết quả kém hơn rõ rệt.

---

## Kiến trúc

```
src/
├── app/
│   ├── page.tsx                    Studio (trang chính)
│   ├── history/page.tsx            Thư viện
│   └── api/
│       ├── upload/                 POST — nhận ảnh nguồn, lưu vào storage/
│       ├── render/                 POST — tạo job, trả jobId ngay (202)
│       ├── render/[id]/            GET  — poll trạng thái + tiến độ
│       ├── history/                GET  — danh sách, phân trang bằng cursor
│       ├── history/[id]/           PATCH ghim · DELETE xoá
│       ├── providers/              GET  — provider nào đã có key
│       └── files/[...path]/        GET  — phục vụ ảnh từ storage/ (chặn path traversal)
├── components/                     UI (client components)
└── lib/
    ├── providers/                  Lớp adapter — fal.ai, Replicate
    ├── presets.ts                  12 preset kiến trúc + prompt
    ├── jobs.ts                     Job runner nền + serialise
    ├── storage.ts                  Lưu/đọc ảnh, chặn path traversal
    └── db.ts                       Prisma client (SQLite)
```

### Vì sao render chạy nền?

Một lần render mất 20–90 giây. Giữ HTTP request mở suốt thời gian đó sẽ mất khả năng báo tiến độ và dễ bị proxy timeout. Thay vào đó:

`POST /api/render` → tạo row trong DB, spawn job nền, trả `202 { id }` ngay → client poll `GET /api/render/[id]` mỗi 1.2s.

Tiến độ live (vị trí hàng đợi, log từ provider) giữ trong `Map` trên `globalThis`; trạng thái bền vững nằm trong SQLite. Rời trang giữa chừng vẫn không mất kết quả — vào lại Thư viện là thấy.

### Thêm provider mới

Implement interface `RenderProvider` trong `src/lib/providers/types.ts` rồi đăng ký vào mảng `PROVIDERS` ở `src/lib/providers/index.ts`. Không cần đụng tới API route hay UI.

```ts
export const myProvider: RenderProvider = {
  id: "my-provider",
  label: "…",
  apiKeyEnv: "MY_API_KEY",
  apiKeyUrl: "https://…",
  isConfigured: () => Boolean(process.env.MY_API_KEY),
  modelFor: (mode) => MODELS[mode],
  prepareImage: async (buffer, mime) => "…",  // upload hoặc data URI
  render: async (params, onProgress) => ({ images: [...], model: "…" }),
};
```

---

## Lưu trữ dữ liệu

| Thứ | Ở đâu | Có trong git? |
|---|---|---|
| Ảnh nguồn upload | `storage/uploads/` | Không |
| Ảnh render ra | `storage/renders/` | Không |
| Lịch sử render | `prisma/dev.db` (SQLite) | Không |
| API key | `.env.local` | Không |

Đổi chỗ lưu ảnh bằng biến `STORAGE_DIR` trong `.env.local` — hữu ích nếu muốn để trên ổ khác cho đỡ đầy ổ C.

Ảnh **không** nằm trong `public/`; chúng được phục vụ qua `/api/files/[...path]` có kiểm tra chống path traversal, nên không có gì bị lộ ngoài ý muốn.

Xoá một mục trong Thư viện sẽ xoá ảnh render nhưng **giữ lại ảnh nguồn** — nhiều lần render có thể dùng chung một ảnh gốc.

---

## Lệnh

```bash
npm run dev          # dev server
npm run build        # prisma generate + next build
npm start            # chạy bản production
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:push      # đồng bộ schema → SQLite
npm run db:studio    # GUI xem/sửa database
```

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| Banner đỏ "Chưa cấu hình API key" | Chưa có `.env.local`, hoặc có mà chưa restart dev server. Next chỉ đọc env lúc khởi động. |
| `Không tìm thấy model "…"` | fal.ai đã đổi slug endpoint. Set lại qua `FAL_MODEL_CANNY` / `FAL_MODEL_DEPTH` / `FAL_MODEL_IMG2IMG` trong `.env.local`. |
| Ảnh ra vẫn còn nét chì / vẫn xám | **Mức biến đổi ảnh gốc** đang quá thấp. Kéo lên `0.95–1.0`. |
| Ảnh ra khác hẳn thiết kế | Tăng **Độ bám hình khối** lên `0.9+`, và kiểm tra đang dùng đúng chế độ (Depth cho ảnh 3D, Canny cho sketch). |
| Ảnh bị cháy sáng, màu bệt | **Guidance scale** quá cao. FLUX hoạt động tốt nhất quanh `3.5`. |
| `402` từ fal.ai | Hết credit — nạp ở https://fal.ai/dashboard/billing |

---

## Giới hạn đã biết

- **Chưa có MLSD ControlNet.** Cả hai provider hiện chỉ expose Canny và Depth cho FLUX. MLSD (bám đường thẳng — rất hợp mặt đứng kiến trúc) cần chuyển sang `fal-ai/flux-general` với controlnet tuỳ chọn; chưa làm.
- **Negative prompt không được FLUX dùng.** Kiến trúc FLUX.1 dev không nhận negative prompt như SDXL. Field này vẫn được lưu vào lịch sử và sẽ có tác dụng nếu sau này thêm provider chạy SDXL — hiện tại nó không ảnh hưởng tới ảnh ra.
- **Không có xác thực người dùng.** Đây là công cụ chạy local, một người dùng. Đừng expose ra internet nguyên trạng.
- **Job nền mất khi restart server.** Render đang chạy dở lúc restart sẽ kẹt ở trạng thái `running` trong DB. Xoá mục đó trong Thư viện là xong.

---

## Ghi chú kỹ thuật

- **Next.js 16** App Router, React 19, Tailwind v4.
- **Prisma 7** — connection URL nằm ở `prisma.config.ts` (không còn trong `schema.prisma`), client dùng driver adapter `better-sqlite3`. Prisma 7 cũng không tự nạp `.env` nữa nên `prisma.config.ts` gọi `process.loadEnvFile()` thủ công.
- Font **Inter** thay cho Geist mặc định vì Geist không có subset `vietnamese`, dấu tiếng Việt sẽ rơi về font hệ thống.
- Kích thước ảnh đọc ở **phía client** (`readImageSize`) để server không cần thư viện giải mã ảnh; server chỉ snap về bội số 32 và giới hạn cạnh dài 1440px.
