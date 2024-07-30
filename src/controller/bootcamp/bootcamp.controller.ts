import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException, Req } from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { CreateBootcampDto, EditBootcampDto, PatchBootcampDto, studentDataDto, PatchBootcampSettingDto } from './dto/bootcamp.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from '@nestjs/common';
import { query } from 'express';

// import { EditBootcampDto } from './dto/editBootcamp.dto';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication


@Controller('bootcamp')
@ApiTags('bootcamp')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
// @UseGuards(AuthGuard('cookie'))
export class BootcampController {
  constructor(private bootcampService: BootcampService) { }
  @Get('/')
  @ApiOperation({ summary: 'Get all bootcamps' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of bootcamps per page',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or id in bootcamps',
  })
  @ApiBearerAuth()
  async getAllBootcamps(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('searchTerm') searchTerm: string
  ): Promise<object> {
    const searchTermAsNumber = !isNaN(Number(searchTerm)) ? Number(searchTerm) : searchTerm
    const [err, res] = await this.bootcampService.getAllBootcamps(
      limit,
      offset,
      searchTermAsNumber
    );

    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }


  @Get('/:id')
  @ApiOperation({ summary: 'Get the bootcamp by id' })
  @ApiQuery({
    name: 'isContent',
    required: false,
    type: Boolean,
    description: 'Optional content flag',
  })
  @ApiBearerAuth()
  async getBootcampById(
    @Param('id') id: number,
    @Query('isContent') isContent: boolean = false,
  ): Promise<object> {
    const [err, res] = await this.bootcampService.getBootcampById(
      id,
      isContent,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new bootcamp' })
  @ApiBearerAuth()
  async create(@Body() bootcampsEntry: CreateBootcampDto) {
    const [err, res] =
      await this.bootcampService.createBootcamp(bootcampsEntry);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/bootcampSetting/:bootcampId')
  @ApiOperation({ summary: 'Update the bootcamp setting' })
  @ApiBearerAuth()
  async updateBootcampSetting(
    @Body() bootcampSetting: PatchBootcampSettingDto,
    @Param('bootcampId') bootcampId: number,
  ) {
    const [err, res] = await this.bootcampService.updateBootcampSetting(
      bootcampId,
      bootcampSetting,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('bootcampSetting/:id')
  @ApiOperation({ summary: 'Get the bootcamp setting by id' })
  @ApiBearerAuth()
  async getBootcampSettingById(
    @Param('id') id: number
  ): Promise<object> {
    const [err, res] = await this.bootcampService.getBootcampSettingById(
      id
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Update the bootcamp' })
  @ApiBearerAuth()
  async updateBootcamp(
    @Param('id') id: number,
    @Body() editBootcampDto: EditBootcampDto,
  ) {
    const [err, res] = await this.bootcampService.updateBootcamp(
      id,
      editBootcampDto,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete the bootcamp' })
  @ApiBearerAuth()
  async deleteBootcamp(@Param('id') id: number): Promise<object> {
    const [err, res] = await this.bootcampService.deleteBootcamp(id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/batches/:bootcamp_id')
  @ApiOperation({ summary: 'Get the batches by bootcamp_id' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of bootcamps per page',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiBearerAuth()
  async getBatchByIdBootcamp(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
  ): Promise<object> {
    const [err, res] = await this.bootcampService.getBatchByIdBootcamp(
      bootcamp_id,
      limit,
      offset,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/searchBatch/:bootcamp_id')
  @ApiOperation({ summary: 'Get the batches by name by bootcamp id' })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search batches by name in bootcamp',
  })
  @ApiBearerAuth()
  async searchBatchesByName(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('searchTerm') searchTerm: string,
  ): Promise<object> {
    const [err, res] = await this.bootcampService.searchBatchByIdBootcamp(
      bootcamp_id,
      searchTerm,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Update the bootcamp partially' })
  @ApiBearerAuth()
  async updatePartialBootcamp(
    @Param('id') id: number,
    @Body() patchBootcampDto: PatchBootcampDto,
  ) {
    const [err, res] = await this.bootcampService.updateBootcamp(
      id,
      patchBootcampDto,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }
  @Post('/students/:bootcamp_id')
  @ApiOperation({ summary: 'Add the student to the bootcamp' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'batch_id',
    required: false,
    type: Number,
    description: 'batch id',
  })
  async addStudentToBootcamp(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('batch_id') batch_id: number,
    @Body() studentData: studentDataDto,
  ) {
    const [err, res] = await this.bootcampService.addStudentToBootcamp(
      bootcamp_id,
      batch_id,
      studentData.students,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/students/:bootcamp_id')
  @ApiOperation({ summary: 'Get the students by bootcamp_id' })
  @ApiQuery({
    name: 'batch_id',
    required: false,
    type: Number,
    description: 'batch id',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of students per page',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiBearerAuth()
  async getStudentsByBootcamp(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('batch_id') batch_id: number,
    @Query('limit') limit: number,
    @Query('searchTerm') searchTerm: string,
    @Query('offset') offset: number,
  )  {
    const searchTermAsNumber = !isNaN(Number(searchTerm))
      ? BigInt(searchTerm)
      : searchTerm;
    const res =  await this.bootcampService.getStudentsInABootcamp(
      bootcamp_id,
      batch_id,
      searchTermAsNumber,
      limit,
      offset,
    );
    return res;
  }

  @Get('/:user_id/progress')
  @ApiOperation({ summary: 'Get the progress of students in a bootcamp' })
  @ApiQuery({
    name: 'bootcamp_id',
    required: false,
    type: Number,
    description: 'bootcamp_id',
  })
  @ApiBearerAuth()
  async getStudentProgressByBootcamp(
    @Param('user_id') user_id: number,
    @Query('bootcamp_id') bootcamp_id: number,
  ): Promise<object> {
    const [err, res] = await this.bootcampService.getStudentProgressBy(
      user_id,
      bootcamp_id,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }
}
