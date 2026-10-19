import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const started = process.hrtime.bigint();
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    (req as Request & { requestId: string }).requestId = requestId;
    let logged = false;
    const complete = () => {
      if (logged) return;
      logged = true;
      console.log({
        requestId,
        method: req.method,
        url: req.path,
        status: res.statusCode,
        duration: Number(process.hrtime.bigint() - started) / 1e6,
        aborted: !res.writableFinished,
      });
    };
    res.once('finish', complete);
    res.once('close', complete);
    next();
  }
}
