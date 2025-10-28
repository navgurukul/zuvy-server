import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { McqgeneratorService } from './mcqgenerator.service';
import { CreateMcqgeneratorDto } from './dto/create-mcqgenerator.dto';
import { UpdateMcqgeneratorDto } from './dto/update-mcqgenerator.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('mcqgenerator')
export class McqgeneratorController {
  constructor(private readonly mcqgeneratorService: McqgeneratorService) {}

  // @Post()
  // create(@Body() createMcqgeneratorDto: CreateMcqgeneratorDto) {
  //   return this.mcqgeneratorService.create(createMcqgeneratorDto);
  // }

  // @Get()
  // findAll() {
  //   return this.mcqgeneratorService.findAll();
  // }

  @Get('/getGeneratedMCQById/:id')
  @ApiOperation({ summary: 'Generate MCQs using Python script' })
  @ApiBearerAuth('JWT-auth')
  async getGeneratedMCQ(@Param('id') id: number) {
    return this.mcqgeneratorService.getGeneratedMCQSet(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMcqgeneratorDto: UpdateMcqgeneratorDto,
  ) {
    return this.mcqgeneratorService.update(+id, updateMcqgeneratorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mcqgeneratorService.remove(+id);
  }
}
