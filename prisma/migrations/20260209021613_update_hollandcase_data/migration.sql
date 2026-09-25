-- =========================
-- UPDATE DESCRIPTION FOR HollandCase
-- =========================

UPDATE "HollandCase"
SET "description" = 'Bạn có tư duy logic, cẩn trọng và kiên trì trong việc giải quyết vấn đề. Bạn thường hướng tới các giải pháp tối ưu dựa trên dữ liệu, tính khả thi và hiệu quả lâu dài. Nhờ khả năng thích nghi tốt, bạn có thể phát triển ở nhiều lĩnh vực khác nhau nếu xác định được mục tiêu rõ ràng.'
WHERE "code" = 'ALL_HIGH';

UPDATE "HollandCase"
SET "description" = 'Bạn đang trong giai đoạn khám phá bản thân khi các nhóm năng lực và sở thích chưa thể hiện rõ ràng. Điều này không phải là hạn chế mà là cơ hội để bạn trải nghiệm, thử sức ở nhiều môi trường khác nhau. Thông qua học tập, làm việc và va chạm thực tế, bạn sẽ dần nhận ra thế mạnh cốt lõi và định hướng phù hợp cho bản thân.'
WHERE "code" = 'ALL_LOW';

UPDATE "HollandCase"
SET "description" = 'Bạn có sự kết hợp đặc biệt giữa tư duy kỹ thuật thực tế và mong muốn đóng góp cho con người, xã hội. Một mặt bạn hứng thú với máy móc, công nghệ và cách mọi thứ vận hành; mặt khác bạn cũng quan tâm đến giao tiếp và hỗ trợ người khác. Việc tìm được môi trường dung hòa giữa chuyên môn kỹ thuật và yếu tố con người sẽ giúp bạn phát huy tối đa tiềm năng.'
WHERE "code" = 'OPPOSITE_RS';

UPDATE "HollandCase"
SET "description" = 'Bạn vừa có khả năng phân tích sâu, tư duy logic và làm việc với dữ liệu, vừa có xu hướng lãnh đạo và đưa ra quyết định. Điều này giúp bạn phù hợp với các vai trò đòi hỏi hiểu rõ chuyên môn nhưng vẫn cần điều phối và dẫn dắt người khác. Thách thức của bạn nằm ở việc cân bằng giữa suy nghĩ cẩn trọng và hành động quyết đoán.'
WHERE "code" = 'OPPOSITE_IE';

UPDATE "HollandCase"
SET "description" = 'Bạn sở hữu tư duy sáng tạo, cảm xúc thẩm mỹ tốt nhưng đồng thời cũng có khả năng làm việc theo kế hoạch và quy trình. Sự kết hợp này giúp bạn phù hợp với những công việc sáng tạo có cấu trúc rõ ràng. Khi biết kiểm soát sự tự do sáng tạo trong khuôn khổ hợp lý, bạn có thể tạo ra giá trị bền vững và thực tiễn.'
WHERE "code" = 'OPPOSITE_AC';
