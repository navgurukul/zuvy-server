import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException,Req } from '@nestjs/common';
import { CodingPlatformService } from './codingPlatform.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { SubmitCodeDto } from './dto/codingPlatform.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('codingPlatform')
@ApiTags('codingPlatform')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)

export class CodingPlatformController {
    constructor(private codingPlatformService: CodingPlatformService) {}
    @Post('submit')
    @ApiOperation({ summary: 'Run the code' })
    async submitCode(@Body() sourceCode : SubmitCodeDto)
    {
        const res =
      await this.codingPlatformService.submitCode(sourceCode.sourceCode);
    return res;
    }
}