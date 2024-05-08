import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { log, timeStamp } from 'console';
const chalk = require('chalk');

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('API');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() => this.logger.log(chalk.green(`:- ${method} ${url}... ${Date.now() - now}ms`))),);
  }
}