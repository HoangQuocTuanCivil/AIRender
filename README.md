# AIRender

Web app biến **ảnh 3D (Civil 3D, OpenRoads, Revit, SketchUp), sketch tay hoặc bản vẽ CAD** của công trình **đường bộ · đường sắt · cầu · hầm** thành **ảnh render chân thực** bằng AI — giữ nguyên hình học của thiết kế gốc.

Giao diện theo hệ thiết kế của `vcc-platform` (SGMT Enterprise Brand Guidelines v3), có cả chế độ sáng và tối.

---

## Bắt đầu nhanh

```bash
npm install
cp .env.example .env.local     # mở .env.local, điền FAL_KEY
npm run db:push
npm run dev
```

Mở http://localhost:3000

| Provider | Lấy key | Ghi chú |
|---|---|---|
| **fal.ai** (khuyến nghị) | https://fal.ai/dashboard/keys | Nhanh nhất, ControlNet tốt nhất. ~$0.04/megapixel |
| Replicate | https://replicate.com/account/api-tokens | Dự phòng, FLUX Tools của Black Forest Labs |

Chỉ cần **một** trong hai. Ép cứng bằng `RENDER_PROVIDER=fal` hoặc `replicate`.

---

## Cách dùng

### Luồng cơ bản

1. **Kéo thả ảnh nguồn** — ảnh chụp màn hình model 3D, sketch, hoặc bản vẽ mặt đứng.
2. Chọn **Loại công trình** → **Bối cảnh** → **Ánh sáng**. Prompt tự ghép lại sau mỗi lần chọn.
3. Chỉnh **ControlNet** nếu cần — quyết định ảnh có giữ đúng hình học hay không.
4. Chọn **Độ phân giải**, bấm **Render**. Khoảng 20–60 giây.
5. Kéo thanh trượt **so sánh trước/sau**, rồi tải ảnh về.

Mọi lần render tự lưu vào **Thư viện** — ghim yêu thích, xem lại tham số, render lại y hệt.

### Prompt ghép từ 3 trục

Thay vì một danh sách preset phẳng, prompt được ghép từ ba trục độc lập:

```
Loại công trình  ×  Bối cảnh  ×  Ánh sáng
   23 lựa chọn        8            7        =  1288 tổ hợp
```

Cầu dây văng giữa núi đá Cao Bằng lúc hoàng hôn và cùng cây cầu đó giữa đồng bằng sông Cửu Long lúc trưa là hai ảnh khác hẳn nhau, dù cùng một model. Preset phẳng sẽ cần 1288 mục; ba trục chỉ cần 38.

**Loại công trình** (23):

| Nhóm | Preset |
|---|---|
| **Đường bộ** | Cao tốc tuyến chính · Đường miền núi · Nút giao liên thông · Đường đô thị · Trạm thu phí |
| **Đường sắt** | ĐSTĐC cầu cạn · Metro trên cao · Đường sắt nền đất · Ga đường sắt |
| **Cầu** | Dây văng · Treo dây võng · Dầm hộp/extradosed · Vòm · Cầu cạn nhiều nhịp · Cầu vượt đô thị · Từ bản vẽ mặt đứng |
| **Hầm** | Cửa hầm · Trong hầm · Hầm chui đô thị |
| **Kiến trúc** | Ngoại thất · Nội thất · Phối cảnh tổng thể · Ảnh thi công |

**Bối cảnh** (8) — viết riêng cho địa hình Việt Nam, vì prompt chung chung cho ra rừng thông ôn đới và lề đường kiểu Mỹ:

Núi đá vôi Đông Bắc (Cao Bằng, Bắc Kạn, Hà Giang) · Núi rừng Tây Bắc · Đồng bằng Bắc Bộ · Đồng bằng sông Cửu Long · Ven biển miền Trung · Trung du · Đô thị Việt Nam · Không chỉ định

