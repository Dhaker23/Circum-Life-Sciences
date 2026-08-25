// Shared zod schemas for Circum API boundaries (PRD §10 input validation).
import { z } from "zod";
import { LOCALES } from "./permissions";

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const LocaleSchema = z.enum(LOCALES);

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
  preferredLocale: LocaleSchema.default("en"),
  siteId: z.string().cuid().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  preferredLocale: LocaleSchema.optional(),
  status: z.enum(["ACTIVE", "LOCKED", "DISABLED"]).optional(),
});

export const CreateAssignmentSchema = z.object({
  userId: z.string().cuid(),
  roleId: z.string().cuid(),
  siteId: z.string().cuid().nullable().optional(),
  departmentId: z.string().cuid().nullable().optional(),
  moduleScope: z.string().nullable().optional(),
});

export const CreateSiteSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/, "Site code must be uppercase alphanumeric/dash"),
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  timezone: z.string().max(100).default("Africa/Lagos"),
});

export const UpdateSiteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  timezone: z.string().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const CreateDepartmentSchema = z.object({
  siteId: z.string().cuid(),
  code: z.string().min(1).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
});

export const AuditQuerySchema = PaginationSchema.extend({
  actorUserId: z.string().cuid().optional(),
  entityType: z.string().max(100).optional(),
  entityId: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  outcome: z.enum(["SUCCESS", "FAILURE", "DENIED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
