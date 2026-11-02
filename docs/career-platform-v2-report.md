# AIHN Career — Audit, hardening và Career Platform v2

Phạm vi triển khai theo [plan](career-platform-v2-plan.md). Đã đọc runtime source và
test contracts trước khi sửa; README không được dùng làm bằng chứng chức năng.
Chi tiết thuật toán, dữ liệu, state machine và giới hạn nằm trong
[architecture/evaluation](career-platform-v2-architecture.md).

## Git và commit

Hai repo Frontend/Backend độc lập. Tạo `fix/project-hardening` từ local `main`,
merge nhánh đang chạy làm baseline để giữ lịch sử/UI/auth hiện có. Tạo
`feat/career-platform-v2` từ fix sau gate ban đầu; các bản vá cấu hình/dependency
phát hiện ở lượt audit cuối tiếp tục được commit trên fix, rồi merge một chiều sang
feature. Không đưa feature vào nhánh fix. Không sửa main, force-push, rewrite history,
xóa nhánh cũ, push hay deploy.

AI-service là repo thứ ba, ban đầu chưa có commit và source chưa tracked. Snapshot
source hiện có trên nhánh fix (không tạo commit trên main), sửa protocol/prompt tests,
rồi tạo nhánh feature cùng tên. Evidence/scripts cũ chưa tracked được giữ nguyên.

| Repo | Nhóm commit chính |
| --- | --- |
| Backend fix | `0d02444` OTP/context/age/constraints/runtime; `d534f4b` production secrets/TTL; `e4e1134` dependency security + mail/image compatibility |
| Frontend fix | `82d7bf1` accessibility/preview/CTA và core regression; `5f1766f` thay số liệu tác động, testimonial và liên kết trường chưa có bằng chứng trên Home |
| AI-service fix | `e4a0e73` baseline bridge; `fe20587` bỏ knowledge tĩnh chưa kiểm chứng, sửa regression contract |
| Backend feature | `a4409fb` sourced catalog/scoring/profile/recommendation; `81ee4f3` goals/analytics/advisor context; `ac41b83` evaluation + browser integration |
| Frontend feature | `306ebb2` explorer/profile/recommendations; `ed329bf` roadmap/user/admin analytics; `eb4fa54` full regression; `0fbedc9` nguồn lịch sử vẫn mở được khi nghề đã ẩn |

## Phase 1 đã xử lý

- OTP: HMAC theo email/purpose/code, tối đa 5 lượt kiểm tra bằng atomic DB update;
  lượt sai vẫn được giữ khi transaction nghiệp vụ rollback. Consume OTP + register/
  reset-password/refresh revocation vẫn cùng transaction. Migration vô hiệu hóa OTP
  plaintext cũ; không xóa account/result/history.
- Giữ ownership ở HTTP, WebSocket và worker. Parse route ID đầy đủ, không chấp nhận
  tiền tố số như `12suffix`. Role của admin lấy từ DB, không tin JWT role do client gửi.
- Tuổi tính theo ngày sinh bằng UTC, có test trước/đúng sinh nhật và năm nhuận;
  registration từ chối ngày sinh tương lai. Context không gửi password/token/email/phone.
- AI URL/env/config, timeout/size/cancel/lease/no-replay được kiểm chứng. Completion
  rỗng là lỗi; lịch sử AI gồm cả lượt đã checkpoint, với giới hạn rõ ràng thay vì mất memory.
- Schema: OTP unique/index/attempt cap, Priority uniqueness/range, CHECK role/type,
  totalQuestions dương, updatedAt do Prisma cập nhật. Giữ các string column và historical
  scale để không phá API/legacy data; enum domain được ràng buộc bằng CHECK tương thích.
- Compose truyền AI/CORS/mail/secrets, bind DB vào loopback, giữ avatar bằng volume;
  env mẫu/tooling pnpm được sửa đúng trạng thái repo. Logging/error envelope hiện có
  được giữ, không log payload/secret/stack chứa credential.
- Bỏ số liệu tác động/testimonial/liên kết trường chưa có bằng chứng trên Home,
  countdown/điểm/target cố định, công thức tuyển sinh 40/30/30 chưa tồn tại, lương/
  tăng trưởng/tổ hợp và claim O*NET/Bộ GD&ĐT không có nguồn. Preview có nhãn dữ liệu mẫu.
- Production dependency audit Backend từ 95 advisory instances xuống 0; Frontend 0.
  Chi tiết/nguồn và compatibility nằm trong [dependency audit](security-dependencies.md).

## P0/P1 đã triển khai

