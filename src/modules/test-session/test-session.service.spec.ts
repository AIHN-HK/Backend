import { Test, TestingModule } from '@nestjs/testing';
import { TestSessionService } from './test-session.service';

describe('TestSessionService', () => {
  let service: TestSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestSessionService],
    }).compile();

    service = module.get<TestSessionService>(TestSessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
