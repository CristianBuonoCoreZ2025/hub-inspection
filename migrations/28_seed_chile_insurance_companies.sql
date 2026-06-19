-- ============================================================
-- Hub Inspections — Migracion 28: Companias de Seguros de Chile
-- Carga el catalogo completo de companias operativas en Chile
-- ============================================================

DELETE FROM insurance_companies WHERE country = 'CL';

INSERT INTO insurance_companies (id, name, country, is_active) VALUES
  ('6a1e8b2c-3d4f-5a6b-7c8d-9e0f1a2b3c4d', 'ACE Seguros', 'CL', true),
  ('6b2f9c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d', 'BCI Seguros', 'CL', true),
  ('6c3f0d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e', 'BNP Paribas Cardif', 'CL', true),
  ('6d4a1e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f', 'Chilena Consolidada', 'CL', true),
  ('6e5b2f6a-7c8d-9e0f-1a2b-3c4d5e6f7a8b', 'Colmena', 'CL', true),
  ('6f6c3a7b-8d9e-0f1a-2b3c-4d5e6f7a8b9c', 'Confuturo', 'CL', true),
  ('6a7d4b8c-9e0f-1a2b-3c4d-5e6f7a8b9c0d', 'Consorcio', 'CL', true),
  ('6b8e5c9d-0e1f-2a3b-4c5d-6e7f8a9b0c1d', 'Cruz del Sur', 'CL', true),
  ('6c9f6d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e', 'Euler Hermes', 'CL', true),
  ('6d0a7e1f-2a3b-4c5d-6e7f-8a9b0c1d2e3f', 'Falabella Seguros', 'CL', true),
  ('6e1b8f2a-3b4c-5d6e-7f8a-9b0c1d2e3f4a', 'GNV Seguros', 'CL', true),
  ('6f2c9a3b-4c5d-6e7f-8a9b-0c1d2e3f4a5b', 'HDI Seguros', 'CL', true),
  ('6a3d0b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', 'Liberty Seguros', 'CL', true),
  ('6b4e1c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d', 'Mapfre Seguros', 'CL', true),
  ('6c5f2d6e-7f8a-9b0c-1d2e-3f4a5b6c7d8e', 'MetLife', 'CL', true),
  ('6d6a3e7f-8a9b-0c1d-2e3f-4a5b6c7d8e9f', 'Mutual de Seguridad', 'CL', true),
  ('6e7b4f8a-9b0c-1d2e-3f4a-5b6c7d8e9f0a', 'OHiggins', 'CL', true),
  ('6f8c5a9b-0c1d-2e3f-4a5b-6c7d8e9f0a1b', 'Penta Seguros', 'CL', true),
  ('6a9d6b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c', 'Reale Seguros', 'CL', true),
  ('6b0e7c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d', 'Renta Nacional', 'CL', true),
  ('6c1f8d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e', 'RSA Seguros', 'CL', true),
  ('6d2a9e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f', 'Santander Seguros', 'CL', true),
  ('6e3b0f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a', 'Sura', 'CL', true),
  ('6f4c1a5b-6c7d-8e9f-0a1b-2c3d4e5f6a7b', 'Unnio Seguros', 'CL', true),
  ('6a5d2b6c-7d8e-9f0a-1b2c-3d4e5f6a7b8c', 'Valebridge', 'CL', true),
  ('6b6e3c7d-8e9f-0a1b-2c3d-4e5f6a7b8c9d', 'Warranty', 'CL', true),
  ('6c7f4d8e-9f0a-1b2c-3d4e-5f6a7b8c9d0e', 'Zurich Santander', 'CL', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
