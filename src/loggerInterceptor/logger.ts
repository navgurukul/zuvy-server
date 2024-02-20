import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { log, timeStamp } from 'console';
const chalk = require('chalk');

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() => log(chalk.green(`API call ${new Date()} - ${method} ${url}... ${Date.now() - now}ms`))),      );
  }
}