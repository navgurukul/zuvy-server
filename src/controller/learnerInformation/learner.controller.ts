import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LearnerService } from './learner.service';
import {
  LearnerInformationResponseDto,
  UpsertLearnerInformationDto,
} from './dto/learner.dto';

@ApiTags('Learner Information')
@Controller('besic')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@ApiBearerAuth('JWT-auth')
export class LearnerController {
  constructor(private readonly learnerService: LearnerService) {}

  private getAuthenticatedUser(req: any): { id: number; email: string } {
    const user = Array.isArray(req?.user) ? req.user[0] : req?.user;
    const userId = Number(user?.id);
    const userEmail = user?.email;

    if (!userId || Number.isNaN(userId) || !userEmail) {
      throw new UnauthorizedException('User authentication required.');
    }

    return { id: userId, email: userEmail };
  }

  @Get('learner-information/all')
  @ApiOperation({ summary: 'Get all learner basic information records' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllBasicInformation(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Number(limit) || 10;

    return this.learnerService.getAllBasicInformation(parsedPage, parsedLimit);
  }

  @Post('learner-information')
  @ApiOperation({
    summary: 'Create learner basic information',
  })
  @ApiBody({
    type: UpsertLearnerInformationDto,
  })
  async createBasicInformation(
    @Req() req,
    @Body() payload: UpsertLearnerInformationDto,
  ): Promise<{
    status: string;
    message: string;
    data: LearnerInformationResponseDto;
  }> {
    const user = this.getAuthenticatedUser(req);
    return this.learnerService.createBasicInformation(
      user.id,
      user.email,
      payload,
    );
  }
}
