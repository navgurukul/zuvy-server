import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { AiAssessmentService } from './ai-assessment.service';
import {
  CreateAiAssessmentDto,
  CreateSubmitAssessmentDto,
} from './dto/create-ai-assessment.dto';
import { UpdateAiAssessmentDto } from './dto/update-ai-assessment.dto';

@Controller('ai-assessment')
export class AiAssessmentController {
  constructor(private readonly aiAssessmentService: AiAssessmentService) {}

  @Post()
  create(@Body() createAiAssessmentDto: CreateAiAssessmentDto) {
    return this.aiAssessmentService.create(createAiAssessmentDto);
  }

  @Post('/submit')
  takeAssessment(
    @Body() createAiAssessmentDto: CreateSubmitAssessmentDto,
    @Req() req: Request,
  ) {
    // Extract studentId from request (from auth token or session)
    const studentId = req.user[0]?.id;
    return this.aiAssessmentService.submitLlmAssessment(
      studentId,
      createAiAssessmentDto,
    );
  }

  @Get()
  findAll() {
    return this.aiAssessmentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiAssessmentService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAiAssessmentDto: UpdateAiAssessmentDto,
  ) {
    return this.aiAssessmentService.update(+id, updateAiAssessmentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiAssessmentService.remove(+id);
  }
}
