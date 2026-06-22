import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TemplateService } from './templates/template.service';
// Basic interface for providers (since we are removing builder, defining here or importing from a shared place)
export interface EmailProvider {
  sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any>;
}

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);

  constructor(
    private moduleRef: ModuleRef,
    private templateService: TemplateService,
  ) {}

  async sendEmail(
    to: string,
    subject: string,
    template: string,
    data: any,
    providerName: string = 'ses',
    config?: any,
  ) {
    let provider: EmailProvider;

    try {
      provider = this.moduleRef.get(providerName, { strict: false });
    } catch (e) {
      throw new Error(
        `Email provider '${providerName}' not found or not supported.`,
      );
    }

    const body = this.templateService.render(template, data);

    try {
      this.logger.log(`Sending email via ${providerName} to ${to}`);
      const result = await provider.sendEmail(to, subject, body, config);
      this.logger.log(`Email sent successfully via ${providerName}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send email via ${providerName}: ${error.message}`,
      );
      throw error;
    }
  }
}
