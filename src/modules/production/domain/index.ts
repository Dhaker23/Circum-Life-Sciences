// Phase 3 production domain: state machines + invariants + zod schemas.
// D6: Routing immutability (frozen when revision not DRAFT/IN_REVIEW, same as BOM ADR-0006).
// D7: WO/Batch/DeviceLot state machines. D5: consumption transactionality + reservation invariants.
// Genealogy: WorkOrder -> Batch -> DeviceLot -> OperationExecution -> MaterialConsumption -> MaterialLot.
import { z } from "zod";
import { StateTransitionError, ValidationError } from "@/lib/errors";

// ---- Work Order state machine (D7) ----
export const WORK_ORDER_STATUSES = ["PLANNED", "RELEASED", "IN_PRODUCTION", "COMPLETED", "CLOSED", "CANCELLED", "ON_HOLD"] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

const WO_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PLANNED: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PRODUCTION", "ON_HOLD", "CANCELLED"],
  IN_PRODUCTION: ["COMPLETED", "ON_HOLD"],
  ON_HOLD: ["IN_PRODUCTION", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function isValidWoTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return WO_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertWoTransition(from: string, to: string): void {
  if (!WORK_ORDER_STATUSES.includes(from as WorkOrderStatus)) throw new ValidationError(`Invalid work order status: ${from}`);
  if (!WORK_ORDER_STATUSES.includes(to as WorkOrderStatus)) throw new ValidationError(`Invalid work order status: ${to}`);
  if (!isValidWoTransition(from as WorkOrderStatus, to as WorkOrderStatus)) {
    throw new StateTransitionError(`Cannot transition work order from ${from} to ${to}`);
  }
}

// ---- Manufacturing Batch state machine (D7) ----
export const BATCH_STATUSES = ["PLANNED", "IN_PRODUCTION", "COMPLETED", "READY_FOR_REVIEW", "ON_HOLD"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

const BATCH_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  PLANNED: ["IN_PRODUCTION", "ON_HOLD"],
  IN_PRODUCTION: ["COMPLETED", "ON_HOLD"],
  ON_HOLD: ["IN_PRODUCTION"],
  COMPLETED: ["READY_FOR_REVIEW"],
  READY_FOR_REVIEW: [], // Phase 3 stops here; Phase 9 does QA Review/Release
};

export function isValidBatchTransition(from: BatchStatus, to: BatchStatus): boolean {
  return BATCH_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertBatchTransition(from: string, to: string): void {
  if (!BATCH_STATUSES.includes(from as BatchStatus)) throw new ValidationError(`Invalid batch status: ${from}`);
  if (!BATCH_STATUSES.includes(to as BatchStatus)) throw new ValidationError(`Invalid batch status: ${to}`);
  if (!isValidBatchTransition(from as BatchStatus, to as BatchStatus)) {
    throw new StateTransitionError(`Cannot transition batch from ${from} to ${to}`);
  }
}

// ---- Device Lot state machine (D7) ----
export const DEVICE_LOT_STATUSES = ["CREATED", "IN_PROCESS", "COMPLETED"] as const;
export type DeviceLotStatus = (typeof DEVICE_LOT_STATUSES)[number];

const DL_TRANSITIONS: Record<DeviceLotStatus, DeviceLotStatus[]> = {
  CREATED: ["IN_PROCESS"],
  IN_PROCESS: ["COMPLETED"],
  COMPLETED: [],
};

export function isValidDlTransition(from: DeviceLotStatus, to: DeviceLotStatus): boolean {
  return DL_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertDlTransition(from: string, to: string): void {
  if (!DEVICE_LOT_STATUSES.includes(from as DeviceLotStatus)) throw new ValidationError(`Invalid device lot status: ${from}`);
  if (!DEVICE_LOT_STATUSES.includes(to as DeviceLotStatus)) throw new ValidationError(`Invalid device lot status: ${to}`);
  if (!isValidDlTransition(from as DeviceLotStatus, to as DeviceLotStatus)) {
    throw new StateTransitionError(`Cannot transition device lot from ${from} to ${to}`);
  }
}

// ---- Routing immutability (D6, same as BOM ADR-0006) ----
export const ROUTING_EDITABLE_REVISION_STATUSES = ["DRAFT", "IN_REVIEW"];
export function isRoutingEditable(revisionStatus: string): boolean {
  return ROUTING_EDITABLE_REVISION_STATUSES.includes(revisionStatus);
}
export function assertRoutingEditable(revisionStatus: string): void {
  if (!isRoutingEditable(revisionStatus)) {
    throw new StateTransitionError(
      `Routing is immutable: revision status is ${revisionStatus} (editable only in DRAFT/IN_REVIEW). A routing change requires a new Product Revision (ADR-0006/0009).`,
    );
  }
}

// ---- Quantity invariants (D5) ----
// Consumption: quantity > 0 and <= materialLot.quantityAvailable.
export function assertConsumptionQuantity(quantity: string | number, available: string | number): void {
  const q = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  const a = typeof available === "string" ? parseFloat(available) : available;
  if (Number.isNaN(q) || Number.isNaN(a)) throw new ValidationError("Quantities must be numeric");
  if (q <= 0) throw new ValidationError("Consumption quantity must be > 0");
  if (q > a) throw new StateTransitionError(`Over-consumption: requested ${q} but only ${a} available`);
}

// Reservation: quantity > 0 and (reserved + available) must not exceed received.
export function assertReservationQuantity(quantity: string | number, available: string | number, reserved: string | number, received: string | number): void {
  const q = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  const a = typeof available === "string" ? parseFloat(available) : available;
  const r = typeof reserved === "string" ? parseFloat(reserved) : reserved;
  const rec = typeof received === "string" ? parseFloat(received) : received;
  if (Number.isNaN(q) || Number.isNaN(a) || Number.isNaN(r) || Number.isNaN(rec)) throw new ValidationError("Quantities must be numeric");
  if (q <= 0) throw new ValidationError("Reservation quantity must be > 0");
  if (a + r + q > rec) {
    throw new StateTransitionError(`Reservation exceeds lot capacity: available ${a} + reserved ${r} + new ${q} > received ${rec}`);
  }
}

// ---- Zod schemas ----

export const CreateWorkCenterSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
  siteId: z.string().cuid(),
  description: z.string().max(2000).optional(),
});

export const UpdateWorkCenterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const CreateOperationSchema = z.object({
  sequence: z.number().int().min(0),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  workCenterId: z.string().cuid().nullish(),
  estimatedDurationMinutes: z.number().int().min(0).nullish(),
  instructions: z.string().max(5000).optional(),
});

export const UpdateOperationSchema = z.object({
  sequence: z.number().int().min(0).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  workCenterId: z.string().cuid().nullish(),
  estimatedDurationMinutes: z.number().int().min(0).nullish(),
  instructions: z.string().max(5000).nullish(),
});

export const CreateWorkOrderSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  productRevisionId: z.string().cuid(),
  siteId: z.string().cuid(),
  plannedQuantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0),
  unit: z.string().min(1).max(20),
  plannedStartDate: z.coerce.date().optional(),
  plannedDueDate: z.coerce.date().optional(),
});

