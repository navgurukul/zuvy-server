import { Module } from '@nestjs/common';
import { NotificationEmailService } from './email/email.service';
import { SesProvider } from './email/providers/ses.provider';
import { TemplateService } from './email/templates/template.service';

@Module({
  providers: [
    NotificationEmailService,
    TemplateService,
    { provide: 'ses', useClass: SesProvider },
  ],
  exports: [NotificationEmailService],
})
export class NotificationModule {}
