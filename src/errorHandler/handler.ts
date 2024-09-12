import { Response } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { STATUS_CODES } from '../helpers/index';

export class ErrorResponse {
  static handle(error: any) {
    throw new Error('Method not implemented.');
  }
  message: string;
  code: number;
  isSuccess: boolean;

  constructor(message: string, code: number) {
    this.message = message || 'Server Error';
    this.code = code || STATUS_CODES.INTERNAL_SERVER_ERROR
    this.isSuccess = false;
  }

  static BadRequestException(message: string, code?: number) {
    Logger.error(`error: ${message}`);
    return new ErrorResponse(message, code || STATUS_CODES.BAD_REQUEST);
  }

  send(res: Response) {
    return res.status(this.code).json(this);
  }
}

export class SuccessResponse {
  message: string;
  code: number;
  isSuccess: boolean;
  data: any;

  constructor(message: string, code: number, data: any) {
    this.message = message || 'Success';
    this.code = code|| STATUS_CODES.OK;
    this.isSuccess = true;
    this.data = data;
  }

  send(res: Response) {
    return res.status(this.code).json(this);
  }
}