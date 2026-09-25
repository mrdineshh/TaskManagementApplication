import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class CreateBugReportDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  page_url?: string;

  @IsOptional()
  @IsString()
  /**
   * Base64-encoded image (JPEG, PNG, WebP, GIF). Images only, optional.
   * Stored as text in DB. No separate upload endpoint needed.
   * Max reasonable size: ~2MB base64 (~1.5MB image).
   */
  screenshot_base64?: string;
}

@ApiTags('bug-reports')
@Controller('bug-reports')
export class BugReportsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit a bug report. Any authenticated user can submit; no special permission required.
   * Reports are stored in the DB for admin review only.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submit(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateBugReportDto) {
    await this.prisma.bugReport.create({
      data: {
        reporterId: user.sub,
        description: dto.description,
        pageUrl: dto.page_url,
        screenshotBase64: dto.screenshot_base64 ?? null,
      },
    });
    return { success: true, message: 'Bug report submitted. Thank you for your feedback!' };
  }

  /**
   * List all bug reports — admin only.
   * Returns reports in reverse chronological order with reporter info.
   */
  @Get()
  @RequirePermission('user.manage')
  async list(@CurrentUser() _user: AccessTokenPayload) {
    const reports = await this.prisma.bugReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
      take: 200,
    });
    return reports.map((r) => ({
      id: r.id,
      description: r.description,
      page_url: r.pageUrl,
      pageUrl: r.pageUrl,
      screenshot_base64: r.screenshotBase64,
      screenshotBase64: r.screenshotBase64,
      created_at: r.createdAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      reporter: r.reporter
        ? {
            id: r.reporter.id,
            full_name: r.reporter.fullName,
            fullName: r.reporter.fullName,
            email: r.reporter.email,
            avatar_url: r.reporter.avatarUrl,
            avatarUrl: r.reporter.avatarUrl,
          }
        : {
            id: r.reporterId,
            full_name: 'Anonymous User',
            fullName: 'Anonymous User',
            email: '—',
            avatar_url: null,
            avatarUrl: null,
          },
    }));
  }
}
