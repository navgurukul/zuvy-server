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

    if (!user) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(
        async (result) => {
          try {
            console.log('[INTERCEPTOR] TrackActionInterceptor called');
            console.log(
              '[INTERCEPTOR] Result:',
              JSON.stringify(result, null, 2),
            );

            // Extract metadata values or use empty object
            const metadataValues = metadata || {};
            let {
              action,
              resourceType,
              permissionName,
              getResourceName,
              getBootcampId,
              getTargetUser,
            } = metadataValues;

            console.log('[INTERCEPTOR] Metadata:', {
              action,
              resourceType,
              permissionName,
            });

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
                  if (resourceSegment === 'classe') resourceSegment = 'class';
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

            // Extract user data - handle both array and object formats
            const userData = Array.isArray(user) ? user[0] : user;

            const actorUserId =
              typeof userData.id === 'string'
                ? parseInt(userData.id)
                : userData.id;

            // Extract name from email (before @) or use full email as fallback
            let actorName = 'User';
            if (userData.email) {
              const emailParts = userData.email.split('@');
              actorName = emailParts[0];
              // Capitalize first letter and replace dots/underscores with spaces
              actorName = actorName
                .replace(/[._]/g, ' ')
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }

            const orgId =
              typeof userData.orgId === 'string'
                ? parseInt(userData.orgId)
                : userData.orgId;

            // Extract resource name from result if function provided
            const resourceName = getResourceName
              ? getResourceName(actualResult)
              : '';

            // Extract bootcamp ID from result or request params if function provided
            let bootcampId = null;
            if (getBootcampId) {
              // Pass both request.params and request.body to the function
              const allParams = { ...request.params, ...request.body };
              bootcampId = getBootcampId(actualResult, allParams);
            } else {
              // Auto-detect bootcampId from URL params or request body
              bootcampId = request.params?.bootcampId
                ? parseInt(request.params.bootcampId)
                : request.body?.bootcampId
                  ? parseInt(request.body.bootcampId)
                  : null;
            }

            // Extract target user info if function provided
            const targetUser = getTargetUser
              ? getTargetUser(actualResult)
              : null;

            // Build description dynamically from action pattern
            // Extract verb from action (create, edit, delete, mark, enroll, etc.)
            const actionParts = action.split('_');
            const verb = actionParts[0]; // create, edit, delete, mark, enroll, etc.

            // Check if custom description function is provided
            let description: string;
            if (metadata.getCustomDescription) {
              // Pass both route params and query params
              const allParams = { ...request.params, ...request.query };
              const customDesc = metadata.getCustomDescription(
                actorName,
                actualResult,
                allParams,
                request.body,
              );
              if (customDesc) {
                description = customDesc;
              }
            }

            // If no custom description, generate default
            if (!description) {
              // Map verbs to past tense and description patterns
              const verbPatterns = {
                create: {
                  past: 'created',
                  pattern: '{actor} created the {resource} "{name}"',
                },
                edit: {
                  past: 'updated',
                  pattern: '{actor} updated the {resource} "{name}"',
                },
                update: {
                  past: 'updated',
                  pattern: '{actor} updated the {resource} "{name}"',
                },
                delete: {
                  past: 'deleted',
                  pattern: '{actor} deleted the {resource} "{name}"',
                },
                view: {
                  past: 'viewed',
                  pattern: '{actor} viewed the {resource} "{name}"',
                },
                mark: {
                  past: 'marked',
                  pattern: '{actor} marked {target} as {status}',
                },
                enroll: {
                  past: 'enrolled',
                  pattern: '{actor} enrolled {target} in {resource} "{name}"',
                },
                unenroll: {
                  past: 'unenrolled',
                  pattern:
                    '{actor} unenrolled {target} from {resource} "{name}"',
                },
                assign: {
                  past: 'assigned',
                  pattern: '{actor} assigned {target} to {resource} "{name}"',
                },
                remove: {
                  past: 'removed',
                  pattern: '{actor} removed {target} from {resource} "{name}"',
                },
                submit: {
                  past: 'submitted',
                  pattern: '{actor} submitted the {resource} "{name}"',
                },
                grade: {
                  past: 'graded',
                  pattern: '{actor} graded the {resource} "{name}"',
                },
                publish: {
                  past: 'published',
                  pattern: '{actor} published the {resource} "{name}"',
                },
                lock: {
                  past: 'locked',
                  pattern: '{actor} locked the {resource} "{name}"',
                },
                unlock: {
                  past: 'unlocked',
                  pattern: '{actor} unlocked the {resource} "{name}"',
                },
                download: {
                  past: 'downloaded',
                  pattern: '{actor} downloaded the {resource} "{name}"',
                },
                upload: {
                  past: 'uploaded',
                  pattern: '{actor} uploaded the {resource} "{name}"',
                },
                approve: {
                  past: 'approved',
                  pattern: '{actor} approved the {resource} "{name}"',
                },
                reject: {
                  past: 'rejected',
                  pattern: '{actor} rejected the {resource} "{name}"',
                },
                archive: {
                  past: 'archived',
                  pattern: '{actor} archived the {resource} "{name}"',
                },
                restore: {
                  past: 'restored',
                  pattern: '{actor} restored the {resource} "{name}"',
                },
                clone: {
                  past: 'cloned',
                  pattern: '{actor} cloned the {resource} "{name}"',
                },
                duplicate: {
                  past: 'duplicated',
                  pattern: '{actor} duplicated the {resource} "{name}"',
                },
                share: {
                  past: 'shared',
                  pattern: '{actor} shared the {resource} "{name}"',
                },
                export: {
                  past: 'exported',
                  pattern: '{actor} exported the {resource} "{name}"',
                },
                import: {
                  past: 'imported',
                  pattern: '{actor} imported the {resource} "{name}"',
                },
              };

              // Get pattern for verb or create default
              const verbConfig = verbPatterns[verb] || {
                past: verb + 'ed',
                pattern: '{actor} {past} the {resource} "{name}"',
              };

              // Build description by replacing placeholders
              description = verbConfig.pattern;

              // Replace placeholders dynamically
              description = description
                .replace('{actor}', actorName)
                .replace('{past}', verbConfig.past)
                .replace('{resource}', resourceType || 'item')
                .replace('"{name}"', resourceName ? `"${resourceName}"` : '')
                .replace(' ""', ''); // Clean up empty quotes

              // Handle target user placeholder
              if (description.includes('{target}')) {
                const targetInfo = targetUser
                  ? `${targetUser.name || targetUser.email || 'user'}${targetUser.email ? ' (' + targetUser.email + ')' : ''}`
                  : 'user';
                description = description.replace('{target}', targetInfo);
              }

              // Handle status placeholder (for attendance)
              if (description.includes('{status}')) {
                const status = targetUser?.status || 'present';
                description = description.replace(
                  '{status}',
                  status.toUpperCase(),
                );
                if (resourceName) {
                  description += ` for session "${resourceName}"`;
                }
              }

              // Handle changes array for updates
              if (
                (verb === 'edit' || verb === 'update') &&
                actualResult?.changes?.length > 0
              ) {
                const changesText = actualResult.changes.join(', ');
                description = `${actorName} updated ${changesText} in ${resourceType}${resourceName ? ' "' + resourceName + '"' : ''}`;
              }

              // Clean up extra spaces
              description = description.replace(/\s+/g, ' ').trim();
            }

            // Determine status based on result
            let logStatus = 'success';

            console.log('[INTERCEPTOR] Checking result status:', {
              status: actualResult?.status,
              isSuccess: actualResult?.isSuccess,
              code: actualResult?.code,
              statusCode: actualResult?.statusCode,
              success: actualResult?.success,
            });

            // Check for error responses
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

            // Log the action
            console.log('[INTERCEPTOR] About to call logAction with:', {
              orgId,
              bootcampId,
              actorUserId,
              action,
              resourceType,
              permissionName: permissionName || action,
              description,
              actorName,
              status: logStatus,
            });

            const logResult = await this.trackinglogService.logAction({
              orgId: orgId,
              bootcampId: bootcampId,
              actorUserId: actorUserId,
              action,
              resourceType,
              permissionName: permissionName || action,
              customDescription: description,
              actorName: actorName,
              status: logStatus,
            });

            console.log('[INTERCEPTOR] logAction result:', logResult);
          } catch (error) {
            // Don't throw error to avoid breaking the main flow
            console.error(
              '[INTERCEPTOR] Error in TrackActionInterceptor:',
              error,
            );
          }
        },
        async (error) => {
          // Handle error case - log as failed
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
              const emailParts = userData.email.split('@');
              actorName = emailParts[0]
                .replace(/[._]/g, ' ')
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }

            const orgId =
              typeof userData.orgId === 'string'
                ? parseInt(userData.orgId)
                : userData.orgId;

            // Auto-detect bootcampId from URL params
            const bootcampId = request.params?.bootcampId
              ? parseInt(request.params.bootcampId)
              : null;

            // Create description for failed action
            const errorMessage = error?.message || 'Unknown error';
            const description = `${actorName} attempted to ${action.replace('_', ' ')} but failed: ${errorMessage}`;

            // Log the failed action
            await this.trackinglogService.logAction({
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
          } catch (logError) {
            // Silently handle logging errors
          }

          // Re-throw the original error
          throw error;
        },
      ),
    );
  }
}
