/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { LearnerProfileService } from './learner.profile.service';
import {
  SaveCompleteProfileDto,
  ProfileStrengthResponseDto,
} from './dto/learner.dto';
import { ValidationError } from 'class-validator';
import { SkipOrgCheck } from 'src/rbac/decorators/skip-org-check.decorator';

function flattenErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children?.length) {
      messages.push(...flattenErrors(error.children));
    }
  }
  return messages;
}

@ApiTags('Learner Complete Profile')
@SkipOrgCheck()
@Controller('learner-profile')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) => {
      return new BadRequestException(flattenErrors(errors));
    },
  }),
)
@ApiBearerAuth('JWT-auth')
export class LearnerProfileController {
  constructor(private readonly learnerProfileService: LearnerProfileService) {}

  @Post()
  @ApiOperation({
    summary: 'Save learner complete profile data',
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
    summary: 'Get complete learner profile with all data',
  })
  async getCompleteProfile(@Req() req) {
    const userId = req.user[0]?.id;
    return this.learnerProfileService.getCompleteProfile(userId);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update learner profile by user ID',
  })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiBody({ type: SaveCompleteProfileDto })
  async updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: SaveCompleteProfileDto,
  ) {
    return this.learnerProfileService.updateProfile(id, payload);
  }

  @Get('strength')
  @ApiOperation({
    summary: 'Get profile strength and missing fields',
  })
  @ApiOkResponse({ type: ProfileStrengthResponseDto })
  async getProfileStrength(@Req() req) {
    const userId = req.user[0]?.id;
    return this.learnerProfileService.calculateProfileStrengthNew(userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete learner profile by user ID',
  })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  async deleteProfile(@Param('id', ParseIntPipe) id: number) {
    return this.learnerProfileService.deleteProfile(id);
  }
}
