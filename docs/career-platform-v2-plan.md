# AIHN Career: audit and implementation roadmap

Ngày lập: 2026-10-19. Phạm vi: React/Vite Frontend, NestJS Backend,
PostgreSQL/Prisma, Redis/Bull và giao thức tới Python AI-service.

## Baseline và Git

Đã đọc runtime source (auth/OTP, guards, user/avatar, assessment/answer/result,
history, admin, chat gateway/processor/adapter/context, FE session/transport,
routes và các module nghề nghiệp), schema/migrations, cấu hình và regression tests.
README chỉ là tài liệu phụ. Hai repo độc lập, working tree sạch khi bắt đầu.

`fix/project-hardening` được tạo từ local `main` của từng repo. Merge không rewrite
nhánh đang chạy vào fix để bảo toàn chức năng: Backend `feat/profile-avatar`
(`d00661b`), Frontend `feat/sync-opendesign-ui` (`c01276d`). Đây là baseline,
không được tính thành tính năng mới của đợt nâng cấp. Không push/deploy. AI-service là repo thứ ba với unborn main và toàn bộ source chưa tracked; tạo nhánh fix và root baseline snapshot ở nhánh đó, không tạo commit trên main.

## Phase 1: audit và sửa

| Hạng mục | Bằng chứng trong source | Hành động |
| --- | --- | --- |
| OTP | randomInt, TTL/cooldown và atomic consume đã có; code còn plaintext, chưa giới hạn theo challenge | HMAC với server secret, tối đa 5 lần kiểm tra/challenge (kể cả verify thành công chưa consume) dùng DB atomic update; giữ consume cùng transaction nghiệp vụ; OTP cũ bị vô hiệu hóa khi migrate |
| Ownership | JWT identity từ DB, result/snapshot/answer/chat kiểm tra owner đã có | Giữ tests; kiểm tra lại worker trước side effects, validate route ID hoàn toàn, không parseInt tiền tố |
| Tuổi/context | mapper và context chỉ trừ năm; metadata profile chưa biết bị gán false | Tính ngày sinh theo UTC, từ chối ngày sinh tương lai; unknown là null; không gửi password/token/email/phone |
| AI streaming | URL env, timeout/cancel/size và turn lease đã có | Kiểm chứng frame terminal, reject empty completion; full bounded history gồm checkpointed messages; không replay mutation/job |
| DB | UserRole/QuestionType enum khai báo nhưng cột string, thiếu OTP index | CHECK constraints tương thích legacy, unique Priority.type, OTP unique(email,type), indexes và updatedAt; không xóa lịch sử |
| Runtime | Redis dùng chung config; Compose bỏ AI/CORS/mail, avatar storage không durable | Truyền cấu hình rõ ràng, volume storage, env mẫu đầy đủ, hướng dẫn dependency startup/migrate/seed |
| FE | transport/session tốt; UI sync thêm countdown, điểm và mục tiêu cứng | Loại bỏ dữ liệu cá nhân/tuyển sinh giả khỏi dashboard; giữ layout và empty state |
| Validation/logging | whitelist DTO, error envelope và redacted logs đã có | Giữ API envelope; bổ sung ràng buộc các đầu vào mới; regression auth/ownership/errors |

Gate: Backend `pnpm run check`, schema validate, isolated migrated PostgreSQL/Redis
e2e/live/Docker khi runtime có sẵn; Frontend typecheck/lint/unit/build và Playwright.
Ghi rõ fixture/browser/provider/live chứng minh những gì. Commit toàn bộ Phase 1
trước khi tạo `feat/career-platform-v2` từ fix.

## Nghiên cứu và lựa chọn thiết kế

