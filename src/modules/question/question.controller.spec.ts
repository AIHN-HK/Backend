import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { ValidationPipe } from '../../core/pipes/validation.pipe';

describe('question mutation input and audit actor', () => {
  let app: INestApplication;
  const createQuestion = jest.fn(async (data: any) => ({ id: 1, ...data }));
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [QuestionController],
      providers: [{ provide: QuestionService, useValue: { createQuestion } }],
    }).compile();
    app = mod.createNestApplication();
    app.use((req, _res, next) => {
      req.user = { id: 12 };
      next();
    });
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });
  afterAll(() => app.close());
  it('passes the authenticated actor for a valid mutation', async () => {
    const body = { content: 'Question', type: 'R', dimension: 'PERSONA' };
    await request(app.getHttpServer()).post('/question').send(body).expect(201);
    expect(createQuestion).toHaveBeenCalledWith(body, 12);
  });
  it('rejects attempts to supply the audit actor in the body', async () => {
    createQuestion.mockClear();
    await request(app.getHttpServer())
      .post('/question')
      .send({
        content: 'Question',
        type: 'R',
        dimension: 'PERSONA',
        actorId: 99,
      })
      .expect(400);
    expect(createQuestion).not.toHaveBeenCalled();
  });
});
