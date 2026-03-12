import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TrackinglogService } from '../trackinglog.service';
import {
  TRACK_ACTION_KEY,
  TrackActionMetadata,
} from '../decorators/track-action.decorator';

@Injectable()
export class TrackActionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly trackinglogService: TrackinglogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<TrackActionMetadata>(
      TRACK_ACTION_KEY,
      context.getHandler(),
    );

    // Only track if @TrackAction decorator is present
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(
        (result) => {
          // Fire-and-forget logging - no await, errors caught internally
          Promise.resolve()
            .then(async () => {
              try {
                // Extract metadata values or use empty object
                const metadataValues = metadata || {};
                let {
                  action,
                  resourceType,
                  displayType: staticDisplayType,
                  permissionName,
                  getResourceName,
                  getBootcampId,
                  getTargetUser,
                } = metadataValues as any;

                // Auto-detect resourceType from route path if not provided
                // Example: /bootcamp/123 -> bootcamp, /content/chapter -> chapter
                if (!resourceType) {
                  const path = request.route?.path || request.url;
                  const pathSegments = path
                    .split('/')
                    .filter(
                      (seg) => seg && !seg.includes(':') && isNaN(Number(seg)),
                    );

                  if (pathSegments.length > 0) {
                    // For nested routes like /content/chapter, prefer the last segment (chapter)
                    // For simple routes like /bootcamp, use the first segment
                    let resourceSegment =
                      pathSegments.length > 1
                        ? pathSegments[pathSegments.length - 1]
                        : pathSegments[0];

                    // Handle plural to singular conversion
                    if (resourceSegment.endsWith('s')) {
                      resourceSegment = resourceSegment.slice(0, -1); // bootcamps -> bootcamp, classes -> classe
                      // Special case for "classes" -> "class"
                      if (resourceSegment === 'classe')
                        resourceSegment = 'class';
                    }

                    resourceType = resourceSegment;
                  }
                }

                // Auto-detect action from HTTP method if not provided
                if (!action) {
                  const method = request.method;
                  const httpMethodToAction = {
                    POST: 'create',
                    PUT: 'edit',
                    PATCH: 'edit',
                    DELETE: 'delete',
                    GET: 'view',
                  };

                  const baseAction = httpMethodToAction[method] || 'unknown';

                  // Check for special cases in URL path
                  const path = request.url.toLowerCase();
                  if (path.includes('attendance')) {
                    action = 'mark_attendance';
                  } else if (
                    path.includes('enroll') ||
                    (path.includes('students') && method === 'POST')
                  ) {
                    action = 'enroll_student';
                  } else if (path.includes('unenroll')) {
                    action = 'unenroll_student';
                  } else {
                    // Generate action like "create_bootcamp"
                    action = resourceType
                      ? `${baseAction}_${resourceType}`
                      : baseAction;
                  }
                }

                // Auto-generate permissionName from action if not provided
                // action format: "create_bootcamp" -> permissionName: "createBootcamp"
                if (!permissionName && action && resourceType) {
                  const actionParts = action.split('_');
                  if (actionParts.length >= 2) {
                    const verb = actionParts[0]; // create, edit, delete
                    const resource = actionParts.slice(1).join('_'); // bootcamp, class, etc.

                    // Capitalize first letter of resource: bootcamp -> Bootcamp
                    const capitalizedResource =
                      resource.charAt(0).toUpperCase() + resource.slice(1);
                    permissionName = verb + capitalizedResource; // createBootcamp
                  }
                }

                // Handle array result format [error, data] or [data, null]
                let actualResult;
                if (Array.isArray(result)) {
                  // If first element has status 'error', use that as actualResult
                  if (result[0]?.status === 'error') {
                    actualResult = result[0];
                  } else {
                    // Otherwise use second element (data)
                    actualResult = result[1] || result[0];
                  }
                } else {
                  actualResult = result;
                }

                // we only need orgId / email for audit logging).
                let rawUser = Array.isArray(user) ? user[0] : user;

                if (!rawUser) {
                  try {
                    const authHeader = request.headers?.authorization as string;
                    if (authHeader?.startsWith('Bearer ')) {
                      const token = authHeader.slice(7);
                      const payloadBase64 = token.split('.')[1];
                      if (payloadBase64) {
                        const decoded = JSON.parse(
                          Buffer.from(payloadBase64, 'base64url').toString(
                            'utf8',
                          ),
                        );
                        // JWT payload uses "sub" for userId — mirror the shape that
                        // JwtStrategy.validate() produces so the rest of the code is unchanged.
                        rawUser = {
                          id: decoded.sub,
                          email: decoded.email,
                          orgId: decoded.orgId,
                          orgName: decoded.orgName,
                        };
                      }
                    }
                  } catch {
                    // Unreadable token — rawUser stays null, fields will be null in log
                  }
                }

                const userData = rawUser;

                // Fallback to result.user when request carries no auth (e.g. login endpoint)
                const resultUser = actualResult?.user ?? null;

                const actorUserId = (() => {
                  const raw = userData?.id ?? resultUser?.id;
                  return typeof raw === 'string' ? parseInt(raw) : raw;
                })();

                // Use full email as actor identifier
                let actorName = 'User';
                const emailSource = userData?.email ?? resultUser?.email;
                if (emailSource) {
                  actorName = emailSource;
                }

                const orgId = (() => {
                  const raw = userData?.orgId ?? resultUser?.orgId;
                  return typeof raw === 'string' ? parseInt(raw) : raw;
                })();

                // Extract resource name from result if function provided
                const allParamsFull = {
                  ...request.params,
                  ...request.query,
                  ...request.body,
                  ...(request['trackingData'] || {}),
                };
                const resourceName = getResourceName
                  ? getResourceName(actualResult, allParamsFull)
                  : '';

                // Extract bootcamp ID from result or request params/body/query if function provided
                let bootcampId = null;
                if (getBootcampId) {
                  bootcampId = getBootcampId(actualResult, allParamsFull);
                } else {
                  // Auto-detect bootcampId from URL params (camelCase & snake_case), query, body, or service result
                  bootcampId = request.params?.bootcampId
                    ? parseInt(request.params.bootcampId)
                    : request.params?.bootcamp_id
                      ? parseInt(request.params.bootcamp_id)
                      : request.query?.bootcampId
                        ? parseInt(request.query.bootcampId as string)
                        : request.body?.bootcampId
                          ? parseInt(request.body.bootcampId)
                          : actualResult?.bootcampId
                            ? parseInt(actualResult.bootcampId)
                            : actualResult?.data?.bootcampId
                              ? parseInt(actualResult.data.bootcampId)
                              : actualResult?.batch?.bootcampId
                                ? parseInt(actualResult.batch.bootcampId)
                                : actualResult?.bootcamp?.id
                                  ? parseInt(actualResult.bootcamp.id)
                                  : null;
                }

                // Extract target user info if function provided
                const targetUser = getTargetUser
                  ? getTargetUser(actualResult)
                  : null;

                // ─── Status detection (must happen BEFORE description) ────────────────
                let logStatus = 'success';

                if (
                  actualResult?.status === 'error' ||
                  actualResult?.isSuccess === false ||
                  actualResult?.success === false
                ) {
                  logStatus = 'failed';
                } else if (
                  actualResult?.code >= 400 ||
                  actualResult?.statusCode >= 400
                ) {
                  logStatus = 'failed';
                } else if (actualResult?.syncStatus === 'pending') {
                  logStatus = 'pending';
                } else if (actualResult?.syncStatus === 'sync_failed') {
                  logStatus = 'success'; // Main operation succeeded but sync failed
                }

                // ─── Description ─────────────────────────────────────────────────────
                let description: string;

                if (logStatus === 'failed') {
                  // For failed actions, describe the attempt + reason
                  const errorMsg = actualResult?.message || 'Unknown error';
                  const actionVerb = action.replace(/_/g, ' ');
                  description = `${actorName} attempted to ${actionVerb} but failed: ${errorMsg}`;
                } else {
                  description = this.buildSmartDescription(
                    actorName,
                    action,
                    resourceType,
                    resourceName,
                    targetUser,
                    actualResult,
                    staticDisplayType,
                  );
                }

                const logPayload = {
                  orgId: orgId,
                  bootcampId: bootcampId,
                  batchId: request.body?.batchId
                    ? Number(request.body.batchId)
                    : undefined,
                  actorUserId: actorUserId,
                  action,
                  resourceType,
                  permissionName: permissionName || action,
                  customDescription: description,
                  actorName: actorName,
                  status: logStatus,
                };

                // Fire-and-forget with timeout protection
                const logWithTimeout = async () => {
                  const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Log timeout')), 5000),
                  );
                  const logPromise =
                    this.trackinglogService.logAction(logPayload);

                  try {
                    await Promise.race([logPromise, timeoutPromise]);
                  } catch (_logErr) {
                    // FK violation: bootcamp was deleted before log could be inserted.
                    // Retry with bootcampId: null so the audit log is still recorded.
                    if (bootcampId != null) {
                      try {
                        await Promise.race([
                          this.trackinglogService.logAction({
                            ...logPayload,
                            bootcampId: null,
                          }),
                          new Promise((_, reject) =>
                            setTimeout(
                              () => reject(new Error('Retry timeout')),
                              3000,
                            ),
                          ),
                        ]);
                      } catch {
                        // Final fallback - silent failure
                      }
                    }
                  }
                };

                logWithTimeout().catch((error) => {
                  // Logging errors should never affect the application
                  console.error('[TrackAction] Failed:', error?.message);
                });
              } catch (error) {
                // Don't throw error to avoid breaking the main flow
                console.error(
                  '[INTERCEPTOR] Error in TrackActionInterceptor:',
                  error,
                );
              }
            })
            .catch((err) => {
              // Outer promise catch - ensure logging never breaks the app
              console.error('[TrackAction] Unexpected error:', err?.message);
            });
        },
        (error) => {
          // Fire-and-forget error logging - no await
          Promise.resolve()
            .then(async () => {
              try {
                const metadataValues = metadata || {};
                let { action, resourceType, permissionName } = metadataValues;

                // Auto-detect from route if not provided
                if (!resourceType) {
                  const path = request.url.split('?')[0];
                  const pathSegments = path
                    .split('/')
                    .filter((s) => s && isNaN(Number(s)));
                  let resourceSegment = pathSegments[pathSegments.length - 1];
                  if (resourceSegment) {
                    resourceSegment = resourceSegment.replace(/s$/, '');
                    if (resourceSegment === 'classe') resourceSegment = 'class';
                    resourceType = resourceSegment;
                  }
                }

                if (!action) {
                  const method = request.method;
                  const httpMethodToAction = {
                    POST: 'create',
                    PUT: 'edit',
                    PATCH: 'edit',
                    DELETE: 'delete',
                    GET: 'view',
                  };
                  const baseAction = httpMethodToAction[method] || 'unknown';
                  action = resourceType
                    ? `${baseAction}_${resourceType}`
                    : baseAction;
                }

                // Auto-generate permissionName from action if not provided
                if (!permissionName && action && resourceType) {
                  const actionParts = action.split('_');
                  if (actionParts.length >= 2) {
                    const verb = actionParts[0]; // create, edit, delete
                    const resource = actionParts.slice(1).join('_'); // chapter, bootcamp, etc.

                    // Capitalize first letter of resource: chapter -> Chapter
                    const capitalizedResource =
                      resource.charAt(0).toUpperCase() + resource.slice(1);
                    permissionName = verb + capitalizedResource; // createChapter
                  }
                }

                const userData = Array.isArray(user) ? user[0] : user;
                const actorUserId =
                  typeof userData.id === 'string'
                    ? parseInt(userData.id)
                    : userData.id;

                let actorName = 'User';
                if (userData.email) {
                  actorName = userData.email;
                }

                const orgId =
                  typeof userData.orgId === 'string'
                    ? parseInt(userData.orgId)
                    : userData.orgId;

                // Use getBootcampId from metadata if available (handles snake_case params too)
                let bootcampId: number | null = null;
                if (metadataValues.getBootcampId) {
                  const allErrParams = {
                    ...request.params,
                    ...request.query,
                    ...request.body,
                  };
                  bootcampId = metadataValues.getBootcampId(null, allErrParams);
                }
                // Fallback: auto-detect from both camelCase and snake_case URL params
                if (!bootcampId) {
                  const raw =
                    request.params?.bootcampId || request.params?.bootcamp_id;
                  bootcampId = raw ? parseInt(raw) : null;
                }

                // Create description for failed action
                const errorMessage = error?.message || 'Unknown error';
                const description = `${actorName} attempted to ${action.replace('_', ' ')} but failed: ${errorMessage}`;

                // Log the failed action with timeout protection
                const logWithTimeout = async () => {
                  const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Log timeout')), 5000),
                  );
                  const logPromise = this.trackinglogService.logAction({
                    orgId: orgId,
                    bootcampId: bootcampId,
                    actorUserId: actorUserId,
                    action,
                    resourceType: resourceType || 'unknown',
                    permissionName: permissionName || action,
                    customDescription: description,
                    actorName: actorName,
                    status: 'failed', // Failed status for error cases
                  });

                  await Promise.race([logPromise, timeoutPromise]);
                };

                logWithTimeout().catch(() => {
                  // Silent failure - logging errors should never affect the application
                });
              } catch (logError) {
                // Silently handle logging errors
              }
            })
            .catch(() => {
              // Outer promise catch - ensure logging never breaks the app
            });

          // Note: NOT re-throwing error after async logging
          // The error propagates naturally through RxJS
        },
      ),
    );
  }

  /**
   * Centralized description builder — fully dynamic, zero hardcoded fields.
   */
  private buildSmartDescription(
    actorName: string,
    action: string,
    resourceType: string,
    resourceName: string,
    targetUser: { status?: string; name?: string; email?: string } | null,
    _result: any,
    staticDisplayType?: string,
  ): string {
    const actionVerb = action.split('_')[0].toLowerCase();
    const pastTense = this.toPastTense(actionVerb);

    // ── Base sentence ─────────────────────────────────────────────────────────
    const displayType =
      _result?.descriptionPrefix ?? staticDisplayType ?? resourceType;
    let desc = displayType
      ? `${actorName} ${pastTense} ${displayType}`
      : `${actorName} ${pastTense}`;
    if (resourceName) desc += ` "${resourceName}"`;
    if (_result?.descriptionSuffix) desc += ` ${_result.descriptionSuffix}`;

    // ── Target user — included generically whenever present ───────────────────
    if (targetUser) {
      const who =
        [targetUser.name, targetUser.email ? `(${targetUser.email})` : null]
          .filter(Boolean)
          .join(' ') || 'user';
      const statusPart = targetUser.status
        ? ` → ${targetUser.status.toUpperCase()}`
        : '';
      desc += ` | User: ${who}${statusPart}`;
    }

    return desc;
  }

  private toPastTense(verb: string): string {
    if (!verb) return 'processed';

    // All other verbs are handled purely by the algorithm below.
    const semanticOverrides: Record<string, string> = {
      edit: 'updated',
      login: 'has been logged in',
      logout: 'has been logged out',
    };
    if (semanticOverrides[verb]) return semanticOverrides[verb];

    const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
    const len = verb.length;

    // Rule 1: silent-e ending → add 'd'
    if (verb.endsWith('e')) return verb + 'd';

    // Rule 2: CVC pattern (short stressed syllable) → double final consonant + 'ed'
    if (
      len >= 3 &&
      !vowels.has(verb[len - 1]) &&
      vowels.has(verb[len - 2]) &&
      !vowels.has(verb[len - 3]) &&
      !['x', 'w', 'y'].includes(verb[len - 1])
    ) {
      return verb + verb[len - 1] + 'ed';
    }

    // Rule 3: default
    return verb + 'ed';
  }
}
