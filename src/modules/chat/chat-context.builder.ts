import { calculateAge } from '../../core/utils/age';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ChatSession } from '@prisma/client';
import { CareerProgressService } from '../career';
import { ResultService } from '../result';
import { ChatRepository } from './chat.repository';
import { ChatContext, ChatProfile } from './chat.contracts';

@Injectable()
export class ChatContextBuilder {
  constructor(
    @Inject(ChatRepository)
    private readonly repository: Pick<
      ChatRepository,
      'readContextRecords' | 'pendingHistory'
    >,
    private readonly results: ResultService,
    @Optional() private readonly careers?: CareerProgressService,
  ) {}
  async build(
    session: Pick<ChatSession, 'userId' | 'attemptId'>,
  ): Promise<ChatContext> {
    const [result, user] = await this.repository.readContextRecords(session);
    if (!result || !user) throw new Error('Attempt has no result or owner');
    const test_json = await this.results.getResultRanking(
      result.attemptId,
      session.userId,
    );
    const basic_info = {
      full_name: user.fullname,
      age: calculateAge(user.yob),
      address: user.address,
      status: 'STUDENT',
    };
    const profile_json: ChatProfile = {
      form_date: new Date().toISOString().slice(0, 10),
      basic_info,
      self_understanding: {
        hobbies: [],
        strengths: [],
        favorite_subjects: [],
        experience: null,
      },
      career_orientation: {
        has_chosen: null,
        considering_careers: null,
        target_schools: [],
        important_factors: [],
      },
      family_info: {
        father_job: null,
        mother_job: null,
        family_expectations: null,
        has_guidance: null,
        guidance_content: null,
      },
    };

    if (this.careers)
      profile_json.career_context = await this.careers.advisorContext(
        session.userId,
      );
    return { profile_json, test_json };
  }
  async pendingHistory(sessionId: number) {
    const history = await this.repository.pendingHistory(sessionId);
    if (
      history.length > 200 ||
      history.reduce((size, message) => size + message.content.length, 0) >
        100000
    )
      throw new Error(
        'Pending chat history exceeded its limit; start a new session.',
      );
    return history;
  }
}
