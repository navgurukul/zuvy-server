import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as AWS from 'aws-sdk';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class SesProvider implements EmailProvider {
  private transporter;

  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    const ses = new AWS.SES({ apiVersion: '2010-12-01' });

    this.transporter = nodemailer.createTransport({
      SES: ses,
    });
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any> {
    const info = await this.transporter.sendMail({
      from:
        config?.from ||
        process.env.SES_FROM_EMAIL ||
        '"Zuvy Support" <team@zuvy.org>',
      to,
      subject,
      html: body,
    });

    return info;
  }
}
