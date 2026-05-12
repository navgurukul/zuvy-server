import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { RbacModule } from 'src/rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [InstructorController],
  providers: [InstructorService, JwtService],
  exports: [InstructorService],
})
export class InstructorModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
