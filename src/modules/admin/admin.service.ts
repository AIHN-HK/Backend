import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RedisService } from '../../core/redis/redis.service';
import { AdminPageDto, AdminPrioritiesDto } from './admin.dto';
import { AdminRepository } from './admin.repository';
@Injectable()
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly redis: RedisService,
  ) {}
  overview() {
    return this.repository.overview();
  }
  students(input: AdminPageDto) {
    return this.repository.students({
      page: input.page,
      limit: input.limit,
      q: input.q,
    });
  }
  async student(id: number, input: AdminPageDto) {
    const student = await this.repository.findStudent(id);
    if (!student) throw new NotFoundException('Không tìm thấy học sinh.');
    return {
      student,
      attempts: await this.repository.studentAttempts(id, {
        page: input.page,
        limit: input.limit,
      }),
    };
  }
  async questions() {
    const { items, activeAttempts } = await this.repository.questions();
    return {
      activeAttempts,
      items: items.map(({ _count, ...question }) => ({
        ...question,
        used: _count.answers > 0,
        editable: !_count.answers && !activeAttempts,
      })),
    };
  }
  topcodes() {
    return this.repository.topcodes();
  }
  async priorities({ priorities }: AdminPrioritiesDto, actorId?: number) {
    if (
      new Set(priorities.map((p) => p.type)).size !== 6 ||
      new Set(priorities.map((p) => p.priority)).size !== 6
    ) {
      throw new BadRequestException(
        'Cần đủ 6 nhóm và thứ tự duy nhất từ 1 đến 6.',
      );
    }
    try {
      const result = await this.repository.reorderPriorities(
        priorities.map(({ type, priority }) => ({ type, priority })),
        actorId,
      );
      await this.redis.del('priority:all').catch(() => undefined);
      return result;
    } catch (error) {
      if (error.code === 'P2034')
        throw new ConflictException(
          'Dữ liệu vừa thay đổi. Hãy tải lại trước khi lưu.',
        );
      throw error;
    }
  }
}
