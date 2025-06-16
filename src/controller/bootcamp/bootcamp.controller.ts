import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ValidationPipe,
  UsePipes,
  Query,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateBootcampDto,
  EditBootcampDto,
  PatchBootcampDto,
  studentDataDto,
  PatchBootcampSettingDto,
  editUserDetailsDto,
} from './dto/bootcamp.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';

@Controller('bootcamp')
@ApiTags('bootcamp')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BootcampController {
  constructor(private bootcampService: BootcampService) {}

  @Get('/')
  @Roles('admin')
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
  @ApiBearerAuth('JWT-auth')
  async getAllBootcamps(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('searchTerm') searchTerm: string,
  ): Promise<object> {
    const searchTermAsNumber = !isNaN(Number(searchTerm))
      ? Number(searchTerm)
      : searchTerm;
    const [err, res] = await this.bootcampService.getAllBootcamps(
      limit,
      offset,
      searchTermAsNumber,
    );

    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get the bootcamp by id' })
  @ApiQuery({
    name: 'isContent',
    required: false,
    type: Boolean,
    description: 'Optional content flag',
  })
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Create the new bootcamp' })
  @ApiBearerAuth('JWT-auth')
  async create(@Body() bootcampsEntry: CreateBootcampDto) {
    const [err, res] =
      await this.bootcampService.createBootcamp(bootcampsEntry);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/bootcampSetting/:bootcampId')
  @Roles('admin')
  @ApiOperation({ summary: 'Update the bootcamp setting' })
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Get the bootcamp setting by id' })
  @ApiBearerAuth('JWT-auth')
  async getBootcampSettingById(@Param('id') id: number): Promise<object> {
    const [err, res] = await this.bootcampService.getBootcampSettingById(id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update the bootcamp' })
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Delete the bootcamp' })
  @ApiBearerAuth('JWT-auth')
  async deleteBootcamp(@Param('id') id: number): Promise<object> {
    const [err, res] = await this.bootcampService.deleteBootcamp(id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/batches/:bootcamp_id')
  @Roles('admin')
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
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Get the batches by name by bootcamp id' })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search batches by name in bootcamp',
  })
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Update the bootcamp partially' })
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Add the student to the bootcamp' })
  @ApiQuery({
    name: 'batch_id',
    required: false,
    type: Number,
    description: 'batch id',
  })
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
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
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Get the progress of students in a bootcamp' })
  @ApiQuery({
    name: 'bootcamp_id',
    required: false,
    type: Number,
    description: 'bootcamp_id',
  })
  @ApiBearerAuth('JWT-auth')
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

  @Patch('updateUserDetails/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user name and mail Id by userId' })
  @ApiBearerAuth('JWT-auth')
  async updateUserDetails(@Param('userId') userId: number, @Body() editUserDetailsDto: editUserDetailsDto): Promise<any> {
    const [err, res] = await this.bootcampService.updateUserDetails(
      userId,
      editUserDetailsDto,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/process-attendance')
  @ApiOperation({ summary: 'Process attendance records and update attendance counts' })
  @ApiQuery({
    name: 'bootcampId',
    required: true,
    type: Number,
    description: 'ID of the bootcamp to process attendance for',
  })
  @ApiBearerAuth()
  async processAttendance(@Query('bootcampId') bootcampId: number): Promise<any> {
    if (!bootcampId) {
      throw new BadRequestException('bootcampId is required');
    }
    
    const [err, res] = await this.bootcampService.processAttendanceRecords(bootcampId);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }
}
