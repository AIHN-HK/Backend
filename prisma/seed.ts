import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding RIASEC database...');
  const descriptions = [
    {
      code: 'R',
      description:
        'Dành cho những người thích hành động, vận động, làm việc với máy móc, thiết bị, công cụ, kỹ thuật hoặc thiên nhiên. Phù hợp với công việc mang tính thực hành, ít lý thuyết, chú trọng kết quả cụ thể.',
    },
    {
      code: 'I',
      description:
        'Dành cho những người thích quan sát, học hỏi, tìm hiểu, phân tích, nghiên cứu và giải quyết vấn đề. Phù hợp với các công việc cần tư duy logic, phân tích dữ liệu, khoa học hoặc nghiên cứu chuyên sâu.',
    },
    {
      code: 'A',
      description:
        'Dành cho những người có khả năng sáng tạo, trực giác và biểu đạt cảm xúc, thích cái đẹp, nghệ thuật và sự tự do. Phù hợp với các lĩnh vực thiết kế, nghệ thuật, sáng tác, truyền thông sáng tạo.',
    },
    {
      code: 'S',
      description:
        'Dành cho những người thích làm việc với con người, giúp đỡ, hỗ trợ, giảng dạy, chăm sóc hoặc truyền đạt thông tin. Phù hợp với các nghề giáo dục, tư vấn, y tế, dịch vụ cộng đồng.',
    },
    {
      code: 'E',
      description:
        'Dành cho những người thích dẫn dắt, thuyết phục, lãnh đạo và ra quyết định, có tham vọng và mục tiêu rõ ràng. Phù hợp với các vai trò quản lý, kinh doanh, bán hàng, khởi nghiệp.',
    },
    {
      code: 'C',
      description:
        'Dành cho những người thích làm việc có trật tự, quy trình rõ ràng, xử lý dữ liệu, con số và hồ sơ. Phù hợp với các công việc hành chính, kế toán, tài chính, văn phòng.',
    },
  ];

  // 1. SEED BẢNG TOPCODE (DỮ LIỆU TÍNH CÁCH & NGHỀ NGHIỆP)
  const riasecProfiles = [
    {
      code: 'R',
      title: 'KỸ SƯ',
      personality: [
        'Thích chơi lắp ghép, ghép hình, thích nghịch những đồ dùng trong nhà, tháo lắp các đồ kĩ thuật, điện tử như điện, máy tính…',
        'Thích những môn học thực hành, môn kĩ thuật, không thích học lí thuyết',
        'Thích khám phá, sử dụng máy móc, đồ vật',
        'Thích vận động, làm việc ngoài trời',
        'Thành thật và rất thực tế',
      ],
      strengths: [
        'Có khả năng thực hiện các qui trình kĩ thuật, qui định, làm việc theo những chỉ dẫn cụ thể, rành mạch',
        'Tính kỷ luật cao',
        'Dễ thích nghi công nghệ',
        'Phong cách ổn định',
      ],
      weaknesses: [
        'Áp lực deadline',
        'Ít bộc lộ cảm xúc',
        'Ngại giao tiếp',
        'Cần học cách trình bày',
      ],
      careers: [
        'Kỹ sư CNTT/Phần mềm',
        'Kỹ sư Điện tử',
        'Kỹ sư Cơ khí',
        'Kỹ sư Xây dựng',
        'Kỹ sư AI/Data',
      ],
    },
    {
      code: 'I',
      title: 'NGHIÊN CỨU',
      personality: [
        'Tư duy logic, hay đặt câu hỏi',
        'Cẩn trọng, chú ý chi tiết',
        'Ham học hỏi, tự học cao',
        'Làm việc có hệ thống',
      ],
      strengths: [
        'Phân tích thấu đáo',
        'Hạn chế sai sót',
        'Kiên trì dài hạn',
        'Dựa trên bằng chứng',
      ],
      weaknesses: [
        'Quá chú trọng chi tiết',
        'Ra quyết định chậm',
        'Ít linh hoạt',
        'Trình bày chưa ngắn gọn',
      ],
      careers: [
        'Nghiên cứu viên',
        'Phân tích dữ liệu/Thị trường',
        'Giảng dạy/Học thuật',
        'Phát triển sản phẩm R&D',
        'Kiểm định chất lượng',
      ],
    },
    {
      code: 'A',
      title: 'NGHỆ THUẬT',
      personality: [
        'Sáng tạo, giàu cảm xúc',
        'Nhạy cảm, tinh tế',
        'Cá tính, cái tôi riêng',
        'Linh hoạt, ghét khuôn mẫu',
      ],
      strengths: [
        'Ý tưởng mới mẻ',
        'Thẩm mỹ tốt',
        'Thích nghi phong cách mới',
        'Truyền tải thông điệp qua hình ảnh/âm thanh',
      ],
      weaknesses: [
        'Dễ bị chi phối cảm xúc',
        'Khó theo khuôn khổ',
        'Quản lý thời gian kém',
        'Thiếu thực tế',
      ],
      careers: [
        'Thiết kế đồ họa/UI/UX',
        'Nhiếp ảnh/Quay phim',
        'Copywriter/Biên kịch',
        'Âm nhạc/Diễn xuất',
        'Thời trang/Kiến trúc',
      ],
    },
    {
      code: 'S',
      title: 'XÃ HỘI',
      personality: [
        'Hướng ngoại, thích giao tiếp',
        'Đồng cảm, thấu hiểu',
        'Tư duy phản biện xã hội',
        'Linh hoạt xử lý tình huống',
      ],
      strengths: [
        'Tạo thiện cảm tốt',
        'Làm việc nhóm hiệu quả',
        'Thích nghi nhanh',
        'Nhìn nhận vấn đề đa chiều',
      ],
      weaknesses: [
        'Dễ bị ảnh hưởng cảm xúc',
        'Khó khách quan tuyệt đối',
        'Ra quyết định chậm',
        'Dễ bị stress do hỗ trợ người khác',
      ],
      careers: [
        'Tư vấn tâm lý',
        'Giáo dục/Đào tạo',
        'Nhân sự (HR)',
        'Truyền thông/PR',
        'Chăm sóc khách hàng',
        'Quản lý dự án phi lợi nhuận',
      ],
    },
    {
      code: 'E',
      title: 'LÃNH ĐẠO',
      personality: [
        'Tự tin, quyết đoán',
        'Có tầm nhìn dẫn dắt',
        'Thuyết phục tốt',
        'Dám nghĩ dám làm',
      ],
      strengths: [
        'Dẫn dắt tập thể',
        'Ra quyết định nhanh',
        'Chiến lược dài hạn',
        'Truyền cảm hứng',
      ],
      weaknesses: [
        'Dễ áp đặt ý kiến',
        'Áp lực trách nhiệm lớn',
        'Thiếu kiên nhẫn',
        'Dễ mất cân bằng công việc',
      ],
      careers: [
        'Quản lý/Trưởng nhóm',
        'Giám đốc/Founder',
        'Quản trị dự án/Sản phẩm',
        'Trưởng phòng Kinh doanh/Marketing',
      ],
    },
    {
      code: 'C',
      title: 'NGHIỆP VỤ',
      personality: [
        'Cẩn thận, tỉ mỉ',
        'Tuân thủ quy trình',
        'Thực tế, ổn định',
        'Kiên nhẫn, bền bỉ',
      ],
      strengths: [
        'Chính xác cao',
        'Kỷ luật cao',
        'An toàn và hiệu quả',
        'Trách nhiệm',
      ],
      weaknesses: [
        'Thiếu linh hoạt',
        'Dễ nhàm chán',
        'Thụ động',
        'Ngại thử thách mới',
      ],
      careers: [
        'Kế toán/Kiểm toán',
        'Hành chính văn phòng',
        'Ngân hàng/Bảo hiểm',
        'Thư ký/Trợ lý',
        'Kiểm soát quy trình',
      ],
    },
  ];

  for (const item of riasecProfiles) {
    await prisma.topCode.upsert({
      where: { code: item.code },
      update: {},
      create: item,
    });
  }
  console.log('✅ TopCode table seeded.');

  for (const item of descriptions) {
    await prisma.topCode.update({
      where: { code: item.code },
      data: { description: item.description },
    });
  }
  console.log('✅ TopCode descriptions updated.');

  // 2. SEED BẢNG QUESTION
  const questionCount = await prisma.question.count();
  if (questionCount === 0) {
    await prisma.question.createMany({
      data: [
        { content: 'Yêu thích vận động', type: 'R', dimension: 'PERSONA' },
        { content: 'Thẳng thắn', type: 'R', dimension: 'PERSONA' },
        {
          content: 'Thích làm việc với máy móc, dụng cụ',
          type: 'R',
          dimension: 'PERSONA',
        },
        {
          content: 'Thích sự cụ thể, rõ ràng',
          type: 'R',
          dimension: 'PERSONA',
        },
        { content: 'Khép kín', type: 'R', dimension: 'PERSONA' },
        {
          content: 'Thích làm việc ngoài trời',
          type: 'R',
          dimension: 'PERSONA',
        },

        // ABILITY
        {
          content: 'Sửa chữa các thiết bị điện, ô tô, xe máy, xe đạp',
          type: 'R',
          dimension: 'ABILITY',
        },
        { content: 'Chơi một môn thể thao', type: 'R', dimension: 'ABILITY' },
        {
          content: 'Đọc bản vẽ hoặc bản thiết kế',
          type: 'R',
          dimension: 'ABILITY',
        },
        {
          content: 'Sử dụng, vận hành và bảo trì máy móc, thiết bị',
          type: 'R',
          dimension: 'ABILITY',
        },
        {
          content: 'Sử dụng công cụ để tạo kiểu tóc mới',
          type: 'R',
          dimension: 'ABILITY',
        },
        {
          content: 'Tự may áo, váy hoặc đầm cho mình',
          type: 'R',
          dimension: 'ABILITY',
        },

        // INTEREST
        {
          content: 'Làm vườn hoặc trồng cây xanh, hoa kiểng',
          type: 'R',
          dimension: 'INTEREST',
        },
        {
          content: 'Xây dựng hoặc lắp ráp mô hình',
          type: 'R',
          dimension: 'INTEREST',
        },
        {
          content: 'Vận động tay chân để làm việc',
          type: 'R',
          dimension: 'INTEREST',
        },
        {
          content: 'Tự ráp đồ nội thất như bàn, ghế, tủ',
          type: 'R',
          dimension: 'INTEREST',
        },
        { content: 'Nấu ăn hoặc làm bánh', type: 'R', dimension: 'INTEREST' },
        {
          content: 'Tham dự khóa học kỹ thuật (điện, sửa chữa máy móc)',
          type: 'R',
          dimension: 'INTEREST',
        },

        // ================= I – INVESTIGATIVE =================
        // PERSONA
        { content: 'Hiểu biết rộng', type: 'I', dimension: 'PERSONA' },
        { content: 'Thích làm việc một mình', type: 'I', dimension: 'PERSONA' },
        { content: 'Khả năng phân tích cao', type: 'I', dimension: 'PERSONA' },
        { content: 'Suy nghĩ logic', type: 'I', dimension: 'PERSONA' },
        { content: 'Thích khoa học', type: 'I', dimension: 'PERSONA' },
        {
          content: 'Có khả năng quan sát tốt',
          type: 'I',
          dimension: 'PERSONA',
        },

        // ABILITY
        { content: 'Suy nghĩ trừu tượng', type: 'I', dimension: 'ABILITY' },
        {
          content: 'Giải các bài toán khó và phức tạp',
          type: 'I',
          dimension: 'ABILITY',
        },
        {
          content: 'Tiếp thu nhanh các lý thuyết khoa học',
          type: 'I',
          dimension: 'ABILITY',
        },
        {
          content: 'Giải thích các công thức toán học',
          type: 'I',
          dimension: 'ABILITY',
        },
        { content: 'Phân tích dữ liệu', type: 'I', dimension: 'ABILITY' },
        {
          content: 'Tiến hành các thí nghiệm khoa học',
          type: 'I',
          dimension: 'ABILITY',
        },

        // INTEREST
        { content: 'Đặt câu hỏi', type: 'I', dimension: 'INTEREST' },
        {
          content: 'Tìm hiểu nhiều ý kiến khác nhau về một vấn đề',
          type: 'I',
          dimension: 'INTEREST',
        },
        { content: 'Sử dụng máy vi tính', type: 'I', dimension: 'INTEREST' },
        {
          content: 'Đọc sách hoặc báo chuyên ngành kỹ thuật',
          type: 'I',
          dimension: 'INTEREST',
        },
        {
          content: 'Thiết lập đề tài nghiên cứu và khảo sát',
          type: 'I',
          dimension: 'INTEREST',
        },
        {
          content: 'Tham quan bảo tàng khoa học hoặc phòng thí nghiệm',
          type: 'I',
          dimension: 'INTEREST',
        },

        // ================= A – ARTISTIC =================
        // PERSONA
        { content: 'Rất sáng tạo', type: 'A', dimension: 'PERSONA' },
        { content: 'Giàu trí tưởng tượng', type: 'A', dimension: 'PERSONA' },
        {
          content: 'Thích cải tiến và đổi mới',
          type: 'A',
          dimension: 'PERSONA',
        },
        { content: 'Độc đáo và khác lạ', type: 'A', dimension: 'PERSONA' },
        { content: 'Dễ xúc động', type: 'A', dimension: 'PERSONA' },
        { content: 'Rất nhạy cảm', type: 'A', dimension: 'PERSONA' },

        // ABILITY
        {
          content: 'Phác thảo, vẽ và tô tranh',
          type: 'A',
          dimension: 'ABILITY',
        },
        { content: 'Chơi một nhạc cụ', type: 'A', dimension: 'ABILITY' },
        {
          content: 'Viết truyện, thơ hoặc sáng tác nhạc',
          type: 'A',
          dimension: 'ABILITY',
        },
        {
          content: 'Hát, diễn xuất hoặc nhảy múa',
          type: 'A',
          dimension: 'ABILITY',
        },
        {
          content: 'Thiết kế quần áo hoặc nội thất',
          type: 'A',
          dimension: 'ABILITY',
        },
        {
          content: 'Chụp ảnh với góc nhìn sáng tạo',
          type: 'A',
          dimension: 'ABILITY',
        },

        // INTEREST
        {
          content: 'Tham gia khóa học thiết kế',
          type: 'A',
          dimension: 'INTEREST',
        },
        {
          content: 'Học hát, nhạc, nhảy hoặc diễn xuất',
          type: 'A',
          dimension: 'INTEREST',
        },
        {
          content: 'Làm đồ thủ công và tự làm quà tặng',
          type: 'A',
          dimension: 'INTEREST',
        },
        {
          content: 'Đọc truyện viễn tưởng, kịch hoặc thơ ca',
          type: 'A',
          dimension: 'INTEREST',
        },
        {
          content: 'Thể hiện bản thân một cách sáng tạo',
          type: 'A',
          dimension: 'INTEREST',
        },
        {
          content: 'Xem hòa nhạc, kịch hoặc triển lãm nghệ thuật',
          type: 'A',
          dimension: 'INTEREST',
        },

        // ================= S – SOCIAL =================
        // PERSONA
        {
          content: 'Rất thân thiện và hòa đồng',
          type: 'S',
          dimension: 'PERSONA',
        },
        { content: 'Dễ thấu hiểu người khác', type: 'S', dimension: 'PERSONA' },
        { content: 'Hào phóng', type: 'S', dimension: 'PERSONA' },
        { content: 'Hay giúp đỡ người khác', type: 'S', dimension: 'PERSONA' },
        { content: 'Có tinh thần đồng đội', type: 'S', dimension: 'PERSONA' },
        { content: 'Dễ tha thứ', type: 'S', dimension: 'PERSONA' },

        // ABILITY
        {
          content: 'Chỉ dẫn hoặc dạy người khác',
          type: 'S',
          dimension: 'ABILITY',
        },
        {
          content: 'Điều hành các cuộc thảo luận',
          type: 'S',
          dimension: 'ABILITY',
        },
        {
          content: 'Hòa giải mâu thuẫn hoặc tranh chấp',
          type: 'S',
          dimension: 'ABILITY',
        },
        {
          content: 'Diễn đạt suy nghĩ và cảm xúc rõ ràng',
          type: 'S',
          dimension: 'ABILITY',
        },
        {
          content: 'Hợp tác tốt với người khác',
          type: 'S',
          dimension: 'ABILITY',
        },
        {
          content: 'Chơi môn thể thao có tính đồng đội',
          type: 'S',
          dimension: 'ABILITY',
        },

        // INTEREST
        { content: 'Làm việc nhóm', type: 'S', dimension: 'INTEREST' },
        {
          content: 'Tham gia hoạt động tình nguyện cộng đồng',
          type: 'S',
          dimension: 'INTEREST',
        },
        {
          content: 'Gặp gỡ và làm quen bạn mới',
          type: 'S',
          dimension: 'INTEREST',
        },
        {
          content: 'Lắng nghe và tư vấn cho người khác',
          type: 'S',
          dimension: 'INTEREST',
        },
        {
          content: 'Đóng góp trong các cuộc thảo luận',
          type: 'S',
          dimension: 'INTEREST',
        },
        {
          content: 'Tham gia hội thảo về phát triển cộng đồng',
          type: 'S',
          dimension: 'INTEREST',
        },

        // ================= E – ENTERPRISING =================
        {
          content: 'Tôi là người thích phiêu lưu',
          type: 'E',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi là người quyết đoán',
          type: 'E',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi thuộc dạng nổi tiếng ở trường',
          type: 'E',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi là người có sức thuyết phục',
          type: 'E',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi là người có nhiều hoài bão và tham vọng',
          type: 'E',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi thích giao du và kết bạn',
          type: 'E',
          dimension: 'PERSONA',
        },

        // ABILITY
        {
          content: 'Tôi có thể khởi đầu hoặc đề xuất các dự án mới',
          type: 'E',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể thuyết phục người khác làm việc theo ý của mình',
          type: 'E',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể lãnh đạo một nhóm',
          type: 'E',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể bán hàng hoặc quảng bá ý tưởng',
          type: 'E',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể lập kế hoạch hoặc chiến lược để đạt mục tiêu',
          type: 'E',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể điều hành hoạt động kinh doanh của gia đình',
          type: 'E',
          dimension: 'ABILITY',
        },

        // INTEREST
        {
          content: 'Tôi thích có quyền lực hoặc địa vị quan trọng',
          type: 'E',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích đưa ra quyết định có ảnh hưởng đến người khác',
          type: 'E',
          dimension: 'INTEREST',
        },
        {
          content:
            'Tôi thích giành chiến thắng trong các giải thưởng lãnh đạo hoặc bán hàng',
          type: 'E',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích gặp gỡ những người quan trọng',
          type: 'E',
          dimension: 'INTEREST',
        },
        {
          content:
            'Tôi thích tham gia các khóa học về kinh doanh, marketing hoặc bán hàng',
          type: 'E',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích đọc tạp chí về kinh doanh',
          type: 'E',
          dimension: 'INTEREST',
        },

        // =======================
        // NHÓM C – CONVENTIONAL
        // =======================

        // PERSONA
        {
          content: 'Tôi là người gọn gàng, ngăn nắp',
          type: 'C',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi làm việc theo nguyên tắc, có trình tự và kế hoạch',
          type: 'C',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi là người chính xác',
          type: 'C',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi thích làm việc với dữ liệu, con số và văn bản',
          type: 'C',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi tuân thủ nguyên tắc',
          type: 'C',
          dimension: 'PERSONA',
        },
        {
          content: 'Tôi là người chu đáo và tỉ mỉ',
          type: 'C',
          dimension: 'PERSONA',
        },

        // ABILITY
        {
          content: 'Tôi có thể làm việc tốt trong khuôn khổ hệ thống',
          type: 'C',
          dimension: 'ABILITY',
        },
        {
          content:
            'Tôi có thể giải quyết công việc giấy tờ nhanh chóng và ngăn nắp',
          type: 'C',
          dimension: 'ABILITY',
        },
        {
          content:
            'Tôi có thể thực hiện các công việc đòi hỏi chú ý đến chi tiết',
          type: 'C',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể tổ chức các hoạt động hoặc sự kiện',
          type: 'C',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể gõ nhanh hoặc viết tốc ký',
          type: 'C',
          dimension: 'ABILITY',
        },
        {
          content: 'Tôi có thể lưu trữ dữ liệu và hồ sơ chính xác',
          type: 'C',
          dimension: 'ABILITY',
        },

        // INTEREST
        {
          content: 'Tôi thích sử dụng các thiết bị xử lý dữ liệu',
          type: 'C',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích sưu tầm đồ kỷ niệm',
          type: 'C',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích học và tìm hiểu các thủ tục, quy định và luật lệ',
          type: 'C',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích sắp xếp nhà cửa hoặc nơi làm việc',
          type: 'C',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích chơi trò tìm sự khác biệt giữa hai hình ảnh',
          type: 'C',
          dimension: 'INTEREST',
        },
        {
          content: 'Tôi thích làm việc dựa trên hướng dẫn cụ thể',
          type: 'C',
          dimension: 'INTEREST',
        },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Question table seeded.');
  }
  const data = [
    {
      condition: 'ALL_HIGH',
      code: 'ALL_HIGH',
      title: 'NĂNG LỰC TOÀN DIỆN',
      personality: [
        'Có khả năng phát triển ở nhiều lĩnh vực khác nhau',
        'Dễ thích nghi với môi trường và công việc mới',
        'Linh hoạt trong tư duy và định hướng nghề nghiệp',
      ],
      strengths: [
        'Có thể đạt kết quả tốt ở nhiều lĩnh vực',
        'Khả năng học hỏi nhanh',
        'Phù hợp với nhiều môi trường làm việc',
      ],
      weaknesses: [
        'Dễ phân vân khi lựa chọn ngành nghề',
        'Có thể thiếu định hướng rõ ràng',
      ],
      careers: [
        'Có thể phù hợp với nhiều nhóm ngành khác nhau',
        'Nên lựa chọn theo đam mê và môi trường phát triển',
      ],
    },
    {
      condition: 'ALL_LOW',
      code: 'ALL_LOW',
      title: 'CHƯA RÕ ĐỊNH HƯỚNG',
      personality: [
        'Có đặc điểm ở nhiều nhóm tính cách nhưng chưa nổi bật',
        'Đang trong giai đoạn khám phá bản thân',
      ],
      strengths: [
        'Có tiềm năng phát triển đa dạng',
        'Dễ thích nghi khi trải nghiệm môi trường mới',
      ],
      weaknesses: [
        'Chưa xác định rõ sở thích và năng lực chính',
        'Dễ bị ảnh hưởng bởi môi trường xung quanh',
      ],
      careers: [
        'Nên tham gia hoạt động trải nghiệm nghề nghiệp',
        'Thử sức ở nhiều lĩnh vực để tìm ra định hướng phù hợp',
      ],
    },
    {
      condition: 'R_S',
      code: 'OPPOSITE_RS',
      title: 'KỸ THUẬT – XÃ HỘI ĐỐI LẬP',
      personality: [
        'Yêu thích công nghệ, máy móc',
        'Đồng thời quan tâm đến con người và giao tiếp xã hội',
      ],
      strengths: [
        'Có thể kết hợp kỹ thuật với kỹ năng làm việc với con người',
        'Phù hợp với công việc vừa chuyên môn vừa hỗ trợ cộng đồng',
      ],
      weaknesses: [
        'Có thể mâu thuẫn giữa làm việc độc lập và tương tác xã hội',
        'Khó lựa chọn môi trường làm việc phù hợp',
      ],
      careers: [
        'Kỹ sư hỗ trợ kỹ thuật',
        'Giáo viên kỹ thuật',
        'Chuyên viên đào tạo công nghệ',
      ],
    },
    {
      condition: 'I_E',
      code: 'OPPOSITE_IE',
      title: 'NGHIÊN CỨU – QUẢN LÝ ĐỐI LẬP',
      personality: [
        'Có khả năng phân tích sâu và tư duy logic',
        'Đồng thời có xu hướng lãnh đạo và quản lý',
      ],
      strengths: [
        'Kết hợp tốt giữa phân tích chuyên môn và dẫn dắt đội nhóm',
        'Có tiềm năng trở thành lãnh đạo chuyên môn',
      ],
      weaknesses: [
        'Có thể mâu thuẫn giữa suy nghĩ kỹ lưỡng và hành động nhanh',
        'Dễ bị áp lực khi phải cân bằng hai vai trò',
      ],
      careers: ['Quản lý dự án kỹ thuật', 'Product Manager', 'Trưởng nhóm R&D'],
    },
    {
      condition: 'A_C',
      code: 'OPPOSITE_AC',
      title: 'NGHỆ THUẬT – NGHIỆP VỤ ĐỐI LẬP',
      personality: [
        'Có tư duy sáng tạo và cảm hứng nghệ thuật',
        'Đồng thời có khả năng làm việc theo quy trình và kế hoạch',
      ],
      strengths: [
        'Có thể sáng tạo nhưng vẫn giữ được tính hệ thống',
        'Phù hợp với công việc sáng tạo có cấu trúc rõ ràng',
      ],
      weaknesses: [
        'Dễ mâu thuẫn giữa tự do sáng tạo và kỷ luật công việc',
        'Có thể gặp khó khăn khi phải chọn phong cách làm việc',
      ],
      careers: ['UI/UX Designer', 'Creative Planner', 'Content Strategist'],
    },
  ];

  for (const item of data) {
    await prisma.hollandCase.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }

  // 3. SEED BẢNG PRIORITY
  const priorityCount = await prisma.priority.count();
  if (priorityCount === 0) {
    await prisma.priority.createMany({
      data: [
        { type: 'R', priority: 1 },
        { type: 'I', priority: 2 },
        { type: 'A', priority: 3 },
        { type: 'S', priority: 4 },
        { type: 'E', priority: 5 },
        { type: 'C', priority: 6 },
      ],
    });
    console.log('✅ Priority table seeded.');
  }

  console.log('🚀 All seeds completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