- [O*NET Database](https://www.onetcenter.org/database.html): occupation, six interest
  scores, skills và provenance. Dữ liệu Mỹ, không phải chuẩn đầu vào/đầu ra hay lương VN.
- [O*NET Interest Profiler manual](https://www.onetcenter.org/dl_files/IP_Manual.pdf):
  so sánh hình dạng toàn bộ vector RIASEC. AIHN giữ bộ câu hỏi boolean 108 câu đang có;
  không gọi đó là O*NET assessment đã được thẩm định.
- [O*NET license](https://www.onetcenter.org/license_db.html): giữ attribution,
  version, nguồn và mô tả phép biến đổi trong dataset manifest.
- [OWASP OTP handling](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html):
  TTL, single use, strict attempts, không plaintext. HMAC không thay thế attempt limit.

Thuật toán là mô hình gợi ý minh bạch do đồ án thiết kế, không phải xác suất thành công
hay tính phù hợp đã hiệu chỉnh. Pearson shape similarity cho RIASEC; flat vector trả
unknown, không đoán. Skills là tự đánh giá, interest bổ sung do người dùng xác nhận.
Weights có version và renormalize khi thiếu dữ liệu; công bố coverage/missing inputs.
Không dùng tuổi/giới tính/địa chỉ để xếp hạng nghề. Snapshot câu hỏi của từng attempt
là mẫu số chuẩn hóa để so sánh các lần làm khác bộ đề.

## Feature đề xuất

| Feature / Vấn đề / Giá trị bảo vệ | Logic chính | FE / BE / DB / AI | Dependency | Độ khó | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- |
| Catalog + career detail: preview hiện chưa có contract thật; chứng minh ETL và chất lượng dữ liệu | Import có provenance, validate sáu chiều, skills và nguồn; tìm kiếm/lọc/pagination; curated activation | FE catalog/detail thật; BE read/admin APIs; DB Career/Skill/CareerSkill + version; AI chỉ dùng career đã xuất bản | Dataset có giấy phép | Cao | P0 |
| Recommendation + explainability: chưa có ranking thật; trọng tâm thuật toán | Pearson RIASEC mapped 0..100; skill coverage weighted importance; interest cosine; 0.65/0.25/0.10 renormalized; stable tie by ID; ghi component contributions, data coverage, version | FE list/detail breakdown; BE pure scoring + recommendation run; DB immutable run/input/output; AI giải thích score có sẵn | Catalog, completed result/snapshot | Cao | P0 |
| Profile skills/interests/target: account profile thiếu thông tin định hướng; chứng minh ownership và data contracts | User tự xác nhận mức skill 0..5, interests sáu chiều 0..5, career target; optimistic concurrency | FE editor riêng trong flow nghề; BE owner-scoped PUT; DB CareerProfile revision; AI nhận verified input | Catalog + skills | Vừa | P0 |
| Skill gap: người học chưa biết thiếu gì; giải thích được đầu vào roadmap | target skill = normalized O*NET importance; gap=max(target-self,0), unknown riêng; importance prioritization | FE evidence table; BE deterministic gaps; DB giữ source/version trong run/goal; AI nhận gap | Skills + target | Vừa | P1 |
| Personalized roadmap + goals/progress: chưa có kế hoạch có thể theo dõi; chứng minh state và concurrency | Tạo goal từ target, skill gap priority; task có evidence, todo/done, completion ratio đếm task; regenerate chỉ khi chủ động | FE roadmap/checklist; BE transactional create/update owner/version checks; DB Goal/GoalTask; AI không tự ghi progress | Gap, target | Cao | P1 |
| Advisor context: thiếu profile enrichment và conversation memory; chứng minh integration | Đọc DB từng turn; bounded history, profile, target, recommendation evidence và roadmap; missing explicit | FE giữ streaming lifecycle; BE context builder qua public module interface; DB histories/run/goals; AI structured context | P0 + roadmap | Cao | P1 |
| RIASEC trend + user analytics: không thấy thay đổi; chứng minh longitudinal data | Snapshot denominator mỗi chiều, timeline normalized, delta latest/prior chỉ khi đủ snapshot; counts thật | FE dashboard timeline/table; BE owner analytics; DB attempt/result/snapshot hiện có; AI có thể đọc evidence | Completed attempts | Vừa | P1 |
| Admin data/analytics: preview chưa vận hành được; chứng minh governance | Publish/archive career với revision + audit, skill inspection, usage aggregate và distribution | FE admin panel; BE ADMIN APIs, aggregate DB; DB audit/catalog status; AI không thấy archived careers mới | Catalog và tracking | Cao | P1 |
| Evaluation harness: ranking chưa có ground truth; thêm chiều sâu thực nghiệm | Deterministic invariants, sensitivity, ablation; export đánh giá chuyên gia Precision@K/nDCG khi có nhãn thật | BE evaluator + versioned fixture; tài liệu phương pháp; không bịa accuracy | Scoring | Vừa | P1 |
| RAG VN có citation + kiểm soát workflow | ETL nguồn có version, retrieve/rerank, citation validator, state/consent, grounded eval | FE citations; BE orchestration; DB document/chunk; AI retrieval | Nguồn VN được duyệt + eval labels | Rất cao | P2 |
| Collaborative ranking / learning-to-rank | Feedback propensity, cold start, offline split và bias audit | FE feedback; BE training pipeline; DB labels/version; model registry | Cohort và ground truth đủ lớn | Rất cao | P2 |

## Implementation phases

1. **Hardening**: fix theo bảng audit; kiểm chứng core journey và commit riêng FE/BE.
2. **P0 data + engine**: versioned sourced dataset/import, catalog, pure scoring,
   snapshots, profile contracts. Test boundary, unknown/flat data, ownership, ties.
3. **P0 product integration**: FE runtime catalog/detail/recommendation/profile;
   expose explainability và nguồn; browser smoke + commit riêng.
4. **P1 progression + intelligence**: skill gaps, goals/tasks/progress, richer AI
   context, trend/user/admin analytics và curated dataset controls. Integration
   checks + responsive browser tests, separate feature commits.
5. **P1 evaluation + final gate**: evaluator/ablation, docs evidence, full checks,
   isolated DB migration/runtime smoke, branch/commit handoff và giới hạn còn lại.

P2 được thiết kế nhưng không đưa vào phạm vi tự triển khai hiện tại. P0/P1 không dùng
fixture preview làm production data. Không seed vào DB người dùng ngoài fixture;
import dữ liệu thật là CLI explicit, reproducible. Không gọi live AI nếu key/provider
không sẵn sàng; test protocol bằng local adapter và báo giới hạn rõ ràng.