**Ánh sáng** (7): Nắng ban ngày · Trời nhiều mây · Hoàng hôn vàng · Chạng vạng xanh · Ban đêm · Sương sớm · Sau mưa

> Prompt viết bằng **tiếng Anh** — FLUX cho kết quả kém hơn rõ rệt với tiếng Việt. Giao diện thì hoàn toàn tiếng Việt.

### Ràng buộc hình học — thứ quyết định độ tin cậy kỹ thuật

Mỗi loại công trình mang theo một **mệnh đề ràng buộc** nhắm đúng chi tiết mà AI hay làm sai ở dạng kết cấu đó:

| Loại | AI thường sai | Ràng buộc đã cài |
|---|---|---|
| Cầu dây văng | Số dây hai bên khác nhau, dây chéo/võng | Dây thẳng, căng, cách đều góc, đối xứng tuyệt đối qua tháp |
| Cầu cạn | Nhịp dài ngắn khác nhau, trụ lệch hàng | Mọi nhịp bằng nhau, trụ giống hệt và thẳng hàng |
| Đường sắt | Cột tiếp xúc thưa dày tuỳ tiện, tà vẹt không đều | Cột đúng chu kỳ, cùng chiều cao; dây tiếp xúc song song ray |
| Cao tốc | Số làn đổi giữa ảnh, vạch kẻ đứt đoạn | Số làn không đổi, vạch liền và vạch đứt đều nhịp |
| Trong hầm | Mặt cắt phình/thóp, đèn lộn xộn | Mặt cắt không đổi, đèn thẳng hàng hội tụ về điểm tụ |

**Chữ trên biển báo**: FLUX luôn vẽ ra chữ méo — dấu hiệu lộ liễu nhất của ảnh AI. Mọi preset đều yêu cầu biển báo **để trống mặt**. Muốn AI thử vẽ chữ thật thì xoá cụm `all signage and information panels rendered as clean blank faces without lettering` khỏi prompt.

### Chọn chế độ ControlNet

Sai chế độ → AI vẽ ra một công trình khác.

| Chế độ | Dùng khi |
|---|---|
| **Depth** — giữ khối | Ảnh 3D Civil 3D/OpenRoads/Revit/SketchUp, ảnh chụp công trình. Mặc định cho hầu hết preset. |
| **Canny** — giữ nét | Sketch tay, line-art từ CAD, **bản vẽ mặt đứng cầu**. |
| **Không** — img2img | AI sáng tạo tự do, chỉ lấy ảnh gốc làm gợi ý màu. |

**Độ bám hình khối** — preset đã đặt sẵn theo mức độ nghiêm ngặt của từng loại:

| | Giá trị | Vì sao |
|---|---|---|
| Cầu, hầm | `0.92 – 0.97` | Sai một nhịp hay một sợi cáp là bị bắt lỗi ngay trong họp thẩm định |
| Đường sắt | `0.90 – 0.92` | Gauge và nhịp cột phải đều |
| Đường bộ | `0.85 – 0.90` | Hàng cây lệch một chút không sao |
| Bản vẽ mặt đứng | `0.97` | Không được phép bịa thêm cấu kiện |

**Mức biến đổi ảnh gốc**: ảnh 3D chưa gán vật liệu hoặc bản vẽ CAD → `0.92–0.95`. Ảnh đã có vật liệu đúng → `0.6–0.8`.

### Độ phân giải

| Mức | Cạnh dài | Dùng khi |
|---|---|---|
| Nhanh | 1024px | Thử prompt, chọn góc — rẻ nhất |
| Chuẩn | 1440px | Trình chiếu, báo cáo |
| Cao | 2048px | Bản in A3, bìa hồ sơ. Tốn ~2x |

Tỉ lệ khung hình **luôn giữ theo ảnh nguồn** — render khác tỉ lệ với ảnh control sẽ lệch khỏi hình học mà nó đang phải bám theo.

### Mẹo cho hồ sơ nhiều ảnh

