import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Module, Injectable } from '@nestjs/common';
import { ScheduleModule } from './schedule.module';
import { ScheduleService } from './schedule.service';

/**
 * NOTE ABOUT TESTING LIBRARY AND FRAMEWORK:
 * - This test suite uses Jest with Nest's @nestjs/testing utilities (NestJS default testing approach).
 * - The repository is assumed to be configured with Jest (e.g., ts-jest) as typical in NestJS projects.
 */

/**
 * We mock the imported modules (SubmissionModule, ClassesModule) to avoid pulling in their real
 * dependencies. The ScheduleModule only needs these modules to resolve imports; for our purposes,
 * empty Nest modules suffice.
 *
 * We define minimal placeholder modules with the same exported names, and rely on jest.mock to
 * replace the actual module files with these placeholders.
 */
@Module({})
class MockSubmissionModule {}
@Module({})
class MockClassesModule {}

// Mock the modules by path the ScheduleModule uses to import them.
// These paths must match the import statements inside schedule.module.ts
jest.mock('../controller/submissions/submission.module', () => {
  return {
    __esModule: true,
    SubmissionModule: MockSubmissionModule,
  };
});
jest.mock('../controller/classes/classes.module', () => {
  return {
    __esModule: true,
    ClassesModule: MockClassesModule,
  };
});

/**
 * A consumer service to validate that ScheduleService is exported by ScheduleModule.
 * If ScheduleModule fails to export ScheduleService, the DI container will fail to instantiate
 * this service since it's not provided locally.
 */
@Injectable()
class ConsumerService {
  constructor(public readonly scheduleService: ScheduleService) {}
}

/**
 * A consumer module that imports ScheduleModule and tries to inject ScheduleService into
 * ConsumerService. This setup verifies the `exports: [ScheduleService]` on ScheduleModule.
 */
@Module({
  imports: [ScheduleModule],
  providers: [ConsumerService],
})
class ConsumerModule {}

describe('ScheduleModule', () => {
  it('should compile successfully with mocked imports', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule],
    }).compile();

    // If compilation passes, the module wiring is valid with the mocked dependencies
    expect(moduleRef).toBeDefined();
  });

  it('should provide ScheduleService within its module context', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule],
    }).compile();

    const service = moduleRef.get<ScheduleService>(ScheduleService, { strict: false });
    expect(service).toBeDefined();
  });

  it('should export ScheduleService so that consumer modules can inject it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConsumerModule],
    }).compile();

    const consumer = moduleRef.get<ConsumerService>(ConsumerService);
    expect(consumer).toBeDefined();
    expect(consumer.scheduleService).toBeDefined();
  });

  it('should allow overriding ScheduleService for isolation', async () => {
    const mockScheduleService = { ping: jest.fn().mockReturnValue('ok') };

    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule],
    })
      .overrideProvider(ScheduleService)
      .useValue(mockScheduleService)
      .compile();

    const service = moduleRef.get<ScheduleService>(ScheduleService);
    expect(service).toBe(mockScheduleService);
    // If the concrete ScheduleService has a ping or similar method, ensure the mock is intact
    expect(typeof (service as any).ping).toBe('function');
    expect((service as any).ping()).toBe('ok');
  });

  it('should not throw if ScheduleModule is the only import in TestingModule', async () => {
    // This test ensures basic module sanity with mocked imports already in place.
    await expect(
      Test.createTestingModule({ imports: [ScheduleModule] }).compile()
    ).resolves.not.toThrow();
  });

  describe('Defensive checks around module metadata (sanity)', () => {
    it('should allow compilation even if ConsumerModule is included without providers from ScheduleModule directly', async () => {
      // The ConsumerModule should still compile because ScheduleModule exports ScheduleService.
      await expect(
        Test.createTestingModule({ imports: [ConsumerModule] }).compile()
      ).resolves.not.toThrow();
    });

    it('should fail to resolve ConsumerService if ScheduleService loses its export (simulated)', async () => {
      // Simulate a broken export by creating a "broken" version of the ScheduleModule inline.
      // This test does not modify real code; it validates our expectation about exports.
      @Module({
        imports: [MockSubmissionModule, MockClassesModule],
        providers: [ScheduleService],
        // exports intentionally omitted to simulate bad configuration
        // exports: [ScheduleService],
      })
      class BrokenScheduleModule {}

      @Module({
        imports: [BrokenScheduleModule],
        providers: [ConsumerService],
      })
      class BrokenConsumerModule {}

      const moduleBuilder = Test.createTestingModule({
        imports: [BrokenConsumerModule],
      });

      // Compiles, but trying to resolve ConsumerService will fail due to missing export
      const moduleRef = await moduleBuilder.compile();
      // When DI resolves providers during compile, this could already throw in some Nest versions.
      // To be safe, we explicitly attempt to get the ConsumerService and expect an error.
      expect(() => moduleRef.get(ConsumerService)).toThrow();
    });
  });
});