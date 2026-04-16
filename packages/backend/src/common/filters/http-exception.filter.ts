import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log stack trace for unexpected errors
    if (status >= 500) {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Build structured error response
    let message: string;
    let errorCode: string | undefined;
    let details: Record<string, unknown> | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp.message as string) ?? 'An error occurred';
      errorCode = resp.errorCode as string | undefined;
      // Pass through additional fields (e.g., fraudScore, checks)
      const { message: _, statusCode: __, errorCode: ___, error: ____, ...rest } = resp;
      if (Object.keys(rest).length > 0) {
        details = rest as Record<string, unknown>;
      }
    } else {
      message = 'Internal server error';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      ...(errorCode && { errorCode }),
      message,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    });
  }
}
