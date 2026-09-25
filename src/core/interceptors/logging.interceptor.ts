import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    this.logger.log(`Incoming Request: ${method} ${url}`);

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        this.logger.log(
          `Completed: ${method} ${url} ${response.statusCode} - ${delay}ms`,
        );
      }),
      catchError((err) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        const delay = Date.now() - now;
        this.logger.error(
          `Error: ${method} ${url} ${status} - ${delay}ms`,
          err.stack,
        );
        throw err;
      }),
    );
  }
}
