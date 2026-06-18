-- Migration: 0065_payment_void
-- Adds void/refund tracking columns to the payments table.
-- A voided payment is marked with voidedAt; the visit's paidAmount
-- is recalculated on the next read via the API (not stored redundantly).

ALTER TABLE payments ADD COLUMN voided_at INTEGER;
ALTER TABLE payments ADD COLUMN voided_by TEXT REFERENCES users(id);
ALTER TABLE payments ADD COLUMN void_reason TEXT;
