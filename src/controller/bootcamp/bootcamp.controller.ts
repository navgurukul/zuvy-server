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
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
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
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';
import { TrackActionInterceptor } from 'src/trackinglog/interceptors/track-action.interceptor';
import { get } from 'http';

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
@UseInterceptors(TrackActionInterceptor)
@ApiBearerAuth('JWT-auth')
export class BootcampController {
  constructor(private bootcampService: BootcampService) {}

  @Get('/all/:orgId')
  //
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
  @ApiQuery({
    name: 'filter',
    required: false,
    type: String,
    description: 'Filter bootcamps by type: All, Public, or Private',
    enum: ['All', 'Public', 'Private'],
  })
  @ApiBearerAuth('JWT-auth')
  async getAllBootcamps(
    @Param('orgId') orgId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('searchTerm') searchTerm: string,
    @Query('filter') filter: string,
    @Req() req,
  ): Promise<object> {
    const searchTermAsNumber = !isNaN(Number(searchTerm))
      ? Number(searchTerm)
      : searchTerm;
    const searchTermAsString = searchTerm
      ? String(searchTerm).trim()
      : undefined;
    const roleName = req.user[0]?.roles;
    const userId = req.user[0]?.id;
    const [err, res] = await this.bootcampService.getAllBootcamps(
      orgId,
      roleName,
      userId,
      limit,
      offset,
      searchTermAsNumber,
      searchTermAsString,
      filter,
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
    @Req() req,
  ): Promise<object> {
    const roleName = req.user[0]?.roles;
    const orgId = req.user[0]?.orgId;
    const [err, res] = await this.bootcampService.getBootcampById(
      id,
      isContent,
      roleName,
      orgId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new bootcamp' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'create_course',
    resourceType: 'Course',
    permissionName: 'Createcourse',
    getResourceName: (result) =>
      result?.bootcamp?.name || result?.data?.name || 'Course',
  })
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
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'edit_course',
    resourceType: 'Course',
    permissionName: 'editcourse',
    getResourceName: (result) => {
      const resourceName =
        result?.bootcampName || result?.data?.name || 'Course';
      return `updated Course type for "${resourceName}"`;
    },
  })
  async updateBootcampSetting(
    @Body() bootcampSetting: PatchBootcampSettingDto,
    @Param('bootcampId') bootcampId: number,
    @Req() req,
  ) {
    const roleName = req.user[0]?.roles;
    const orgId = req.user[0]?.orgId;
    const [err, res] = await this.bootcampService.updateBootcampSetting(
      bootcampId,
      bootcampSetting,
      roleName,
      orgId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('bootcampSetting/:id')
  @ApiOperation({ summary: 'Get the bootcamp setting by id' })
  @ApiBearerAuth('JWT-auth')
  async getBootcampSettingById(
    @Param('id') id: number,
    @Req() req,
  ): Promise<object> {
    const roleName = req.user[0]?.roles;
    const orgId = req.user[0]?.orgId;
    const [err, res] = await this.bootcampService.getBootcampSettingById(
      roleName,
      id,
      orgId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/:id/:orgId')
  @ApiOperation({ summary: 'Update the bootcamp' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'edit_bootcamp',
    resourceType: 'bootcamp',
    permissionName: 'editBootcamp',
    getResourceName: (result) =>
      result?.data?.name || result?.updatedBootcamp?.[0]?.name || 'Bootcamp',
    getBootcampId: (result, params) =>
      result?.data?.id || (params?.id ? Number(params.id) : null),
  })
  async updateBootcamp(
    @Param('id', ParseIntPipe) id: number,
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() editBootcampDto: EditBootcampDto,
  ) {
    const [err, res] = await this.bootcampService.updateBootcamp(
      id,
      orgId,
      editBootcampDto,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete the bootcamp' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'delete_course',
    resourceType: 'course',
    permissionName: 'Deletecourse',
    getResourceName: (result) => result?.bootcampName || 'Bootcamp',
    getBootcampId: () => null,
  })
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
  @ApiBearerAuth('JWT-auth')
  async getBatchByIdBootcamp(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Req() req,
  ): Promise<object> {
    const roleName = req.user[0]?.roles;
    const orgId = req.user[0]?.orgId;
    const userId = req.user[0]?.id;
    const [err, res] = await this.bootcampService.getBatchByIdBootcamp(
      bootcamp_id,
      roleName,
      limit,
      offset,
      orgId,
      userId,
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
    @Req() req,
  ): Promise<object> {
    const roleName = req.user[0]?.roles;
    const userId = req.user[0]?.id;
    const [err, res] = await this.bootcampService.searchBatchByIdBootcamp(
      bootcamp_id,
      searchTerm,
      roleName,
      userId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('updateUserDetails/:userId')
  @ApiOperation({ summary: 'Update user name and mail Id by userId' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'edit_user',
    resourceType: 'user',
    permissionName: 'editUser',
    getResourceName: (result) => {
      return result?.data?.name || result?.data?.email || 'User';
    },
  })
  async updateUserDetails(
    @Param('userId') userId: number,
    @Body() editUserDetailsDto: editUserDetailsDto,
  ): Promise<any> {
    const [err, res] = await this.bootcampService.updateUserDetails(
      userId,
      editUserDetailsDto,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('/:id/:orgId')
  @ApiOperation({ summary: 'Update the bootcamp partially' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'edit_bootcamp',
    resourceType: 'bootcamp',
    permissionName: 'editBootcamp',
    getResourceName: (result) =>
      result?.data?.name || result?.updatedBootcamp?.[0]?.name || 'Bootcamp',
    getBootcampId: (result, params) =>
      result?.data?.id || (params?.id ? Number(params.id) : null),
  })
  async updatePartialBootcamp(
    @Param('id', ParseIntPipe) id: number,
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() patchBootcampDto: PatchBootcampDto,
  ) {
    const [err, res] = await this.bootcampService.updateBootcamp(
      id,
      orgId,
      patchBootcampDto,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/students/:bootcamp_id')
  @ApiOperation({ summary: 'Add the student to the bootcamp' })
  @ApiQuery({
    name: 'batch_id',
    required: false,
    type: Number,
    description: 'batch id',
  })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'enroll_student',
    resourceType: 'bootcamp',
    permissionName: 'createStudent',
    getResourceName: (result) => {
      const enrolled = result?.students_enrolled;
      const bootcampName = result?.bootcampName || '';
      const suffix = bootcampName ? ` in the bootcamp ${bootcampName}` : '';
      if (Array.isArray(enrolled) && enrolled.length === 1) {
        return `${enrolled[0].email || 'student'}${suffix}`;
      }
      if (Array.isArray(enrolled) && enrolled.length > 1) {
        return `${enrolled.length} students${suffix}`;
      }
      return 'student';
    },
  })
  async addStudentToBootcamp(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('batch_id') batch_id: number,
    @Body() studentData: studentDataDto,
    @Req() req,
  ) {
    const roleName = req.user[0]?.roles;
    const orgId = req.user[0]?.orgId;
    const [err, res] = await this.bootcampService.addStudentToBootcamp(
      bootcamp_id,
      batch_id,
      studentData.students,
      roleName,
      orgId,
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
    description: 'Field to order by ( percentage, name, email)',
    enum: ['percentage', 'name', 'email'],
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc'],
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
    @Req() req,
  ) {
    const roleName = req.user[0]?.roles;
    const userId = req.user[0]?.id;
    const orgId = req.user[0]?.orgId;
    const searchTermAsNumber = !isNaN(Number(searchTerm))
      ? BigInt(searchTerm)
      : searchTerm;

    // Validate status param - only allow specific values
    const allowedStatuses = ['active', 'graduate', 'dropout'];
    let statusNormalized: string | undefined = undefined;
    if (
      status !== undefined &&
      status !== null &&
      String(status).trim() !== ''
    ) {
      if (
        typeof status === 'string' &&
        allowedStatuses.includes(status.toLowerCase())
      ) {
        statusNormalized = status.toLowerCase();
      } else {
        throw new BadRequestException({
          status: 'error',
          message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
        });
      }
    }

    const res = await this.bootcampService.getStudentsInABootcamp(
      roleName,
      bootcamp_id,
      batch_id,
      searchTermAsNumber,
      limit,
      offset,
      enrolledDate,
      lastActiveDate,
      statusNormalized,
      attendance,
      orderBy,
      orderDirection,
      userId,
      orgId,
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
  @ApiOperation({
    summary: 'Mark or update student attendance for a specific session',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: 'Student user ID' },
        status: {
          type: 'string',
          enum: ['present', 'absent'],
          description: 'Attendance status',
        },
      },
      required: ['userId', 'status'],
    },
  })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'mark_attendance',
    resourceType: 'bootcamp',
    displayType: 'attendance for session',
    permissionName: 'editStudent',
    getResourceName: (result) => result?.sessionTitle || 'Session',
  })
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

  @Post('/attendance/mark')
  @ApiOperation({ summary: 'Mark attendance for a session (admin)' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'mark_attendance',
    resourceType: 'bootcamp',
    permissionName: 'editStudent',
    getResourceName: (result) =>
      result?.data?.sessionTitle || result?.data?.session || 'Session',
  })
  async markAttendance(
    @Body() attendanceMarkDto: AttendanceMarkDtoArray[],
  ): Promise<any> {
    // Accept an array of AttendanceMarkDto
    const [err, res] =
      await this.bootcampService.markAttendance(attendanceMarkDto);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/process-attendance')
  @ApiOperation({
    summary: 'Process attendance records and update attendance counts',
  })
  @ApiQuery({
    name: 'bootcampId',
    required: true,
    type: Number,
    description: 'ID of the bootcamp to process attendance for',
  })
  @ApiBearerAuth('JWT-auth')
  async processAttendance(
    @Query('bootcampId') bootcampId: number,
  ): Promise<any> {
    if (!bootcampId) {
      throw new BadRequestException('bootcampId is required');
    }

    const [err, res] =
      await this.bootcampService.processAttendanceRecords(bootcampId);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }
}
