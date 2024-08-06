import { Catch, ExceptionFilter, ArgumentsHost, HttpException, Logger } from '@nestjs/common';

@Catch()
export class ErrorHandler implements ExceptionFilter {
  private readonly logger = new Logger(ErrorHandler.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: (exception instanceof HttpException) ? exception.getResponse() : 'Internal server error',
    };

    this.logger.error(
      `HTTP Status: ${status} Error Message: ${JSON.stringify(errorResponse)}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json(errorResponse);
  }
}

class ErrorResponse {
  message: string;
  code: number;
  isSuccess: boolean;
  constructor(message, statusCode, isSuccess) {
      this.message = message;
      this.code = statusCode;
      this.isSuccess = isSuccess;
  }
}

export default ErrorResponse;