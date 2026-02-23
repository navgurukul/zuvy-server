import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LearnerService } from './learner.service';
import {
  LearnerInformationResponseDto,
  UpsertLearnerInformationDto,
} from './dto/learner.dto';

@ApiTags('Learner Information')
@Controller('learner-information')
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

  @Get('basic-information')
  @ApiOperation({
    summary:
      'Get learner basic information (returns saved data or prefilled name/email)',
  })
  async getBasicInformation(@Req() req) {
    const user = this.getAuthenticatedUser(req);
    return this.learnerService.getBasicInformation(user.id);
  }

  @Put('basic-information')
  @ApiOperation({ summary: 'Create or update learner basic information' })
  @ApiBody({
    type: UpsertLearnerInformationDto,
  })
  async upsertBasicInformation(
    @Req() req,
    @Body() payload: UpsertLearnerInformationDto,
  ): Promise<{
    status: string;
    message: string;
    data: LearnerInformationResponseDto;
  }> {
    const user = this.getAuthenticatedUser(req);
    return this.learnerService.upsertBasicInformation(
      user.id,
      user.email,
      payload,
    );
  }

  @Post('basic-information')
  @ApiOperation({
    summary: 'Create learner basic information (same payload as PUT)',
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
    return this.learnerService.upsertBasicInformation(
      user.id,
      user.email,
      payload,
    );
  }
}
