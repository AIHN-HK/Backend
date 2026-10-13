import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { TestSessionController } from './test-session.controller';
import { TestSessionService } from './test-session.service';
import { ValidationPipe } from '../../core/pipes/validation.pipe';

describe('history HTTP query contract', () => {
  let app: INestApplication;
  const getHistoryUser = jest.fn(async () => ({
    formattedHistory: [],
    pageInfo: { hasNext: false, nextCursor: null },
  }));
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [TestSessionController],
      providers: [
        { provide: TestSessionService, useValue: { getHistoryUser } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req, _res, next) => {
      req.user = { id: 9 };
      next();
    });
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });
  afterAll(() => app.close());
  it('preserves URL and default page size', async () => {
    await request(app.getHttpServer())
      .get('/test-session/history-by-user')
      .expect(200);
    expect(getHistoryUser).toHaveBeenCalledWith(9, 10, undefined, undefined);
  });
  it.each([
    'limit=-1',
    'limit=0',
    'limit=51',
    'limit=Infinity',
    'limit=1.5',
    'cursorCreatedAt=garbage&cursorId=1',
    'cursorId=-1',
  ])('rejects malformed query %s', async (query) => {
    await request(app.getHttpServer())
      .get('/test-session/history-by-user?' + query)
      .expect(400);
  });
});
