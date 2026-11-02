import { skillGaps, ScoringCareer, ScoringProfile } from './scoring';
export interface PlannedTask {
  skillId: string;
  kind: string;
  phase: number;
  title: string;
  position: number;
}
export function planRoadmap(
  career: ScoringCareer,
  profile: ScoringProfile,
  names: Map<string, string>,
): PlannedTask[] {
  const tasks: Omit<PlannedTask, 'position'>[] = [
    {
      skillId: '',
      kind: 'explore',
      phase: 0,
      title: `Đọc mô tả ${career.title}, ghi lại công việc bạn muốn thử và lý do chọn nghề`,
    },
  ];
  for (const gap of skillGaps(career.skills, profile)) {
    const skill = names.get(gap.skillId) ?? gap.skillId;
    if (gap.current === null)
      tasks.push({
        skillId: gap.skillId,
        kind: 'assess',
        phase: 1,
        title: `Tự đánh giá ${skill} (0–5) trong hồ sơ, kèm ví dụ đã thực hiện`,
      });
    else if (gap.gap! > 0)
      tasks.push({
        skillId: gap.skillId,
        kind: 'practice',
        phase: 1,
        title: `Luyện ${skill}: mức tự đánh giá ${gap.current.toFixed(1)} → mức tham khảo ${gap.level.toFixed(1)}; chọn tài liệu và ghi lại một bài thực hành`,
      });
  }
  tasks.push(
    {
      skillId: '',
      kind: 'project',
      phase: 2,
      title:
        'Thực hiện một dự án nhỏ mô phỏng công việc; lưu sản phẩm và mô tả kỹ năng đã dùng',
    },
    {
      skillId: '',
      kind: 'review',
      phase: 3,
      title:
        'Nhờ giáo viên/cố vấn nhận xét sản phẩm; cập nhật skills và cân nhắc lại mục tiêu',
    },
  );
  return tasks.map((t, position) => ({ ...t, position }));
}
