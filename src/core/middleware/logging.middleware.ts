import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const time = Date.now();
    const body = { ...req.body };

    console.log({
      method: req.method,
      ip: req.ip,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - time,
      body: body,
    });

    next();
  }
}
