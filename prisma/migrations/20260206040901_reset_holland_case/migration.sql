-- =========================
-- RESET TABLE HollandCase
-- =========================

DROP TABLE IF EXISTS "HollandCase";

CREATE TABLE "HollandCase" (
  "id" SERIAL PRIMARY KEY,
  "condition" TEXT NOT NULL,
  "code" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "personality" JSONB NOT NULL,
  "strengths" JSONB NOT NULL,
  "weaknesses" JSONB NOT NULL,
  "careers" JSONB NOT NULL,
  "description" TEXT
);

-- =========================
-- INSERT / UPDATE MASTER DATA
-- =========================

INSERT INTO "HollandCase"
("condition", "code", "title", "personality", "strengths", "weaknesses", "careers")
VALUES
(
  'ALL_HIGH',
  'ALL_HIGH',
  'NĂNG LỰC TOÀN DIỆN',
  '[
    "Có khả năng phát triển ở nhiều lĩnh vực khác nhau",
    "Dễ thích nghi với môi trường và công việc mới",
    "Linh hoạt trong tư duy và định hướng nghề nghiệp"
  ]'::jsonb,
  '[
    "Có thể đạt kết quả tốt ở nhiều lĩnh vực",
    "Khả năng học hỏi nhanh",
    "Phù hợp với nhiều môi trường làm việc"
  ]'::jsonb,
  '[
    "Dễ phân vân khi lựa chọn ngành nghề",
    "Có thể thiếu định hướng rõ ràng"
  ]'::jsonb,
  '[
    "Có thể phù hợp với nhiều nhóm ngành khác nhau",
    "Nên lựa chọn theo đam mê và môi trường phát triển"
  ]'::jsonb
),
(
  'ALL_LOW',
  'ALL_LOW',
  'CHƯA RÕ ĐỊNH HƯỚNG',
  '[
    "Có đặc điểm ở nhiều nhóm tính cách nhưng chưa nổi bật",
    "Đang trong giai đoạn khám phá bản thân"
  ]'::jsonb,
  '[
    "Có tiềm năng phát triển đa dạng",
    "Dễ thích nghi khi trải nghiệm môi trường mới"
  ]'::jsonb,
  '[
    "Chưa xác định rõ sở thích và năng lực chính",
    "Dễ bị ảnh hưởng bởi môi trường xung quanh"
  ]'::jsonb,
  '[
    "Nên tham gia hoạt động trải nghiệm nghề nghiệp",
    "Thử sức ở nhiều lĩnh vực để tìm ra định hướng phù hợp"
  ]'::jsonb
),
(
  'R_S',
  'OPPOSITE_RS',
  'KỸ THUẬT – XÃ HỘI ĐỐI LẬP',
  '[
    "Yêu thích công nghệ, máy móc",
    "Đồng thời quan tâm đến con người và giao tiếp xã hội"
  ]'::jsonb,
  '[
    "Có thể kết hợp kỹ thuật với kỹ năng làm việc với con người",
    "Phù hợp với công việc vừa chuyên môn vừa hỗ trợ cộng đồng"
  ]'::jsonb,
  '[
    "Có thể mâu thuẫn giữa làm việc độc lập và tương tác xã hội",
    "Khó lựa chọn môi trường làm việc phù hợp"
  ]'::jsonb,
  '[
    "Kỹ sư hỗ trợ kỹ thuật",
    "Giáo viên kỹ thuật",
    "Chuyên viên đào tạo công nghệ"
  ]'::jsonb
),
(
  'I_E',
  'OPPOSITE_IE',
  'NGHIÊN CỨU – QUẢN LÝ ĐỐI LẬP',
  '[
    "Có khả năng phân tích sâu và tư duy logic",
    "Đồng thời có xu hướng lãnh đạo và quản lý"
  ]'::jsonb,
  '[
    "Kết hợp tốt giữa phân tích chuyên môn và dẫn dắt đội nhóm",
    "Có tiềm năng trở thành lãnh đạo chuyên môn"
  ]'::jsonb,
  '[
    "Có thể mâu thuẫn giữa suy nghĩ kỹ lưỡng và hành động nhanh",
    "Dễ bị áp lực khi phải cân bằng hai vai trò"
  ]'::jsonb,
  '[
    "Quản lý dự án kỹ thuật",
    "Product Manager",
    "Trưởng nhóm R&D"
  ]'::jsonb
),
(
  'A_C',
  'OPPOSITE_AC',
  'NGHỆ THUẬT – NGHIỆP VỤ ĐỐI LẬP',
  '[
    "Có tư duy sáng tạo và cảm hứng nghệ thuật",
    "Đồng thời có khả năng làm việc theo quy trình và kế hoạch"
  ]'::jsonb,
  '[
    "Có thể sáng tạo nhưng vẫn giữ được tính hệ thống",
    "Phù hợp với công việc sáng tạo có cấu trúc rõ ràng"
  ]'::jsonb,
  '[
    "Dễ mâu thuẫn giữa tự do sáng tạo và kỷ luật công việc",
    "Có thể gặp khó khăn khi phải chọn phong cách làm việc"
  ]'::jsonb,
  '[
    "UI/UX Designer",
    "Creative Planner",
    "Content Strategist"
  ]'::jsonb
)
ON CONFLICT ("code") DO UPDATE
SET
  "condition"  = EXCLUDED."condition",
  "title"      = EXCLUDED."title",
  "personality"= EXCLUDED."personality",
  "strengths"  = EXCLUDED."strengths",
  "weaknesses" = EXCLUDED."weaknesses",
  "careers"    = EXCLUDED."careers";
