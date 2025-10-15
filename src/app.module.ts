import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LoggingInterceptor } from './loggerInterceptor/logger';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';
import { ClassesModule } from './controller/classes/classes.module';
import { ContentModule } from './controller/content/content.module';
import { StudentModule } from './controller/student/student.module';
import { TrackingModule } from './controller/progress/tracking.module';
import { CodingPlatformModule } from './controller/codingPlatform/codingPlatform.module';
import { SubmissionModule } from './controller/submissions/submission.module';
import { AdminAssessmentModule } from './controller/adminAssessment/adminAssessment.module';
import { ScheduleModule } from './schedule/schedule.module';
import { InstructorModule } from './controller/instructor/instructor.module';
import { RbacModule } from './rbac/rbac.module';
import { AuthModule } from './auth/auth.module';
import { JwtMiddleware } from './middleware/jwt.middleware';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth/auth.service';
import { UsersModule } from './controller/users/users.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ResourcesModule } from './resources/resources.module';
import { AuditlogModule } from './auditlog/auditlog.module';
import { RolesModule } from './roles/roles.module';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT, JWT_SECRET_KEY } = process.env;
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    NestScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: JWT_SECRET_KEY,
      signOptions: { expiresIn: '24h' },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    AdminAssessmentModule,
    BootcampModule,
    BatchesModule,
    ClassesModule,
    CodingPlatformModule,
    ContentModule,
    StudentModule,
    SubmissionModule,
    TrackingModule,
    InstructorModule,
    ScheduleModule,
    RbacModule,
    UsersModule,
    PermissionsModule,
    ResourcesModule,
    AuditlogModule,
    RolesModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    JwtMiddleware,
    Reflector,
    AuthService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware)
      .forRoutes('*');
  }
}