Cần render nhiều góc của cùng một dự án mà vẫn đồng nhất vật liệu và mùa: **khoá seed** (Nâng cao → Seed), giữ nguyên Bối cảnh và Ánh sáng, chỉ đổi ảnh nguồn.

---

## Kiến trúc

```
src/
├── app/
│   ├── page.tsx                    Studio
│   ├── history/page.tsx            Thư viện
│   └── api/
│       ├── upload/                 POST — nhận ảnh nguồn
│       ├── render/                 POST — tạo job, trả 202 ngay
│       ├── render/[id]/            GET  — poll trạng thái
│       ├── history/                GET  — phân trang cursor
│       ├── history/[id]/           PATCH ghim · DELETE xoá
│       ├── providers/              GET  — provider nào có key
│       └── files/[...path]/        GET  — ảnh từ storage/ (chặn path traversal)
├── components/
│   ├── app-shell.tsx               Rail + header + theme toggle
│   ├── control-panel.tsx           3 trục + ControlNet + độ phân giải
│   └── ui.tsx                      Button / Panel / Badge theo idiom vcc-platform
└── lib/
    ├── providers/                  Adapter — fal.ai, Replicate
    ├── presets.ts                  Thư viện prompt 3 trục
    ├── jobs.ts                     Job runner nền
    ├── storage.ts                  Lưu/đọc ảnh, chặn path traversal
    ├── theme.ts                    Token sáng/tối, script chống nháy
    └── db.ts                       Prisma client (SQLite)
```

### Vì sao render chạy nền?

Một lần render mất 20–90 giây. Giữ HTTP request mở suốt thời gian đó sẽ mất khả năng báo tiến độ và dễ bị proxy timeout.

`POST /api/render` → tạo row DB, spawn job nền, trả `202 { id }` → client poll mỗi 1.2s. Tiến độ live nằm trong `Map` trên `globalThis`; trạng thái bền vững trong SQLite. Rời trang giữa chừng vẫn không mất kết quả.

### Thêm provider mới

Implement `RenderProvider` trong `src/lib/providers/types.ts`, đăng ký vào `PROVIDERS` ở `providers/index.ts`. Không cần đụng API route hay UI.

### Giao diện

Port từ `vcc-platform` — repo đó là Vite + Ant Design, nên chỉ ngôn ngữ thị giác được mang sang, không phải framework:

- **Token**: brand ramp 11 bậc, neutral ramp, 4 cặp trạng thái, radius 4/6/7/8/12/16, ba mức shadow.
- **Màu hành động** `#3F55C8` (brand-600 — chữ trắng đạt 6.28:1; brand-500 chỉ 4.70:1 nên chỉ dùng cho vòng focus).
- **Card**: viền 1px, bo 8px, **đúng một lớp** shadow. Không glassmorphism trong chrome.
- **Button**: phẳng, không shadow, bo 7px, weight 600. Nút phụ viền, không tô nền.
- **Chip**: không viền, có chấm dẫn đầu, bo 6px.
- **Sáng + tối luôn đi cùng nhau** — hook `[data-vx-dark='1']` trên `<html>` (thuộc tính ở root nên với tới cả portal như toast/dialog). Dark đảo neutral ramp dưới cùng tên biến, nên component không cần class riêng cho từng theme.
- **Màu module** chỉ xuất hiện ở điểm nhấn (icon rail, chỉ báo 3px, trạng thái đang chọn). Nền trang giữ trung tính.

---

## Lưu trữ

| Thứ | Ở đâu | Trong git? |
|---|---|---|
| Ảnh nguồn / ảnh render | `storage/` | Không |
| Lịch sử render | `prisma/dev.db` | Không |
| API key | `.env.local` | Không |

Đổi chỗ lưu ảnh bằng `STORAGE_DIR`. Ảnh **không** nằm trong `public/` — phục vụ qua `/api/files/[...path]` có chặn path traversal.

