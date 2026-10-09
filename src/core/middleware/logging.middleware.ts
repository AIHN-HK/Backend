import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const time = Date.now();

    console.log({
      method: req.method,
      ip: req.ip,
      url: req.path,
      status: res.statusCode,
      duration: Date.now() - time,
    });

    next();
  }
}
