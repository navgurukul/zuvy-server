import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as AWS from 'aws-sdk';
import { SendEmailRequest } from 'aws-sdk/clients/ses';
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

    this.ses = new AWS.SES();
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any> {
    try {
      const emailParams: SendEmailRequest = {
        Source: process.env.SUPPORT_EMAIL,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: body, Charset: 'UTF-8' },
            Text: { Data: body.replace(/<[^>]*>?/gm, ''), Charset: 'UTF-8' },
          },
        },
      };

      const info = await this.ses.sendEmail(emailParams).promise();

      return info;
    } catch (error) {
      this.logger.error(`Failed to send email via SES: ${error.message}`);
      throw error;
    }
  }
}
