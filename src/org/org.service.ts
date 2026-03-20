import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { OrgQueryDto } from './dto/org-query.dto';
import { NotificationEmailService } from '../notification/email/email.service';
import { db } from '../db/index';
import {
  zuvyOrganizations,
  users,
  blacklistedTokens,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
  zuvyUserOrganizations,
  zuvyPermissions,
  zuvyPermissionsRoles,
  zuvyBootcamps,
} from '../../drizzle/schema';
import { eq, and, ilike, or, sql, desc, ne } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { UserTokensService } from '../user-tokens/user-tokens.service';
import { ZUVY_LOGO_URL, ZUVY_LOGO_DARK_URL } from '../constants/helper';

@Injectable()
export class OrgService {
  private readonly logger = new Logger(OrgService.name);

  constructor(
    private readonly notificationEmailService: NotificationEmailService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly userTokenService: UserTokensService,
  ) {}

  private generateCode(title: string): string {
    const trimmedTitle = title.trim();
    const words = trimmedTitle.split(/\s+/).filter((word) => word.length > 0);

    if (words.length > 1) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }

    const word = words[0] || '';
    const capitals = word.match(/[A-Z]/g);
    if (capitals && capitals.length > 1) {
      return capitals.join('').toUpperCase().substring(0, 2);
    }
    return word.substring(0, 2).toUpperCase();
  }

  private async createDefaultRoles(tx: any, orgId: number) {
    const defaultRoles = [
      {
        name: 'admin',
        description: 'Organization Admin with full permissions',
      },
      { name: 'ops', description: 'Operations role' },
      { name: 'instructor', description: 'Instructor role' },
    ];

    const createdRoles = await tx
      .insert(zuvyUserRoles)
      .values(
        defaultRoles.map((role) => ({
          ...role,
          orgId,
        })),
      )
      .returning();

    const adminRole = createdRoles.find((r) => r.name === 'admin');

    // Assign all permissions to the admin role
    const allPermissions = await tx.select().from(zuvyPermissions);
    if (allPermissions.length > 0 && adminRole) {
      await tx.insert(zuvyPermissionsRoles).values(
        allPermissions.map((permission) => ({
          permissionId: permission.id,
          roleId: adminRole.id,
          orgId,
        })),
      );
    }

    return createdRoles;
  }

  async assignAdminToUser(
    tx: any,
    email: string,
    name: string,
    orgId: number,
    adminRoleId: number,
  ) {
    let userId: number | bigint;
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const [newUser] = await tx
        .insert(users)
        .values({ email, name })
        .returning();
      userId = newUser.id;
    }

    // Assign Admin Role if not already assigned for this org
    const [existingAssignment] = await tx
      .select()
      .from(zuvyUserRolesAssigned)
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
          eq(zuvyUserRolesAssigned.roleId, adminRoleId),
          eq(zuvyUserRolesAssigned.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!existingAssignment) {
      await tx.insert(zuvyUserRolesAssigned).values({
        userId: userId,
        roleId: adminRoleId,
        organizationId: orgId,
        createdAt: new Date().toISOString(),
      });
    }

    // Link User to Organization
    const [existingLink] = await tx
      .select()
      .from(zuvyUserOrganizations)
      .where(
        and(
          eq(zuvyUserOrganizations.userId, Number(userId)),
          eq(zuvyUserOrganizations.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!existingLink) {
      await tx.insert(zuvyUserOrganizations).values({
        userId: Number(userId),
        organizationId: orgId,
        userEmail: email,
      });
    }

    return userId;
  }

  async createOrg(createOrgDto: CreateOrgDto) {
    try {
      if (
        createOrgDto.isManagedByZuvy &&
        createOrgDto.pocEmail &&
        createOrgDto.zuvyPocEmail &&
        createOrgDto.pocEmail.toLowerCase() ===
          createOrgDto.zuvyPocEmail.toLowerCase()
      ) {
        throw new BadRequestException(
          'POC and Zuvy POC cannot have the same email in a Zuvy managed organization',
        );
      }

      const existingPoc = await db
        .select()
        .from(zuvyOrganizations)
        .where(ilike(zuvyOrganizations.pocEmail, createOrgDto.pocEmail));

      if (existingPoc.length > 0) {
        throw new BadRequestException(
          'An organization with this POC email already exists',
        );
      }

      const existingName = await db
        .select()
        .from(zuvyOrganizations)
        .where(ilike(zuvyOrganizations.title, createOrgDto.title));

      if (existingName.length > 0) {
        throw new BadRequestException(
          'An organization with this name already exists',
        );
      }

      await this.checkRoleConflict(createOrgDto.pocEmail, 'poc');
      if (createOrgDto.zuvyPocEmail) {
        await this.checkRoleConflict(createOrgDto.zuvyPocEmail, 'zuvyPoc');
      }

      const displayName = await this.generateCode(createOrgDto.title);

      const createOrgDtoValues = {
        title: createOrgDto.title,
        displayName: displayName,
        logoUrl: createOrgDto.logoUrl || null,
        pocName: createOrgDto.pocName,
        pocEmail: createOrgDto.pocEmail,
        isManagedByZuvy: createOrgDto.isManagedByZuvy,
        zuvyPocName: createOrgDto.isManagedByZuvy
          ? createOrgDto.zuvyPocName || null
          : null,
        zuvyPocEmail: createOrgDto.isManagedByZuvy
          ? createOrgDto.zuvyPocEmail || null
          : null,
      };

      const result = await db.transaction(async (tx) => {
        // 1. Create Organization
        const [newOrg] = await tx
          .insert(zuvyOrganizations)
          .values(createOrgDtoValues)
          .returning();

        if (!newOrg) {
          throw new InternalServerErrorException(
            'Failed to create organization',
          );
        }

        // 2. Create default roles and assign permissions to admin
        const createdRoles = await this.createDefaultRoles(tx, newOrg.id);
        const adminRoleId = createdRoles.find((r) => r.name === 'admin').id;

        // 3. Process POC (Assign Admin Role)
        await this.assignAdminToUser(
          tx,
          createOrgDto.pocEmail,
          createOrgDto.pocName || 'POC',
          newOrg.id,
          adminRoleId,
        );

        // 4. Process Zuvy POC (Assign Admin Role) if managed
        if (createOrgDto.isManagedByZuvy && createOrgDto.zuvyPocEmail) {
          await this.assignAdminToUser(
            tx,
            createOrgDto.zuvyPocEmail,
            createOrgDto.zuvyPocName || 'Zuvy POC',
            newOrg.id,
            adminRoleId,
          );
        }

        return newOrg;
      });

      // 5. Send Email (After transaction)
      const magicLink = `${process.env.BASE_URL}/admin/organizations/${result.id}/setting`;
      try {
        const subject = `Welcome to Zuvy - Complete ${result.title} Setup`;

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="color-scheme" content="light dark">
            <meta name="supported-color-schemes" content="light dark">
            <style>
              .dark-logo { display: none !important; }
              @media (prefers-color-scheme: dark) {
                .light-logo { display: none !important; }
                .dark-logo { display: inline-block !important; }
                .bg-main { background-color: #111827 !important; }
                .bg-card { background-color: #1f2937 !important; }
                .text-primary { color: #f9fafb !important; }
                .text-secondary { color: #d1d5db !important; }
                .border-divider { border-top-color: #374151 !important; }
              }
            </style>
          </head>
          <body class="bg-main" style="margin:0; padding:0; background-color:#f6f9fc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

            <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
              <tr>
                <td align="center">

                  <table class="bg-card" width="520" cellpadding="0" cellspacing="0"
                    style="background:#ffffff; border-radius:12px; padding:40px; box-shadow:0 4px 20px rgba(0,0,0,0.05);">

                    <!-- Logo / Brand -->
                    <tr>
                      <td align="center" style="padding-bottom:30px;">
                        <img class="light-logo" src="${ZUVY_LOGO_URL}" alt="Zuvy" height="30" />
                        <img class="dark-logo" src="${ZUVY_LOGO_DARK_URL}" alt="Zuvy" height="30" />
                      </td>
                    </tr>

                    <!-- Heading -->
                    <tr>
                      <td style="padding-bottom:20px;">
                        <h1 class="text-primary" style="margin:0; font-size:24px; color:#111827;">
                          Welcome to Zuvy 👋
                        </h1>
                      </td>
                    </tr>

                    <!-- Message -->
                    <tr>
                      <td class="text-secondary" style="color:#4b5563; font-size:16px; line-height:1.6;">
                        <p style="margin:0 0 15px 0;">
                          You have been invited to set up the organization 
                          <strong class="text-primary" style="color:#111827;">${result.title}</strong>.
                        </p>

                        <p style="margin:0 0 25px 0;">
                          Click the button below to complete your profile and organization setup.
                        </p>
                      </td>
                    </tr>

                    <!-- Button -->
                    <tr>
                      <td align="center" style="padding:10px 0 30px 0;">
                        <a href="${magicLink}"
                          style="
                            background-color:#2563eb;
                            color:#ffffff;
                            padding:14px 28px;
                            text-decoration:none;
                            border-radius:8px;
                            font-weight:600;
                            font-size:15px;
                            display:inline-block;
                          ">
                          Complete Setup
                        </a>
                      </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                      <td>
                        <hr class="border-divider" style="border:none; border-top:1px solid #e5e7eb; margin:30px 0;">
                      </td>
                    </tr>

                    <!-- Fallback Link -->
                    <tr>
                      <td class="text-secondary" style="font-size:14px; color:#6b7280;">
                        If the button doesn’t work, copy and paste this link into your browser:
                        <br><br>
                        <span style="word-break:break-all; color:#2563eb;">
                          ${magicLink}
                        </span>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td class="text-secondary" style="padding-top:30px; font-size:13px; color:#9ca3af; text-align:center;">
                        If you did not request this email, you can safely ignore it.
                        <br><br>
                        © ${new Date().getFullYear()} Zuvy. All rights reserved.
                      </td>
                    </tr>

                  </table>

                </td>
              </tr>
            </table>

          </body>
          </html>
          `;

        this.logger.log(
          `Attempting to send welcome email to POC: ${createOrgDto.pocEmail}`,
        );

        await this.notificationEmailService.sendEmail(
          createOrgDto.pocEmail,
          subject,
          html,
          {},
          'ses',
        );

        this.logger.log(
          `✅ Welcome email sent successfully to ${createOrgDto.pocEmail}`,
        );
      } catch (emailError) {
        this.logger.error(
          `❌ Failed to send email to ${createOrgDto.pocEmail}`,
        );
        this.logger.error(`Error message: ${emailError.message}`);

        // Don't throw - org was created successfully, just email failed
      }

      return {
        status: 'success',
        message: 'Organization created successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to create org: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to create org: ${error.message}`,
      );
    }
  }

  async findAll(queryDto: OrgQueryDto) {
    const { page = 1, limit = 10, search, filterType } = queryDto;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (search) {
      const searchLike = `%${search}%`;
      conditions.push(
        or(
          ilike(zuvyOrganizations.title, searchLike),
          ilike(zuvyOrganizations.displayName, searchLike),
        ),
      );
    }

    if (filterType === 'self_manage') {
      conditions.push(eq(zuvyOrganizations.isManagedByZuvy, false));
    } else if (filterType === 'zuvy_manage') {
      conditions.push(eq(zuvyOrganizations.isManagedByZuvy, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orgs = await db
      .select()
      .from(zuvyOrganizations)
      .where(whereClause)
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(zuvyOrganizations.createdAt));

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(zuvyOrganizations)
      .where(whereClause);

    const total = Number(countResult.count);

    return {
      status: 'success',
      message: 'Organizations fetched successfully',
      statusCode: 200,
      data: orgs.map((org) => {
        const { displayName, ...rest } = org;
        return {
          ...rest,
          code: displayName,
        };
      }),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async getOrg(id: number) {
    const [org] = await db
      .select()
      .from(zuvyOrganizations)
      .where(eq(zuvyOrganizations.id, id));
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async getOrgByUserId(userId: number, searchTerm?: string) {
    try {
      const globalRoles = await this.authService.getUserRoles(
        Number(userId),
        null,
      );
      const isSuperAdmin = globalRoles.includes('super_admin');

      let orgs;

      if (isSuperAdmin) {
        let adminWhereClause: any = undefined;

        if (searchTerm) {
          const searchLike = `%${searchTerm}%`;
          adminWhereClause = or(
            ilike(zuvyOrganizations.title, searchLike),
            ilike(zuvyOrganizations.displayName, searchLike),
          );
        }

        orgs = await db
          .select({
            id: zuvyOrganizations.id,
            title: zuvyOrganizations.title,
            code: zuvyOrganizations.displayName,
            logoUrl: zuvyOrganizations.logoUrl,
            isVerified: zuvyOrganizations.isVerified,
            joinedAt: zuvyOrganizations.createdAt,
          })
          .from(zuvyOrganizations)
          .where(adminWhereClause);
      } else {
        let whereClause: any = eq(zuvyUserRolesAssigned.userId, BigInt(userId));

        if (searchTerm) {
          const searchLike = `%${searchTerm}%`;
          whereClause = and(
            whereClause,
            or(
              ilike(zuvyOrganizations.title, searchLike),
              ilike(zuvyOrganizations.displayName, searchLike),
            ),
          );
        }

        orgs = await db
          .select({
            id: zuvyOrganizations.id,
            title: zuvyOrganizations.title,
            code: zuvyOrganizations.displayName,
            logoUrl: zuvyOrganizations.logoUrl,
            isVerified: zuvyOrganizations.isVerified,
            joinedAt: zuvyUserRolesAssigned.createdAt,
          })
          .from(zuvyUserRolesAssigned)
          .innerJoin(
            zuvyOrganizations,
            eq(zuvyUserRolesAssigned.organizationId, zuvyOrganizations.id),
          )
          .where(whereClause);
      }

      return {
        status: 'success',
        message: 'Organizations fetched successfully',
        statusCode: 200,
        data: orgs,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to fetch organizations: ${error.message}`,
      );
    }
  }

  async updateOrgDetails(id: number, updateOrgDto: UpdateOrgDto) {
    try {
      const org = await this.getOrg(id);

      const isManagedByZuvy =
        updateOrgDto.isManagedByZuvy !== undefined
          ? updateOrgDto.isManagedByZuvy
          : org.isManagedByZuvy;
      const pocEmail =
        updateOrgDto.pocEmail !== undefined
          ? updateOrgDto.pocEmail
          : org.pocEmail;
      const zuvyPocEmail =
        updateOrgDto.zuvyPocEmail !== undefined
          ? updateOrgDto.zuvyPocEmail
          : org.zuvyPocEmail;

      if (
        isManagedByZuvy &&
        pocEmail &&
        zuvyPocEmail &&
        pocEmail.toLowerCase() === zuvyPocEmail.toLowerCase()
      ) {
        throw new BadRequestException(
          'POC and Zuvy POC cannot have the same email in a Zuvy managed organization',
        );
      }

      if (updateOrgDto.pocEmail && updateOrgDto.pocEmail !== org.pocEmail) {
        const existingPoc = await db
          .select()
          .from(zuvyOrganizations)
          .where(
            and(
              ilike(zuvyOrganizations.pocEmail, updateOrgDto.pocEmail),
              ne(zuvyOrganizations.id, id),
            ),
          );

        if (existingPoc.length > 0) {
          throw new BadRequestException(
            'An organization with this POC email already exists',
          );
        }
      }

      if (
        updateOrgDto.title &&
        updateOrgDto.title.toLowerCase() !== org.title.toLowerCase()
      ) {
        const existingName = await db
          .select()
          .from(zuvyOrganizations)
          .where(
            and(
              ilike(zuvyOrganizations.title, updateOrgDto.title),
              ne(zuvyOrganizations.id, id),
            ),
          );

        if (existingName.length > 0) {
          throw new BadRequestException(
            'An organization with this name already exists',
          );
        }
      }

      const updateData: any = {
        ...updateOrgDto,
        updatedAt: new Date().toISOString(),
      };

      if (updateOrgDto.title) {
        updateData.displayName = await this.generateCode(updateOrgDto.title);
      }

      if (updateOrgDto.pocEmail) {
        await this.checkRoleConflict(updateOrgDto.pocEmail, 'poc', id);
      }
      if (updateOrgDto.zuvyPocEmail) {
        await this.checkRoleConflict(updateOrgDto.zuvyPocEmail, 'zuvyPoc', id);
      }

      // 1. Check if management type is changing from Zuvy Managed to Self Managed
      if (org.isManagedByZuvy && updateOrgDto.isManagedByZuvy === false) {
        // Clear Zuvy POC fields
        updateData.zuvyPocEmail = null;
        updateData.zuvyPocName = null;

        // Revoke Zuvy POC roles
        await db.transaction(async (tx) => {
          if (org.zuvyPocEmail) {
            const [user] = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, org.zuvyPocEmail))
              .limit(1);

            if (user) {
              await tx
                .delete(zuvyUserRolesAssigned)
                .where(
                  and(
                    eq(zuvyUserRolesAssigned.userId, user.id),
                    eq(zuvyUserRolesAssigned.organizationId, id),
                  ),
                );
              await tx
                .delete(zuvyUserOrganizations)
                .where(
                  and(
                    eq(zuvyUserOrganizations.userId, Number(user.id)),
                    eq(zuvyUserOrganizations.organizationId, id),
                  ),
                );
            }
          }
        });
      }

      // 2. Check if management type is changing from Self Managed to Zuvy Managed
      // Or if Zuvy POC email is being changed/added in a Zuvy Managed org
      const newZuvyPocEmail = updateOrgDto.zuvyPocEmail;
      const isSwitchingToZuvyManaged =
        !org.isManagedByZuvy && updateOrgDto.isManagedByZuvy === true;
      const isUpdatingZuvyPoc =
        org.isManagedByZuvy &&
        newZuvyPocEmail &&
        newZuvyPocEmail !== org.zuvyPocEmail;

      if (isSwitchingToZuvyManaged || isUpdatingZuvyPoc) {
        const emailToAssign = newZuvyPocEmail || org.zuvyPocEmail;
        if (emailToAssign) {
          await db.transaction(async (tx) => {
            const roles = await tx
              .select()
              .from(zuvyUserRoles)
              .where(
                and(
                  eq(zuvyUserRoles.orgId, id),
                  eq(zuvyUserRoles.name, 'admin'),
                ),
              )
              .limit(1);

            if (roles.length > 0) {
              await this.assignAdminToUser(
                tx,
                emailToAssign,
                updateOrgDto.zuvyPocName || org.zuvyPocName || 'Zuvy POC',
                id,
                roles[0].id,
              );
            }
          });
        }
      }
      const [updatedOrg] = await db
        .update(zuvyOrganizations)
        .set(updateData)
        .where(eq(zuvyOrganizations.id, id))
        .returning();

      if (!updatedOrg) throw new NotFoundException('Organization not found');

      return {
        status: 'success',
        message: 'Organization updated successfully',
        data: updatedOrg,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to update org: ${error.message}`,
      );
    }
  }

  async initiateDelete(id: number) {
    const org = await this.getOrg(id);

    // Generate confirmation token (valid for 1 hour)
    const token = this.jwtService.sign(
      { orgId: id, action: 'delete' },
      { expiresIn: '1h' },
    );
    const deleteLink = `${process.env.APP_BASE_URL}/confirm-delete?token=${token}`; // Frontend URL

    // Send to POC
    if (org.pocEmail) {
      await this.sendDeletePermissionEmail(
        org.pocEmail,
        org.displayName,
        deleteLink,
      );
    }
    // Send to Zuvy POC if exists
    if (org.zuvyPocEmail) {
      await this.sendDeletePermissionEmail(
        org.zuvyPocEmail,
        org.displayName,
        deleteLink,
      );
    }

    return {
      status: 'success',
      message: 'Delete confirmation emails sent to POCs',
      data: { orgId: id },
    };
  }

  async confirmDelete(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.action !== 'delete' || !payload.orgId) {
        throw new BadRequestException('Invalid token');
      }

      await this.deleteOrg(payload.orgId);

      return {
        status: 'success',
        message: 'Organization deleted successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new UnauthorizedException('Invalid or expired deletion token');
    }
  }

  async deleteOrg(orgId: number) {
    try {
      const org = await this.getOrg(orgId); // Verify org exists

      // Perform cascading deletes within a transaction to ensure data integrity
      await db.transaction(async (tx) => {
        // 1. Delete associated bootcamps
        await tx
          .delete(zuvyBootcamps)
          .where(eq(zuvyBootcamps.organizationId, orgId));

        // 2. Delete user role assignments within the org
        await tx
          .delete(zuvyUserRolesAssigned)
          .where(eq(zuvyUserRolesAssigned.organizationId, orgId));

        // 3. Delete user organizations (sessions/links)
        await tx
          .delete(zuvyUserOrganizations)
          .where(eq(zuvyUserOrganizations.organizationId, orgId));

        // 4. Delete the roles defined for this org
        // (Note: This might fail if zuvyPermissionsRoles has a foreign key constraint to zuvyUserRoles that isn't cascade.
        // We'll assume the DB cascade handles it or permissions will be orphaned. If there's an issue, we would delete permissions first.)
        await tx
          .delete(zuvyPermissionsRoles)
          .where(eq(zuvyPermissionsRoles.orgId, orgId));
        await tx.delete(zuvyUserRoles).where(eq(zuvyUserRoles.orgId, orgId));

        // 5. Finally, delete the organization itself
        await tx
          .delete(zuvyOrganizations)
          .where(eq(zuvyOrganizations.id, orgId));
      });

      return {
        status: 'success',
        message: 'Organization and associated data deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete org ${orgId}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to delete org: ${error.message}`,
      );
    }
  }

  async completeSetup(id: number, updateData: UpdateOrgDto) {
    const org = await this.getOrg(id);

    if (org.isVerified) {
      throw new BadRequestException(
        'Organization setup is already completed and locked.',
      );
    }

    try {
      const updatedValues = {
        ...updateData,
        isVerified: true,
        updatedAt: new Date().toISOString(),
      };
      const [updatedOrg] = await db
        .update(zuvyOrganizations)
        .set(updatedValues)
        .where(eq(zuvyOrganizations.id, id))
        .returning();

      return {
        status: 'success',
        message: 'Organization setup completed and verified.',
        data: updatedOrg,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to complete setup: ${error.message}`,
      );
    }
  }

  // Backwards compatibility for controller if needed, but we will update controller
  remove(id: number) {
    return this.initiateDelete(id);
  }

  private async checkRoleConflict(
    email: string,
    roleType: 'poc' | 'zuvyPoc',
    excludeOrgId?: number,
  ) {
    if (roleType === 'poc') {
      // Check if this email is already a zuvyPoc in ANY OTHER org
      const existingZuvyPoc = await db
        .select()
        .from(zuvyOrganizations)
        .where(
          and(
            ilike(zuvyOrganizations.zuvyPocEmail, email),
            excludeOrgId ? ne(zuvyOrganizations.id, excludeOrgId) : sql`TRUE`,
          ),
        );
      if (existingZuvyPoc.length > 0) {
        throw new BadRequestException(
          `User ${email} is already a Zuvy Assignee (ZA) in another organization`,
        );
      }
    } else {
      // roleType === 'zuvyPoc'
      // Check if this email is already a poc in ANY OTHER org
      const existingPoc = await db
        .select()
        .from(zuvyOrganizations)
        .where(
          and(
            ilike(zuvyOrganizations.pocEmail, email),
            excludeOrgId ? ne(zuvyOrganizations.id, excludeOrgId) : sql`TRUE`,
          ),
        );
      if (existingPoc.length > 0) {
        throw new BadRequestException(
          `User ${email} is already a Point of Contact (POC) in another organization`,
        );
      }
    }
  }

  private async sendDeletePermissionEmail(
    to: string,
    orgName: string,
    deleteLink: string,
  ) {
    if (!to) return;
    const subject = `Action Required: Confirm Deletion of ${orgName}`;
    const html = `
        <h1>Organization Deletion Request</h1>
        <p>A request has been made to delete the organization <b>${orgName}</b>.</p>
        <p>If you approve this action, please click the link below to confirm the deletion:</p>
        <div style="margin: 20px 0;">
          <a href="${deleteLink}" style="background-color: #ff4d4f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirm Deletion</a>
        </div>
        <p><b>This action cannot be undone.</b></p>
        <p>If you did not request this, please ignore this email and contact support immediately.</p>
      `;

    try {
      await this.notificationEmailService.sendEmail(
        to,
        subject,
        html,
        {},
        'ses',
        { from: '"Zuvy Support" <support@zuvy.org>' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send delete permission email to ${to}: ${error.message}`,
      );
    }
  }

  async switchOrg(
    userId: bigint,
    newOrgId: number,
    accessToken: string,
    refreshToken: string,
  ) {
    return this.authService.generateTokensForSwitch(userId, newOrgId);
  }
}
