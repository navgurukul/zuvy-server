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
    try {
      const emailParams = {
        Source: 'team@zuvy.org',
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
          },
          Body: {
            Text: {
              Data: body,
            },
          },
        },
      };

      const info = await this.ses.sendEmail(emailParams);

      return info;
    } catch (error) {
      this.logger.error(`Failed to send email via SES: ${error.message}`);
      throw error;
    }
  }
}
