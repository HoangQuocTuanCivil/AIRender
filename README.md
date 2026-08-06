# A2ZRender

Web app biến **ảnh 3D (Civil 3D, OpenRoads, Revit, SketchUp), sketch tay hoặc bản vẽ CAD** của công trình **đường bộ · đường sắt · cầu · hầm** thành **ảnh render chân thực** bằng AI — giữ nguyên hình học của thiết kế gốc.

Giao diện theo hệ thiết kế của `vcc-platform` (SGMT Enterprise Brand Guidelines v3), có cả chế độ sáng và tối.

---

## Bắt đầu nhanh

```bash
npm install
npm run db:push
npm run app
```

Mở http://localhost:3000, vào **Cài đặt** (biểu tượng bánh răng ở thanh trái) và dán `FAL_KEY` vào.

Key nhập trong Cài đặt được lưu vào file SQLite của ứng dụng và có hiệu lực ngay — không cần sửa file, không cần khởi động lại. Ai muốn cấu hình bằng file thì vẫn dùng được `.env.local` (`cp .env.example .env.local`); khi cả hai cùng có, key trong Cài đặt được ưu tiên.

> `npm run app` chạy bản **production**. Dùng nó để làm việc hằng ngày: nhanh hơn và console sạch. `npm run dev` chỉ cần khi đang sửa code — chế độ dev in ra cảnh báo hydration mismatch mỗi lần tải trang nếu bạn có extension bảo mật/chặn quảng cáo chèn thuộc tính vào DOM (`bis_skin_checked`, `__processed_*`). Đó là chẩn đoán của React dành cho lập trình viên, không phải lỗi của app, và không xuất hiện ở bản production.

