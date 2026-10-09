import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: any = { message: 'Internal server error' };

    // HttpException (expected)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body = typeof res === 'string' ? { message: res } : res;
    }

    // Prisma errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;

      switch (exception.code) {
        case 'P2002':
          body = { message: 'Dữ liệu đã tồn tại' };
          break;
        case 'P2003':
          body = { message: 'Vi phạm khoá ngoại' };
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          body = { message: 'Không tìm thấy dữ liệu' };
          break;
        default:
          body = { message: 'Database error' };
      }
    }

    // log level theo status
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.path}`,
        'Internal request failure',
      );
    } else if (status === 401 || status === 403) {
      this.logger.warn(`${request.method} ${request.path}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      ...body,
    });
  }
}
