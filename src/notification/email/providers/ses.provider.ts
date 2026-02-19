import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as AWS from 'aws-sdk';
@Injectable()
export class SesProvider {
  private ses: AWS.SES;
  private readonly logger = new Logger(SesProvider.name);

  constructor() {
    AWS.config.update({
      accessKeyId: process.env.AWS_SUPPORT_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SUPPORT_ACCESS_SECRET_KEY,
      region: process.env.AWS_REGION,
    });

    this.ses = new AWS.SES({ apiVersion: '2010-12-01' });
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any> {
    const info = await this.ses.sendEmail({
      from:
        config?.from ||
        process.env.SUPPORT_EMAIL ||
        '"Zuvy Support" <team@zuvy.org>',
      to,
      subject,
      html: body,
    });

    return info;
  }
}
