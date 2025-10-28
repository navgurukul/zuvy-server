import { Injectable } from '@nestjs/common';
import { CreateMcqgeneratorDto } from './dto/create-mcqgenerator.dto';
import { UpdateMcqgeneratorDto } from './dto/update-mcqgenerator.dto';

@Injectable()
export class McqgeneratorService {
  create(createMcqgeneratorDto: CreateMcqgeneratorDto) {
    return 'This action adds a new mcqgenerator';
  }

  findAll() {
    return `This action returns all mcqgenerator`;
  }

  async getGeneratedMCQSet(id: number) {
    try {
    } catch (error) {
      throw error;
    }
    // return `This action returns a #${id} mcqgenerator`;
  }

  update(id: number, updateMcqgeneratorDto: UpdateMcqgeneratorDto) {
    return `This action updates a #${id} mcqgenerator`;
  }

  remove(id: number) {
    return `This action removes a #${id} mcqgenerator`;
  }
}
