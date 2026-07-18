-- Migration 168: Relax NOT NULL constraints on inspection_reports
-- report_url and claim_id can be NULL when creating a report record
-- before the PDF is generated/uploaded, or when the inspection
-- doesn't have an associated claim.

ALTER TABLE inspection_reports ALTER COLUMN report_url DROP NOT NULL;
ALTER TABLE inspection_reports ALTER COLUMN claim_id DROP NOT NULL;
