import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';
import { SchoolsService } from './schools.service';
import { CitiesQueryDto, SchoolsQueryDto } from './dto/schools.dto';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * School list behind the Student ID sign-up dropdowns:
 * state -> city (UDISE district) -> school. Reading is public because
 * sign-up happens before login; only super admins can upload the list.
 */
@ApiTags('Schools')
@Controller('schools')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Public()
  @Get('states')
  @ApiOperation({ summary: 'States that have schools (sign-up dropdown 1)' })
  async states() {
    return this.schoolsService.listStates();
  }

  @Public()
  @Get('cities')
  @ApiOperation({
    summary: 'Cities (UDISE districts) of a state (sign-up dropdown 2)',
  })
  async cities(@Query() query: CitiesQueryDto) {
    return this.schoolsService.listCities(query.state);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Schools of a city with their UDISE codes (sign-up dropdown 3)',
    description:
      'Sorted by name. Use search (one or more words: school name, village, block, UDISE code or pincode) to narrow the list, and limit/offset to page.',
  })
  async schools(@Query() query: SchoolsQueryDto) {
    return this.schoolsService.listSchools(query);
  }

  @Post('admin/upload')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Super admin: add or correct schools (CSV)',
    description:
      "For a few missing or wrong schools; the full UDISE list is loaded once with scripts/import-schools.ts. Columns: udise_code, school_name, state, district (or city); optional block, village, pincode, management, class_from, class_to. The UDISE file's own column names also work. New UDISE codes are added, existing ones updated. Max 25 MB.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.originalname?.toLowerCase().endsWith('.csv')) {
          return cb(new BadRequestException('Upload a .csv file'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(@Req() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A CSV file is required (field "file")');
    }
    return this.schoolsService.importCsv(
      Number(req.user[0].id),
      file.buffer.toString('utf8'),
    );
  }
}
