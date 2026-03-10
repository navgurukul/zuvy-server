import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LearnerProfileService } from './learner.profile.service';
import { SaveCompleteProfileDto } from './dto/learner.dto';

@ApiTags('Learner Complete Profile')
@Controller('learner-profile')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@ApiBearerAuth('JWT-auth')
export class LearnerProfileController {
  constructor(private readonly learnerProfileService: LearnerProfileService) {}

  @Post()
  @ApiOperation({
    summary:
      'Save learner complete profile — send pageNumber (1-5), each page = 20% profile strength',
  })
  @ApiBody({ type: SaveCompleteProfileDto })
  async saveCompleteProfile(
    @Req() req,
    @Body() payload: SaveCompleteProfileDto,
  ) {
    const userId = req.user[0]?.id;
    return this.learnerProfileService.saveCompleteProfile(userId, payload);
  }

  @Get()
  @ApiOperation({
    summary:
      'Get complete learner profile with all pages data and profile strength',
  })
  async getCompleteProfile(@Req() req) {
    const userId = req.user[0]?.id;
    return this.learnerProfileService.getCompleteProfile(userId);
  }

  @Get('strength')
  @ApiOperation({
    summary: 'Get profile strength percentage and level',
  })
  async getProfileStrength(@Req() req) {
    const userId = req.user[0]?.id;
    return this.learnerProfileService.getProfileStrength(userId);
  }
}