Xoá một mục trong Thư viện sẽ xoá ảnh render nhưng **giữ ảnh nguồn** — nhiều render có thể dùng chung một ảnh gốc.

---

## Lệnh

```bash
npm run dev            # dev server
npm run build          # prisma generate + next build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run check:presets  # kiểm tra thư viện prompt (1288 tổ hợp)
npm run db:push        # đồng bộ schema → SQLite
npm run db:studio      # GUI xem database
```

`check:presets` xác nhận mọi preset nằm trong khoảng zod của `/api/render` chấp nhận — preset đặt `steps: 60` sẽ chỉ lộ ra lúc người dùng bấm Render nếu không có nó.

---

## Xử lý sự cố

| Triệu chứng | Xử lý |
|---|---|
| Banner đỏ "Chưa cấu hình API key" | Chưa có `.env.local`, hoặc chưa restart dev server. Next chỉ đọc env lúc khởi động. |
| `Không tìm thấy model "…"` | fal.ai đổi slug. Set `FAL_MODEL_CANNY` / `FAL_MODEL_DEPTH` / `FAL_MODEL_IMG2IMG`. |
| Ảnh còn nét chì / vẫn xám | **Mức biến đổi** quá thấp → kéo lên `0.95`. |
| Cầu sai số nhịp, sai số cáp | Tăng **Độ bám hình khối** lên `0.95+`; kiểm tra đang dùng Depth cho model 3D, Canny cho bản vẽ. |
| Chữ trên biển báo méo | Prompt đã yêu cầu để trống biển; nếu tự sửa prompt thì thêm lại cụm đó. |
| Ảnh cháy sáng, bệt màu | **Guidance scale** quá cao — FLUX tốt nhất quanh `3.5`. |
| `402` từ fal.ai | Hết credit — https://fal.ai/dashboard/billing |

---

## Giới hạn đã biết

- **Chưa có MLSD ControlNet.** Cả hai provider chỉ expose Canny và Depth cho FLUX. MLSD (bám đường thẳng — rất hợp mặt đứng cầu và hầm) cần chuyển sang `fal-ai/flux-general` với controlnet tuỳ chọn.
- **Negative prompt không có tác dụng.** FLUX.1 dev không nhận negative prompt như SDXL. Trường này vẫn lưu vào lịch sử và sẽ dùng được nếu sau này thêm provider SDXL. Vì vậy mọi ràng buộc đều được viết thành **câu khẳng định** trong prompt chính.
- **Chưa render được tuyến dài liên tục.** Mỗi lần render là một khung hình. Tuyến 5km cần cắt thành nhiều góc rồi ghép thủ công.
- **Không có xác thực người dùng.** Công cụ chạy local, một người dùng. Đừng expose ra internet nguyên trạng.
- **Job nền mất khi restart server.** Render đang chạy dở sẽ kẹt ở `running` trong DB; xoá mục đó là xong.

---

## Ghi chú kỹ thuật

- **Next.js 16** App Router, React 19, Tailwind v4.
- **Prisma 7** — connection URL ở `prisma.config.ts` (không còn trong `schema.prisma`), client dùng driver adapter `better-sqlite3`, và Prisma 7 không tự nạp `.env` nên config gọi `process.loadEnvFile()` thủ công.
- **React 19 lint** coi `setState` đồng bộ trong effect là *error*. Theme đọc bằng `useSyncExternalStore` (theme sống trên `<html>` — external store thật sự), state con reset bằng `key` chứ không bằng effect.
- Font **Inter** kèm subset `vietnamese`. `vcc-platform` khai báo Inter trong mọi font stack nhưng chỉ load Manrope, nên chrome của nó thực tế rơi về Segoe UI — ở đây Inter được load thật.
- Kích thước ảnh đọc ở **phía client** để server không cần thư viện giải mã ảnh; server chỉ snap về bội số 32 và giới hạn theo mức độ phân giải đã chọn.
