import { Injectable } from '@nestjs/common';
import { CreateAiAssessmentDto } from './dto/create-ai-assessment.dto';
import { UpdateAiAssessmentDto } from './dto/update-ai-assessment.dto';

@Injectable()
export class AiAssessmentService {
  create(createAiAssessmentDto: CreateAiAssessmentDto) {
    return 'This action adds a new aiAssessment';
  }

  take(createAiAssessmentDto: CreateAiAssessmentDto) {
    return 'This action implements logic to analyse assessment.';
  }

  findAll() {
    return `This action returns all aiAssessment`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aiAssessment`;
  }

  update(id: number, updateAiAssessmentDto: UpdateAiAssessmentDto) {
    return `This action updates a #${id} aiAssessment`;
  }

  remove(id: number) {
    return `This action removes a #${id} aiAssessment`;
  }
}
