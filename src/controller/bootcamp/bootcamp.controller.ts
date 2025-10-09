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
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import {
  CreateBootcampDto,
  EditBootcampDto,
  PatchBootcampDto,
  studentDataDto,
  PatchBootcampSettingDto,
  editUserDetailsDto,
  AttendanceMarkDtoArray,
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
  constructor(private bootcampService: BootcampService) { }

  @Get('/')
  // @Roles('admin')
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
    @Req() req
  ): Promise<object> {
    const searchTermAsNumber = !isNaN(Number(searchTerm))
      ? Number(searchTerm)
      : searchTerm;
    const roleName = req.user[0]?.roles;
    const [err, res] = await this.bootcampService.getAllBootcamps(
      roleName,
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
    @Req() req
  ): Promise<object> {
    const roleName = req.user[0]?.roles;
    const [err, res] = await this.bootcampService.getBootcampById(
      id,
      isContent,
      roleName
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
    @Req() req
  ) {
    const roleName = req.user[0]?.roles;
    const [err, res] = await this.bootcampService.updateBootcampSetting(
      bootcampId,
      bootcampSetting,
      roleName
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
    @Req() req
  ): Promise<object> {
    const roleName = req.user[0]?.roles;
    const [err, res] = await this.bootcampService.getBatchByIdBootcamp(
      bootcamp_id,
      roleName,
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
    @Req() req
  ) {
    const roleName = req.user[0]?.roles;
    const [err, res] = await this.bootcampService.addStudentToBootcamp(
      bootcamp_id,
      batch_id,
      studentData.students,
      roleName
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
  @ApiQuery({
    name: 'enrolledDate',
    required: false,
    type: String,
    description: 'Filter by enrolled date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'lastActiveDate',
    required: false,
    type: String,
    description: 'Filter by last active date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by enrollment status (Active, Dropout, Graduated)',
    enum: ['active', 'graduate', 'dropout'],
  })
  @ApiQuery({
    name: 'attendance',
    required: false,
    type: Number,
    description: 'Filter by attendance number',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: 'Field to order by (submittedDate, percentage, name, email)',
    enum: ['submittedDate', 'percentage', 'name', 'email']
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc']
  })
  @ApiBearerAuth('JWT-auth')
  async getStudentsByBootcamp(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('batch_id') batch_id: number,
    @Query('limit') limit: number,
    @Query('searchTerm') searchTerm: string,
    @Query('offset') offset: number,
    @Query('enrolledDate') enrolledDate: string,
    @Query('lastActiveDate') lastActiveDate: string,
    @Query('status') status: string,
    @Query('attendance') attendance: number,
    @Query('orderBy') orderBy: string,
    @Query('orderDirection') orderDirection: string,
  ) {
    const searchTermAsNumber = !isNaN(Number(searchTerm))
      ? BigInt(searchTerm)
      : searchTerm;

    // Validate status param - only allow specific values
    const allowedStatuses = ['active', 'graduate', 'dropout'];
    let statusNormalized: string | undefined = undefined;
    if (status !== undefined && status !== null && String(status).trim() !== '') {
      if (typeof status === 'string' && allowedStatuses.includes(status.toLowerCase())) {
        statusNormalized = status.toLowerCase();
      } else {
        throw new BadRequestException({ status: 'error', message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
      }
    }

    const res = await this.bootcampService.getStudentsInABootcamp(
      bootcamp_id,
      batch_id,
      searchTermAsNumber,
      limit,
      offset,
      enrolledDate,
      lastActiveDate,
      statusNormalized,
      attendance
      , orderBy, orderDirection
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

  @Post('/:bootcamp_id/attendance/:session_id/mark')
  @ApiOperation({ summary: 'Mark or update student attendance for a specific session' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: 'Student user ID' },
        status: { type: 'string', enum: ['present', 'absent'], description: 'Attendance status' },
      },
      required: ['userId', 'status'],
    },
  })
  @ApiBearerAuth('JWT-auth')
  async markStudentAttendance(
    @Param('bootcamp_id') bootcamp_id: number,
    @Param('session_id') session_id: number,
    @Body() body: { userId: number; status: string },
  ) {
    const res = await this.bootcampService.markStudentAttendance(
      bootcamp_id,
      session_id,
      body.userId,
      body.status,
    );
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

  @Post('/attendance/mark')
  @Roles('admin')
  @ApiOperation({ summary: 'Mark attendance for a session (admin)' })
  @ApiBearerAuth('JWT-auth')
  async markAttendance(@Body() attendanceMarkDto: AttendanceMarkDtoArray[]): Promise<any> {
    // Accept an array of AttendanceMarkDto
    const [err, res] = await this.bootcampService.markAttendance(attendanceMarkDto);
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
  @ApiBearerAuth('JWT-auth')
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
