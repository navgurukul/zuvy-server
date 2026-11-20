import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Why a mentorship action was refused. The screens switch on `code`; the
 * `message` is the text to show as is.
 */
export type MentorshipErrorCode =
  | 'SLOT_TOO_SOON'
  | 'GAP_ACTIVE'
  | 'NO_CREDITS'
  | 'TOO_LATE_TO_CHANGE'
  | 'ALREADY_CANCELLED'
  | 'SESSION_ENDED'
  | 'RESCHEDULE_PENDING'
  | 'RESCHEDULE_LIMIT';

const STATUS: Record<MentorshipErrorCode, HttpStatus> = {
  SLOT_TOO_SOON: HttpStatus.BAD_REQUEST,
  // Credits and the gap were 403 before; kept so existing screens behave
  // the same.
  GAP_ACTIVE: HttpStatus.FORBIDDEN,
  NO_CREDITS: HttpStatus.FORBIDDEN,
  TOO_LATE_TO_CHANGE: HttpStatus.BAD_REQUEST,
  ALREADY_CANCELLED: HttpStatus.BAD_REQUEST,
  SESSION_ENDED: HttpStatus.BAD_REQUEST,
  RESCHEDULE_PENDING: HttpStatus.BAD_REQUEST,
  RESCHEDULE_LIMIT: HttpStatus.BAD_REQUEST,
};

/**
 * One shape for every refused mentorship action:
 * `{ statusCode, code, message, data }`. `data` carries what the screen needs
 * to say more (for example the date the gap ends).
 */
export class MentorshipError extends HttpException {
  constructor(
    readonly code: MentorshipErrorCode,
    message: string,
    readonly data: Record<string, unknown> = {},
  ) {
    super({ statusCode: STATUS[code], code, message, data }, STATUS[code]);
  }
}