| Feature | Hành vi và chiều sâu kỹ thuật |
| --- | --- |
| Catalog/detail P0 | 923 nghề, 35 skills từ O*NET 31.0; manifest/hash/attribution; ETL tái tạo và importer transactional, khóa advisory, lặp lại không tăng revision khi dữ liệu không đổi; giữ trạng thái xuất bản |
| Hybrid recommendation P0 | Pearson toàn vector RIASEC + skill ratios có importance + cosine interests; weights 65/25/10 chuẩn hóa theo tín hiệu có sẵn; flat/unknown tách khỏi zero; tie ổn định |
| Explainability P0 | Snapshot input/profile/catalog/algorithm version; top 20 có từng contribution/weight/missing/coverage/gap; frontend kiểm tra phép cộng và link nguồn lịch sử độc lập trạng thái publish |
| Career profile P0 | Skills/interests 0–5, target nghề; owner-scoped, revision conflict; draft giữ khi lỗi/unknown và không auto-replay; tuổi/giới tính/địa chỉ không được dùng để xếp hạng |
| Skill gap P1 | Unknown không bị coi là thiếu toàn bộ; gap = max(required − self, 0), ưu tiên theo importance × gap |
| Roadmap/progress P1 | 4 phase từ exploration đến review; unknown tạo task tự đánh giá, known gap tạo practice; evidence bắt buộc, phase dependency, optimistic concurrency, explicit regeneration giữ task/evidence đã làm |
| Advisor context P1 | Đọc profile/result sở hữu/session history + current target/gap/recommendation evidence/roadmaps từ DB mỗi turn; AI không ghi điểm/hồ sơ/progress |
| User analytics/trend P1 | Counts thật, task completion, timeline và delta RIASEC dùng snapshot denominator từng lần, không dùng bộ câu hỏi hiện tại |
| Admin governance P1 | Publish/archive bằng revision + atomic audit; xem dictionary/skill requirements và aggregate recommendation/goals/progress/Holland distribution; số liệu nguồn thay qua ETL có checksum |
| Evaluation P1 | Six synthetic probes trên 923 career vectors, RIASEC-only baseline, ablation interests, perturbation sensitivity; report có version, không bịa accuracy/nDCG khi thiếu nhãn chuyên gia |

## Kiểm chứng

| Gate | Kết quả |
| --- | --- |
| Backend `pnpm run check` | 35 suites / 237 tests; typecheck, strict subset, architecture (không runtime cycle), lint và build pass |
| Built API isolated e2e | 10 tests pass với PostgreSQL/Redis/Bull và local AI protocol adapter |
| Fault injection live | Worker crash không replay; concurrent completion; ownership; atomic snapshot/assistant/checkpoint/audit rollback; cancellation/lease; readiness failure/recovery pass |
| Docker | Build production deps, migrate vào DB riêng, ready/private HTTP và SIGTERM/cleanup pass với Node 24 |
| Frontend | 19 unit files / 156 tests; 418 Chromium tests; typecheck/lint/build pass, gồm responsive boundaries và owner/draft/unknown-mutation regressions |
| AI-service | 19 tests, Ruff lint và format pass |
| Browser tích hợp thật | React production build → NestJS → PostgreSQL/Redis/Bull, đăng nhập → trả lời/nộp đủ 108 câu qua UI → result → profile → recommendations → roadmap/evidence → analytics → advisor/history pass; provider text dùng adapter cục bộ |
| Production dependency audit | FE 0 và BE 0 advisory low/moderate/high/critical tại thời điểm kiểm tra |
| DB hiện tại (read-only preflight) | 0 invalid role, question type, nonpositive attempt, duplicate Priority type hoặc mismatched chat/attempt owner |

Smoke browser đủ 108 câu lưu evidence tại `/tmp/aihn-e2e-jbMg5X` và log
`/tmp/aihn-full-ui-journey2.log` (artifact tạm trên máy này). Các câu hỏi fixture
kiểm chứng luồng boolean; đây không phải bằng chứng thẩm định bộ đo tâm lý.

Các DB/runtime fixture đều có UUID riêng và đã cleanup. Không seed/migrate DB ứng dụng
đang dùng, không ghi đè `.env`, không gửi mail thật hoặc gọi provider bên ngoài.
SMTP capture là chứng minh transport cục bộ, không phải inbox/production delivery.

Để reproduce: Node 24 + pnpm đúng version; `pnpm install --frozen-lockfile`,
`pnpm exec prisma generate`, `pnpm exec prisma migrate deploy`, rồi explicit
`pnpm run career:import` trên DB dev được chọn. AI-service dùng env riêng và
`uv sync --frozen`. Cấu hình `VITE_API_ORIGIN`/`VITE_SOCKET_ORIGIN` là origin Backend,
không trỏ browser trực tiếp sang AI-service. Lệnh kiểm chứng browser thật:
`pnpm run test:career:browser` (cần sibling Frontend và Chromium của Playwright).

## Phần cần nghiên cứu tiếp

- Dữ liệu nghề hiện là tiếng Anh/thị trường Mỹ, không suy ra lương hay tuyển sinh VN.
  Cần nguồn VN được duyệt, editorial localization và RAG/citation validation (P2).
- Cần nhãn relevance do chuyên gia/học sinh đồng thuận để đánh giá held-out
  Precision@K/nDCG, sensitivity và bias. Weights/self-ratings chưa được thẩm định.
- Course/resource recommendations, lịch học chi tiết và mô hình học ranking cần dữ liệu
  riêng; không tạo link khóa học/độ phù hợp/career outcome giả.
- Nest runtime hiện chạy một app replica vì stream events dùng in-process emitter;
  phải thêm Redis stream routing/Socket.IO adapter và distributed send/IP throttling
  trước triển khai nhiều replica.
- Provider generation/quality, SMTP inbox thực, remote CI và production deployment
  chưa được xác nhận. Build có warning bundle lớn của UI dependencies; có thể tối ưu
  code splitting sau khi đo trên thiết bị thực.
