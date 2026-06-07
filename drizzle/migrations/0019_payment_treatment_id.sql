-- Add optional treatment attribution to payments.
-- null = general visit-level payment; set = payment credited to a specific treatment plan.
-- Both types count toward visits.paid_amount (money collected is money collected).
ALTER TABLE payments ADD COLUMN treatment_id TEXT REFERENCES treatments(id);
