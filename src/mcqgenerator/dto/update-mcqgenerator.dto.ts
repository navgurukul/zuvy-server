import { PartialType } from '@nestjs/swagger';
import { CreateMcqgeneratorDto } from './create-mcqgenerator.dto';

export class UpdateMcqgeneratorDto extends PartialType(CreateMcqgeneratorDto) {}
