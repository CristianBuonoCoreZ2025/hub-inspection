-- Migration 132: Reactivar gestiones con is_active=false (soft delete legacy)
-- El sistema ya no usa soft delete. Las gestiones se rechazan desde emision
-- en vez de eliminarse. Reactivar las que fueron soft-deleteadas.

UPDATE claim_actions SET is_active = true WHERE is_active = false;
