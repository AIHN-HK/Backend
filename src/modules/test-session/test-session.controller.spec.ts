import { Test, TestingModule } from '@nestjs/testing';
import { TestSessionController } from './test-session.controller';

describe('TestSessionController', () => {
  let controller: TestSessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestSessionController],
    }).compile();

    controller = module.get<TestSessionController>(TestSessionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
