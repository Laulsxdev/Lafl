import { z } from "zod";

export const ewbNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{12}$/, "E-Way Bill number must be 12 digits");

export const createDraftTripSchema = z.object({
  vehicleId: z.string().uuid(),
});

export const attachEwbSchema = z.object({
  tripId: z.string().uuid(),
  ewbNo: ewbNumberSchema,
});

export const crewSchema = z.object({
  tripId: z.string().uuid(),
  primaryDriverId: z.string().uuid(),
  secondaryDriverId: z.string().uuid().optional(),
  helperName: z.string().trim().max(120).optional(),
  plannedStart: z.coerce.date(),
  eta: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
});

export const chargeLineSchema = z.object({
  chargeType: z.string().trim().min(1),
  plannedAmount: z.number().nonnegative(),
  approvedAmount: z.number().nonnegative(),
});

export const approveMoneySchema = z.object({
  tripId: z.string().uuid(),
  charges: z.array(chargeLineSchema).min(1),
});

export const addAdvanceSchema = z.object({
  tripId: z.string().uuid(),
  driverId: z.string().uuid(),
  amount: z.number().positive(),
  mode: z.enum(["cash", "upi", "bank", "fuel_card", "fastag", "cheque"]),
  refNo: z.string().trim().optional(),
});

export type CreateDraftTripInput = z.infer<typeof createDraftTripSchema>;
export type AttachEwbInput = z.infer<typeof attachEwbSchema>;
export type CrewInput = z.infer<typeof crewSchema>;
export type ApproveMoneyInput = z.infer<typeof approveMoneySchema>;
export type AddAdvanceInput = z.infer<typeof addAdvanceSchema>;
