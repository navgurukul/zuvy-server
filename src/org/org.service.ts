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
import { EmailService } from './email.service';
import { db } from '../db/index';
import {
  zuvyOrganizations,
  users,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
  zuvyUserOrganizations,
} from '../../drizzle/schema';
import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class OrgService {
  private readonly logger = new Logger(OrgService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  async create(createOrgDto: CreateOrgDto) {
    try {
      const createOrgDtoValues = {
        title: createOrgDto.title,
        displayName: createOrgDto.displayName,
        logoUrl: createOrgDto.logoUrl,
        pocName: createOrgDto.pocName,
        pocEmail: createOrgDto.pocEmail,
        isManagedByZuvy: createOrgDto.isManagedByZuvy,
        zuvyPocName: createOrgDto.zuvyPocName,
        zuvyPocEmail: createOrgDto.zuvyPocEmail,
      };

      const result = await db.transaction(async (tx) => {
        // 1. Find Admin Role ID
        const adminRole = await tx
          .select()
          .from(zuvyUserRoles)
          .where(eq(zuvyUserRoles.name, 'admin'))
          .limit(1);

        if (!adminRole.length) {
          throw new InternalServerErrorException("Role 'admin' not found");
        }
        const adminRoleId = adminRole[0].id;

        // 2. Create Organization
        const [newOrg] = await tx
          .insert(zuvyOrganizations)
          .values(createOrgDtoValues)
          .returning();

        if (!newOrg) {
          throw new InternalServerErrorException(
            'Failed to create organization',
          );
        }

        // Helper to get or create user and assign role
        const processUser = async (email: string, name: string) => {
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

          // Assign Admin Role if not already assigned
          const [existingRole] = await tx
            .select()
            .from(zuvyUserRolesAssigned)
            .where(
              and(
                eq(zuvyUserRolesAssigned.userId, userId),
                eq(zuvyUserRolesAssigned.roleId, adminRoleId),
              ),
            )
            .limit(1);

          if (!existingRole) {
            await tx.insert(zuvyUserRolesAssigned).values({
              userId: userId,
              roleId: adminRoleId,
            });
          }

          // Link User to Organization
          await tx.insert(zuvyUserOrganizations).values({
            userId: userId,
            organizationId: newOrg.id,
          });
        };

        // 3. Process POC
        await processUser(createOrgDto.pocEmail, createOrgDto.pocName || 'POC');

        // 4. Process Zuvy POC if managed
        if (createOrgDto.isManagedByZuvy && createOrgDto.zuvyPocEmail) {
          await processUser(
            createOrgDto.zuvyPocEmail,
            createOrgDto.zuvyPocName || 'Zuvy POC',
          );
        }

        return newOrg;
      });

      // 5. Send Email (After transaction)
      const magicLink = `https://zuvy.org/setup-org/${result.id}`;
      try {
        await this.emailService.sendOrgCreationEmail(
          createOrgDto.pocEmail,
          createOrgDto.displayName,
          magicLink,
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send email to ${createOrgDto.pocEmail}: ${emailError.message}`,
        );
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
    const { page = 1, limit = 10, search } = queryDto;
    const offset = (page - 1) * limit;

    let whereClause = undefined;
    if (search) {
      const searchLike = `%${search}%`;
      whereClause = or(
        ilike(zuvyOrganizations.title, searchLike),
        ilike(zuvyOrganizations.displayName, searchLike),
        ilike(zuvyOrganizations.pocName, searchLike),
        ilike(zuvyOrganizations.pocEmail, searchLike),
        ilike(zuvyOrganizations.zuvyPocName, searchLike),
        ilike(zuvyOrganizations.zuvyPocEmail, searchLike),
      );
    }

    const orgs = await db
      .select()
      .from(zuvyOrganizations)
      .where(whereClause)
      .limit(limit)
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
      data: orgs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const [org] = await db
      .select()
      .from(zuvyOrganizations)
      .where(eq(zuvyOrganizations.id, id));
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: number, updateOrgDto: UpdateOrgDto) {
    try {
      const updateData = {
        ...updateOrgDto,
        updatedAt: new Date().toISOString(),
      };
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
    const org = await this.findOne(id);

    // Generate confirmation token (valid for 1 hour)
    const token = this.jwtService.sign(
      { orgId: id, action: 'delete' },
      { expiresIn: '1h' },
    );
    const deleteLink = `https://zuvy.org/confirm-delete?token=${token}`; // Frontend URL

    // Send to POC
    if (org.pocEmail) {
      await this.emailService.sendDeletePermissionEmail(
        org.pocEmail,
        org.displayName,
        deleteLink,
      );
    }
    // Send to Zuvy POC if exists
    if (org.zuvyPocEmail) {
      await this.emailService.sendDeletePermissionEmail(
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

      const orgId = payload.orgId;

      // Perform actual delete
      await db.delete(zuvyOrganizations).where(eq(zuvyOrganizations.id, orgId));

      return {
        status: 'success',
        message: 'Organization deleted successfully',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired deletion token');
    }
  }

  async completeSetup(id: number, updateData: UpdateOrgDto) {
    const org = await this.findOne(id);

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
}
