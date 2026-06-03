import { SetMetadata } from '@nestjs/common';

export const SKIP_ORG_CHECK_KEY = 'skipOrgCheck';

/**
 * Apply this decorator to a controller class or individual route handler to
 * bypass the organisation-membership check in PermissionsGuard.
 *
 * Use it for student-facing endpoints where users do not need to belong to a
 * specific organisation to operate.
 *
 * @example
 * @SkipOrgCheck()
 * @Controller('student')
 * export class StudentController {}
 */
export const SkipOrgCheck = () => SetMetadata(SKIP_ORG_CHECK_KEY, true);