Chỉ cần **một** `FAL_KEY` (https://fal.ai/dashboard/keys) — nó chạy được cả hai engine chính.

### Hai engine, hai cách làm việc khác nhau

| | **FLUX.1 dev + ControlNet** | **Nano Banana Pro (Gemini)** |
|---|---|---|
| Cơ chế | Trích depth/edge map từ ảnh gốc rồi **vẽ lại** bám theo map | Nhận thẳng ảnh + **câu lệnh chỉnh sửa**, giữ nguyên phần không được nhắc |
| Núm vặn độ bám | Có (0–1) | Không — chỉ điều khiển bằng lời |
| Prompt | Mô tả cảnh | Câu lệnh (app tự đổi văn phong khi bạn đổi engine) |
| Giá | ~$0.025/ảnh | $0.15/ảnh (1K–2K), $0.30 (4K) |
| **Thời gian đo thực tế** | **vài phút** khi endpoint nguội | **~28 giây** |

> **Kết quả đo thực tế trên cùng một ảnh nguồn** (model 3D clay chưa gán vật liệu, cầu cạn 6 nhịp):
> FLUX + ControlNet Depth mất hơn 9 phút và trả về ảnh **gần như y hệt ảnh vào** — depth map trích từ ảnh clay phẳng gần như không có thông tin để bám. Nano Banana Pro mất 28 giây và cho ra ảnh render hoàn chỉnh, đúng cảnh núi đá vôi, trụ đều nhịp, chiều cao dầm không đổi.
>
> Với ảnh 3D chưa gán vật liệu — tức phần lớn công việc của bạn — **Nano Banana Pro đáng đồng tiền** dù đắt gấp 6 lần.

**Điểm quyết định:** ước lượng chiều sâu đơn ảnh gần như **không ghi nhận được cấu kiện mảnh** — dây văng, dây tiếp xúc đường sắt, lan can, cột tiêu đều quá mỏng. Với cầu dây văng, ControlNet Depth đưa cho AI một cái tháp và một mặt cầu rồi để nó **tự bịa toàn bộ hệ dây**. Model chỉnh sửa thì nhìn thấy dây thật.

| Nguồn ảnh | Engine nên dùng |
|---|---|
| **Ảnh 3D clay chưa gán vật liệu** (Civil 3D, OpenRoads, SketchUp) | **Nano Banana Pro** — đã đo, chênh lệch rất lớn |
| Cầu dây văng, cầu treo, đường sắt có catenary | **Nano Banana Pro** — cấu kiện mảnh depth map không ghi nhận được |
| Ảnh 3D **đã có vật liệu và đổ bóng**, chỉ cần nâng cấp chân thực | FLUX + Depth — rẻ hơn 6 lần, đủ dùng |
| Bản vẽ mặt đứng CAD (line art) | FLUX + Canny |
| Thử prompt, chọn góc trước khi render bản đẹp | FLUX ở mức Nhanh — rẻ nhất |

Engine thứ ba — **FLUX Tools trên Replicate** — là phương án dự phòng khi fal.ai gặp sự cố, cần `REPLICATE_API_TOKEN` riêng.

Đổi engine ngay trong UI (panel **Công cụ render**), hoặc đặt mặc định bằng `RENDER_PROVIDER=fal | nano-banana | replicate`.

---

## Cách dùng

### Luồng cơ bản

1. **Kéo thả ảnh nguồn** — ảnh chụp màn hình model 3D, sketch, hoặc bản vẽ mặt đứng.
2. Chọn **Công cụ render** (xem bảng ở trên).
3. Chọn **Loại công trình** → **Bối cảnh** → **Ánh sáng**. Prompt tự ghép lại sau mỗi lần chọn.
4. Chỉnh **ControlNet** nếu engine có — quyết định ảnh giữ đúng hình học hay không.
5. Chọn **Độ phân giải**, bấm **Render**. Khoảng 20–60 giây.
6. Kéo thanh trượt **so sánh trước/sau**, rồi tải ảnh về.

Mẹo so sánh: render cùng một ảnh qua cả hai engine rồi đặt cạnh nhau trong Thư viện — đó là cách nhanh nhất để biết engine nào hợp loại công trình của bạn.

Mọi lần render tự lưu vào **Thư viện** — ghim yêu thích, xem lại tham số, render lại y hệt.

### Prompt ghép từ 3 trục

Thay vì một danh sách preset phẳng, prompt được ghép từ ba trục độc lập:

```
Loại công trình  ×  Bối cảnh  ×  Ánh sáng
   23 lựa chọn        9            7        =  1449 tổ hợp
```

Cầu dây văng giữa núi đá Cao Bằng lúc hoàng hôn và cùng cây cầu đó giữa đồng bằng sông Cửu Long lúc trưa là hai ảnh khác hẳn nhau, dù cùng một model. Preset phẳng sẽ cần 1449 mục; ba trục chỉ cần 39.

**Loại công trình** (23):

| Nhóm | Preset |
|---|---|
| **Đường bộ** | Cao tốc tuyến chính · Đường miền núi · Nút giao liên thông · Đường đô thị · Trạm thu phí |
| **Đường sắt** | ĐSTĐC cầu cạn · Metro trên cao · Đường sắt nền đất · Ga đường sắt |
| **Cầu** | Dây văng · Treo dây võng · Dầm hộp/extradosed · Vòm · Cầu cạn nhiều nhịp · Cầu vượt đô thị · Từ bản vẽ mặt đứng |
| **Hầm** | Cửa hầm · Trong hầm · Hầm chui đô thị |
| **Kiến trúc** | Ngoại thất · Nội thất · Phối cảnh tổng thể · Ảnh thi công |

**Bối cảnh** (9) — viết riêng cho địa hình Việt Nam, vì prompt chung chung cho ra rừng thông ôn đới và lề đường kiểu Mỹ:

| Bối cảnh | Vùng |
|---|---|
| Núi đá vôi Đông Bắc | Cao Bằng, Bắc Kạn, Lạng Sơn, Hà Giang — núi đá dựng đứng |
| Núi rừng Tây Bắc | Sơn La, Lai Châu, Yên Bái — núi đất, ruộng bậc thang |
| Đồng bằng Bắc Bộ | Đồng bằng sông Hồng — ruộng lúa, tre, làng mạc |
| Đồng bằng sông Cửu Long | Miền Tây — kênh rạch, dừa nước |
| Ven biển miền Trung | Bãi biển, cồn cát, phi lao — cảnh **ngoài đô thị** |
| **Đô thị miền Trung (Đà Nẵng)** | Đà Nẵng, Huế, Quy Nhơn — đại lộ rộng, dải phân cách trồng cây, sông Hàn và cầu, núi Sơn Trà/Trường Sơn làm nền |
| Trung du | Phú Thọ, Thái Nguyên — đồi chè, keo, đất đỏ |
| Đô thị Việt Nam | Hà Nội, TP.HCM — nhà ống, dây điện, xe máy dày đặc |
| Không chỉ định | Để AI tự chọn theo ảnh nguồn |

> **Đà Nẵng khác hẳn "Đô thị Việt Nam".** Preset đô thị chung mô tả nhà ống san sát và giao thông xe máy hỗn loạn kiểu Hà Nội / TP.HCM. Đà Nẵng là đô thị ven biển quy hoạch bài bản: đường rộng, vỉa hè lát đá, nhà thấp tầng hiện đại, giao thông thưa và trật tự hơn — dùng nhầm preset sẽ cho ra cảnh sai hẳn vùng miền.

**Ánh sáng** (7): Nắng ban ngày · Trời nhiều mây · Hoàng hôn vàng · Chạng vạng xanh · Ban đêm · Sương sớm · Sau mưa

> Prompt viết bằng **tiếng Anh** — FLUX cho kết quả kém hơn rõ rệt với tiếng Việt. Giao diện thì hoàn toàn tiếng Việt.

### Chi tiết riêng của dự án

Ba trục lo phần chung. Những gì **chỉ dự án của bạn mới có** thì gõ vào ô **Chi tiết riêng của dự án** — nội dung đó được nối vào prompt và **không bị mất khi đổi trục**.

> **Số làn xe có ô riêng, không phải gõ tay.** Với công trình có mặt đường (Đường bộ · Cầu · Hầm), panel Prompt hiện ô **Số làn xe mỗi hướng** — bấm chọn 1–6 hoặc *Không ép*. Ràng buộc được đưa **lên đầu prompt** và nhắc lại nhiều cách (mỗi hướng, tổng số, và "không được đổi ở bất kỳ đâu trong khung hình"), vì model khuếch tán đếm rất kém nếu chỉ nói một lần. Đã kiểm chứng: ép 3 làn → ảnh ra đúng 3 làn mỗi hướng, tổng 6 làn.

| Muốn gì | Gõ gì |
|---|---|
| Dây văng kiểu đàn hạc | `stay cables in a harp arrangement, all parallel` |
| Vật liệu cụ thể | `weathering steel girder`, `white architectural concrete piers` |
| Màu sơn công trình | `pylon painted deep red` |
| Cây cụ thể | `flowering flamboyant trees along the road` |
| Thêm hạng mục | `with an overhead sign gantry in the mid-ground` |

**Ô "Prompt đầy đủ" bình thường không cần đụng tới.** Sửa tay ô đó sẽ bật badge *Tuỳ chỉnh*, và lần sau đổi Loại công trình / Bối cảnh / Ánh sáng thì đoạn sửa tay bị ghi đè. Đó chính là lý do tồn tại ô Chi tiết riêng.

Muốn AI thử vẽ chữ thật trên biển báo: xoá cụm `all signage and information panels rendered as clean blank faces without lettering` khỏi ô Prompt đầy đủ.

**Negative prompt** nằm trong mục *Nâng cao* và **không có tác dụng** — cả FLUX lẫn Nano Banana đều bỏ qua, chỉ lưu vào lịch sử.

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

## Cài đặt

Màn **Cài đặt** (bánh răng ở thanh trái) có hai phần.

**API key.** Mỗi key kèm nhãn cho biết nó mở những engine nào, đường dẫn lấy key, và nguồn đang dùng: *key ở đây* (nhập trong Cài đặt) · *.env.local* (biến môi trường) · *chưa có*. Nhập key mới là ghi đè; nút thùng rác xoá key đã lưu và quay về dùng biến môi trường nếu có. Key hiển thị lại dưới dạng che, chỉ còn 4 ký tự cuối để phân biệt.

Danh sách key sinh ra từ chính danh sách provider, nên thêm engine mới là key của nó tự xuất hiện ở đây. Hai engine chạy trên fal dùng chung `FAL_KEY` nên chỉ hỏi một lần.

> Key nằm trong bảng `Setting` của file SQLite, **không mã hoá** — cùng mức bảo vệ như `.env.local`. Công cụ chạy local một người dùng; đừng expose ra internet nguyên trạng.

**Nhận diện ứng dụng.** Icon ở đầu thanh điều hướng có thể thay bằng ảnh của bạn (PNG · JPG · WebP · AVIF, tối đa 2 MB, ảnh vuông cho kết quả tốt nhất). Ảnh lưu trong `storage/branding/` và phục vụ qua cùng route ảnh có chặn path traversal. Nút **Mặc định** gỡ ảnh, trả về huy hiệu chữ.

---

## Kiến trúc

```
src/
├── app/
│   ├── page.tsx                    Studio
│   ├── history/page.tsx            Thư viện
│   ├── settings/page.tsx           Cài đặt
│   └── api/
│       ├── upload/                 POST — nhận ảnh nguồn
│       ├── render/                 POST — tạo job, trả 202 ngay
│       ├── render/[id]/            GET  — poll trạng thái
│       ├── history/                GET  — phân trang cursor
│       ├── history/[id]/           PATCH ghim · DELETE xoá
│       ├── providers/              GET  — provider nào có key
│       ├── settings/               GET  — key + icon · PUT lưu/xoá key
│       ├── settings/icon/          POST đổi icon · DELETE về mặc định
│       └── files/[...path]/        GET  — ảnh từ storage/ (chặn path traversal)
├── components/
│   ├── app-shell.tsx               Rail + header + theme toggle
│   ├── control-panel.tsx           3 trục + ControlNet + độ phân giải
│   ├── settings-client.tsx         Màn Cài đặt
│   └── ui.tsx                      Button / Panel / Badge theo idiom vcc-platform
└── lib/
    ├── providers/                  Adapter — fal.ai, Replicate
    ├── presets.ts                  Thư viện prompt 3 trục
    ├── jobs.ts                     Job runner nền
    ├── settings.ts                 Key + icon lưu trong SQLite
    ├── brand.ts                    Tên app, huy hiệu mặc định
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
| Icon ứng dụng | `storage/branding/` | Không |
| Lịch sử render | `prisma/dev.db` | Không |
| API key | `prisma/dev.db` (bảng `Setting`), hoặc `.env.local` | Không |

Đổi chỗ lưu ảnh bằng `STORAGE_DIR`. Ảnh **không** nằm trong `public/` — phục vụ qua `/api/files/[...path]` có chặn path traversal.

Xoá một mục trong Thư viện sẽ xoá ảnh render nhưng **giữ ảnh nguồn** — nhiều render có thể dùng chung một ảnh gốc.

---

## Lệnh

```bash
npm run app            # DÙNG APP — build rồi chạy bản production (khuyến nghị)
npm run dev            # dev server — chỉ cần khi đang sửa code
npm run build          # prisma generate + next build
npm start              # chạy bản đã build sẵn
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run check:presets  # kiểm tra thư viện prompt (1449 tổ hợp)
npm run db:push        # đồng bộ schema → SQLite
npm run db:studio      # GUI xem database
```

`check:presets` xác nhận mọi preset nằm trong khoảng zod của `/api/render` chấp nhận — preset đặt `steps: 60` sẽ chỉ lộ ra lúc người dùng bấm Render nếu không có nó.

---

## Xử lý sự cố

| Triệu chứng | Xử lý |
|---|---|
| Banner đỏ "Chưa cấu hình API key" | Chưa có key nào. Vào **Cài đặt** dán key vào — có hiệu lực ngay. Nếu dùng `.env.local` thì phải khởi động lại server, vì Next chỉ đọc env lúc khởi động. |
| Console báo `hydration mismatch`, thấy `bis_skin_checked` / `__processed_*` | Extension trình duyệt chèn thuộc tính vào DOM trước khi React chạy. Không phải lỗi app — chạy `npm run app` (bản production) là hết, hoặc tắt extension đó cho `localhost`. |
| `403 User is locked. Exhausted balance` | Hết credit fal.ai — nạp ở https://fal.ai/dashboard/billing |
| Render qua FLUX chờ vài phút | Endpoint control-LoRA của fal khởi động nguội chậm. Nano Banana nhanh hơn nhiều (~30s). |
| `Không tìm thấy model "…"` | fal.ai đổi slug. Set `FAL_MODEL_CANNY` / `FAL_MODEL_DEPTH` / `FAL_MODEL_IMG2IMG`. |
| Ảnh còn nét chì / vẫn xám | **Mức biến đổi** quá thấp → kéo lên `0.95`. |
| Cầu sai số nhịp, sai số cáp | Tăng **Độ bám hình khối** lên `0.95+`; kiểm tra đang dùng Depth cho model 3D, Canny cho bản vẽ. |
| Chữ trên biển báo méo | Prompt đã yêu cầu để trống biển; nếu tự sửa prompt thì thêm lại cụm đó. |
| Ảnh cháy sáng, bệt màu | **Guidance scale** quá cao — FLUX tốt nhất quanh `3.5`. |
| `402` từ fal.ai | Hết credit — https://fal.ai/dashboard/billing |

---

## Giới hạn đã biết

- **Chưa có MLSD ControlNet.** Cả hai provider chỉ expose Canny và Depth cho FLUX. MLSD (bám đường thẳng — rất hợp mặt đứng cầu và hầm) cần chuyển sang `fal-ai/flux-general` với controlnet tuỳ chọn.
- **Negative prompt không có tác dụng** với cả hai engine hiện có. Trường này vẫn lưu vào lịch sử và sẽ dùng được nếu sau này thêm provider SDXL. Vì vậy mọi ràng buộc đều được viết thành **câu khẳng định** trong prompt chính.
- **Nano Banana không có núm vặn độ bám.** Muốn chặt hơn thì phải sửa câu lệnh trong ô prompt, không có slider.
- **Chưa render trực tiếp từ tài khoản Google.** Nano Banana đang chạy qua fal.ai. Muốn gọi thẳng Google thì cần thêm provider dùng Gemini API key (AI Studio) hoặc Vertex AI + OAuth — xem mục Ghi chú kỹ thuật.
- **Chưa render được tuyến dài liên tục.** Mỗi lần render là một khung hình. Tuyến 5km cần cắt thành nhiều góc rồi ghép thủ công.
- **Không có xác thực người dùng.** Công cụ chạy local, một người dùng. Đừng expose ra internet nguyên trạng.
- **Job nền mất khi restart server.** Render đang chạy dở sẽ kẹt ở `running` trong DB; xoá mục đó là xong.

---

## Ghi chú kỹ thuật

- **Next.js 16** App Router, React 19, Tailwind v4.
- **Prisma 7** — connection URL ở `prisma.config.ts` (không còn trong `schema.prisma`), client dùng driver adapter `better-sqlite3`, và Prisma 7 không tự nạp `.env` nên config gọi `process.loadEnvFile()` thủ công.
- **React 19 lint** coi `setState` đồng bộ trong effect là *error*. Theme đọc bằng `useSyncExternalStore` (theme sống trên `<html>` — external store thật sự), state con reset bằng `key` chứ không bằng effect.
- Font **Inter** kèm subset `vietnamese`. `vcc-platform` khai báo Inter trong mọi font stack nhưng chỉ load Manrope, nên chrome của nó thực tế rơi về Segoe UI — ở đây Inter được load thật.
- Kích thước ảnh đọc ở **phía client** để server không cần thư viện giải mã ảnh; server chỉ snap về bội số 32 và giới hạn theo mức độ phân giải đã chọn. Nano Banana nhận *bucket* độ phân giải (1K/2K/4K) chứ không nhận số pixel, nên `maxSide` được quy đổi sang bucket.

### Ba cách truy cập Nano Banana

| Cách | Xác thực | Đánh giá |
|---|---|---|
| **fal.ai** (đang dùng) | `FAL_KEY` | Một key cho mọi model. fal cộng thêm biên lợi nhuận. |
| **Google AI Studio** | `GEMINI_API_KEY` — đăng nhập Google để **lấy** key | Rẻ hơn, có bậc miễn phí. Vẫn là API key, không phải OAuth. |
| **Vertex AI** (Google Cloud) | OAuth / service account (`gcloud auth`) | Đây mới thật sự là "đăng nhập bằng tài khoản Google". Cần project GCP + bật billing. Chỉ đáng khi đã ở sẵn trên GCP hoặc cần kiểm soát cấp doanh nghiệp. |

App Gemini cho người dùng cuối (gemini.google.com) **không có API** — không thể dựng tích hợp lên nó.