export const WorkOrderTransitionSchema = z.object({
  to: z.enum(WORK_ORDER_STATUSES),
  reason: z.string().min(1).max(500),
});

export const CreateBatchSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  plannedQuantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0),
  unit: z.string().min(1).max(20),
});

export const BatchTransitionSchema = z.object({
  to: z.enum(BATCH_STATUSES),
  reason: z.string().min(1).max(500),
});

export const CreateDeviceLotSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  quantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0),
  unit: z.string().min(1).max(20),
});

export const DeviceLotTransitionSchema = z.object({
  to: z.enum(DEVICE_LOT_STATUSES),
  reason: z.string().min(1).max(500),
});

export const CreateOperationExecutionSchema = z.object({
  operationId: z.string().cuid(),
  workCenterId: z.string().cuid().nullish(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullish(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"]).default("IN_PROGRESS"),
  operatorEmployeeId: z.string().cuid(),
  parameters: z.record(z.string(), z.unknown()).nullish(),
  notes: z.string().max(2000).nullish(),
});

export const CreateConsumptionSchema = z.object({
  materialLotId: z.string().cuid(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0, "quantity must be > 0"),
  unit: z.string().min(1).max(20),
  notes: z.string().max(2000).nullish(),
});

export const CreateReservationSchema = z.object({
  materialLotId: z.string().cuid(),
  quantityReserved: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0),
  unit: z.string().min(1).max(20),
});

export const CreateScrapSchema = z.object({
  deviceLotId: z.string().cuid().nullish(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0),
  unit: z.string().min(1).max(20),
  reason: z.string().min(1).max(500),
});

export const CreateReworkSchema = z.object({
  deviceLotId: z.string().cuid().nullish(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0),
  unit: z.string().min(1).max(20),
  reason: z.string().min(1).max(500),
});

export const CreateShiftSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(1).max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});
