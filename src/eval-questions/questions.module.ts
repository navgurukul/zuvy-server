import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsCrudService } from './questions.crud.service';
import { RbacModule } from 'src/rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [QuestionsController],
  providers: [QuestionsCrudService],
})
export class QuestionsModule {}
