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
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          body = { code: 'DATA_CONFLICT', message: 'Dữ liệu đã tồn tại' };
          break;
        case 'P2003':
          status = HttpStatus.CONFLICT;
          body = { code: 'RELATION_CONFLICT', message: 'Vi phạm khoá ngoại' };
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          body = { message: 'Không tìm thấy dữ liệu' };
          break;
        case 'P2034':
          status = HttpStatus.CONFLICT;
          body = {
            code: 'WRITE_CONFLICT',
            message: 'Dữ liệu vừa thay đổi. Hãy tải lại trước khi lưu.',
          };
          break;
        default:
          body = { code: 'DATABASE_UNAVAILABLE', message: 'Database error' };
      }
    }

    // log level theo status
    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          event: 'request.failed',
          method: request.method,
          path: request.path,
          requestId: (request as Request & { requestId?: string }).requestId,
          errorType:
            exception instanceof Error
              ? exception.constructor.name
              : 'UnknownError',
          ...(exception instanceof Prisma.PrismaClientKnownRequestError
            ? { databaseCode: exception.code }
            : {}),
        }),
      );
    } else if (status === 401 || status === 403) {
      this.logger.warn(`${request.method} ${request.path}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      requestId: (request as Request & { requestId?: string }).requestId,
      ...body,
    });
  }
}
