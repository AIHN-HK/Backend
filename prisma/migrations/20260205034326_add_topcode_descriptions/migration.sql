-- Add descriptions for RIASEC TopCode

UPDATE "TopCode"
SET "description" = 'Dành cho những người thích hành động, vận động, làm việc với máy móc, thiết bị, công cụ, kỹ thuật hoặc thiên nhiên. Phù hợp với công việc mang tính thực hành, ít lý thuyết, chú trọng kết quả cụ thể.'
WHERE "code" = 'R';

UPDATE "TopCode"
SET "description" = 'Dành cho những người thích quan sát, học hỏi, tìm hiểu, phân tích, nghiên cứu và giải quyết vấn đề. Phù hợp với các công việc cần tư duy logic, phân tích dữ liệu, khoa học hoặc nghiên cứu chuyên sâu.'
WHERE "code" = 'I';

UPDATE "TopCode"
SET "description" = 'Dành cho những người có khả năng sáng tạo, trực giác và biểu đạt cảm xúc, thích cái đẹp, nghệ thuật và sự tự do. Phù hợp với các lĩnh vực thiết kế, nghệ thuật, sáng tác, truyền thông sáng tạo.'
WHERE "code" = 'A';

UPDATE "TopCode"
SET "description" = 'Dành cho những người thích làm việc với con người, giúp đỡ, hỗ trợ, giảng dạy, chăm sóc hoặc truyền đạt thông tin. Phù hợp với các nghề giáo dục, tư vấn, y tế, dịch vụ cộng đồng.'
WHERE "code" = 'S';

UPDATE "TopCode"
SET "description" = 'Dành cho những người thích dẫn dắt, thuyết phục, lãnh đạo và ra quyết định, có tham vọng và mục tiêu rõ ràng. Phù hợp với các vai trò quản lý, kinh doanh, bán hàng, khởi nghiệp.'
WHERE "code" = 'E';

UPDATE "TopCode"
SET "description" = 'Dành cho những người thích làm việc có trật tự, quy trình rõ ràng, xử lý dữ liệu, con số và hồ sơ. Phù hợp với các công việc hành chính, kế toán, tài chính, văn phòng.'
WHERE "code" = 'C';
