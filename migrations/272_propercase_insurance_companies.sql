-- ─────────────────────────────────────────────────────────────
-- Migración 272: Proper case inteligente para insurance_companies
-- Aplica formato proper case a los nombres de las compañías de seguros.
-- Reglas:
--   - Conectores en minúsculas: de, del, la, el, los, las, y, en, a
--   - Abreviaturas legales en minúsculas: s.a., s.a.i., ltda.
--   - Acrónimos en MAYÚSCULAS: BCI, BICE, HDI, CN, FID, RSA, BNP, CLC, UC, GNV, SURA, CF
--   - Tildes correctas: Compañía, Ejército, Aviación, Cámara
--   - Marcas con mayúscula inicial: Mapfre, Chubb, Zurich, MetLife, etc.
--   - O'Higgins con apóstrofe
-- No borra datos. Solo actualiza el campo name.
-- ─────────────────────────────────────────────────────────────

UPDATE insurance_companies SET name = '4 Life Seguros de Vida s.a.', updated_at = NOW() WHERE name = '4 LIFE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Alemana Seguros s.a.', updated_at = NOW() WHERE name = 'ALEMANA SEGUROS S.A.';
UPDATE insurance_companies SET name = 'Aseguradora Porvenir s.a.', updated_at = NOW() WHERE name = 'ASEGURADORA PORVENIR S.A.';
UPDATE insurance_companies SET name = 'Assurant Chile Compañía de Seguros Generales s.a.', updated_at = NOW() WHERE name = 'ASSURANT CHILE COMPAÑIA DE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Augustar Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'AUGUSTAR SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'BCI Seguros Generales s.a.', updated_at = NOW() WHERE name = 'BCI SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'BCI Seguros Vida s.a.', updated_at = NOW() WHERE name = 'BCI SEGUROS VIDA S.A.';
UPDATE insurance_companies SET name = 'BICE Vida Compañía de Seguros s.a.', updated_at = NOW() WHERE name = 'BICE VIDA COMPAÑIA DE SEGUROS S.A.';
UPDATE insurance_companies SET name = 'BNP Paribas Cardif Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'BNP PARIBAS CARDIF SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'BNP Paribas Cardif Seguros Generales s.a.', updated_at = NOW() WHERE name = 'BNP PARIBAS CARDIF SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Bupa Compañía de Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'BUPA COMPAÑIA DE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'CF Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'CF SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Chubb Seguros Chile s.a.', updated_at = NOW() WHERE name = 'CHUBB SEGUROS CHILE S.A.';
UPDATE insurance_companies SET name = 'Chubb Seguros de Vida Chile s.a.', updated_at = NOW() WHERE name = 'CHUBB SEGUROS DE VIDA CHILE S.A.';
UPDATE insurance_companies SET name = 'CN Life, Compañía de Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'CN LIFE, COMPAÑIA DE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Colmena Compañía de Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'COLMENA COMPAÑIA DE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Compañía de Seguros Confuturo s.a.', updated_at = NOW() WHERE name = 'COMPAÑIA DE SEGUROS CONFUTURO S.A.';
UPDATE insurance_companies SET name = 'Compañía de Seguros de Vida Cámara s.a.', updated_at = NOW() WHERE name = 'COMPAÑIA DE SEGUROS DE VIDA CAMARA S.A.';
UPDATE insurance_companies SET name = 'Compañía de Seguros de Vida Consorcio Nacional de Seguros s.a.', updated_at = NOW() WHERE name = 'COMPAÑIA DE SEGUROS DE VIDA CONSORCIO NACIONAL DE SEGUROS S.A.';
UPDATE insurance_companies SET name = 'Compañía de Seguros de Vida Principal s.a.', updated_at = NOW() WHERE name = 'COMPAÑIA DE SEGUROS DE VIDA PRINCIPAL S.A.';
UPDATE insurance_companies SET name = 'Compañía de Seguros Generales Consorcio Nacional de Seguros s.a.', updated_at = NOW() WHERE name = 'COMPAÑIA DE SEGUROS GENERALES CONSORCIO NACIONAL DE SEGUROS S.A.';
UPDATE insurance_companies SET name = 'Compañía de Seguros Generales Continental s.a.', updated_at = NOW() WHERE name = 'COMPAÑIA DE SEGUROS GENERALES CONTINENTAL S.A.';
UPDATE insurance_companies SET name = 'Contempora Compañía de Seguros Generales s.a.', updated_at = NOW() WHERE name = 'CONTEMPORA COMPAÑIA DE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Divina Pastora Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'DIVINA PASTORA SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Euroamerica Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'EUROAMERICA SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Everest Compañía de Seguros Generales Chile s.a.', updated_at = NOW() WHERE name = 'EVEREST COMPAÑIA DE SEGUROS GENERALES CHILE S.A.';
UPDATE insurance_companies SET name = 'FID Chile Seguros Generales s.a.', updated_at = NOW() WHERE name = 'FID CHILE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'HDI Seguros s.a.', updated_at = NOW() WHERE name = 'HDI SEGUROS S.A.';
UPDATE insurance_companies SET name = 'Help Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'HELP SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Liberty Mutual Surety Seguros Chile s.a.', updated_at = NOW() WHERE name = 'LIBERTY MUTUAL SURETY SEGUROS CHILE S.A.';
UPDATE insurance_companies SET name = 'Mapfre Compañía de Seguros de Vida de Chile s.a.', updated_at = NOW() WHERE name = 'MAPFRE COMPAÑIA DE SEGUROS DE VIDA DE CHILE S.A.';
UPDATE insurance_companies SET name = 'Mapfre Compañía de Seguros Generales de Chile s.a.', updated_at = NOW() WHERE name = 'MAPFRE COMPAÑIA DE SEGUROS GENERALES DE CHILE S.A.';
UPDATE insurance_companies SET name = 'MetLife Chile Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'METLIFE CHILE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'MetLife Chile Seguros Generales s.a.', updated_at = NOW() WHERE name = 'METLIFE CHILE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Mutual de Seguros de Chile', updated_at = NOW() WHERE name = 'MUTUAL DE SEGUROS DE CHILE';
UPDATE insurance_companies SET name = 'Mutualidad de Carabineros', updated_at = NOW() WHERE name = 'MUTUALIDAD DE CARABINEROS';
UPDATE insurance_companies SET name = 'Mutualidad del Ejército y Aviación', updated_at = NOW() WHERE name = 'MUTUALIDAD DEL EJERCITO Y AVIACION';
UPDATE insurance_companies SET name = 'O''Higgins', updated_at = NOW() WHERE name = 'OHiggins';
UPDATE insurance_companies SET name = 'Orion Seguros Generales s.a.', updated_at = NOW() WHERE name = 'ORION SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Penta Vida Compañía de Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'PENTA VIDA COMPAÑIA DE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Principal Compañía de Seguros de Vida Chile s.a.', updated_at = NOW() WHERE name = 'PRINCIPAL COMPAÑIA DE SEGUROS DE VIDA CHILE S.A.';
UPDATE insurance_companies SET name = 'Principal Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'PRINCIPAL SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Reale Chile Seguros Generales s.a.', updated_at = NOW() WHERE name = 'REALE CHILE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Renta Nacional Compañía de Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'RENTA NACIONAL COMPAÑIA DE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Renta Nacional Compañía de Seguros Generales s.a.', updated_at = NOW() WHERE name = 'RENTA NACIONAL COMPAÑIA DE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Save Compañía de Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'SAVE COMPAÑÍA DE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Seguros CLC s.a.', updated_at = NOW() WHERE name = 'SEGUROS CLC S.A.';
UPDATE insurance_companies SET name = 'Seguros de Vida SURA s.a.', updated_at = NOW() WHERE name = 'SEGUROS DE VIDA SURA S.A.';
UPDATE insurance_companies SET name = 'Seguros de Vida Suramericana s.a.', updated_at = NOW() WHERE name = 'SEGUROS DE VIDA SURAMERICANA S.A.';
UPDATE insurance_companies SET name = 'Seguros de Vida y Salud UC Christus s.a.', updated_at = NOW() WHERE name = 'SEGUROS DE VIDA Y SALUD UC CHRISTUS S.A.';
UPDATE insurance_companies SET name = 'Seguros Generales Suramericana s.a.', updated_at = NOW() WHERE name = 'SEGUROS GENERALES SURAMERICANA S.A.';
UPDATE insurance_companies SET name = 'Southbridge Compañía de Seguros Generales s.a.', updated_at = NOW() WHERE name = 'SOUTHBRIDGE COMPAÑIA DE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Starr International Seguros Generales s.a.', updated_at = NOW() WHERE name = 'STARR INTERNATIONAL SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Unnio Seguros Generales s.a.', updated_at = NOW() WHERE name = 'UNNIO SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Zenit Seguros Generales s.a.', updated_at = NOW() WHERE name = 'ZENIT SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Zurich Chile Seguros de Vida s.a.', updated_at = NOW() WHERE name = 'ZURICH CHILE SEGUROS DE VIDA S.A.';
UPDATE insurance_companies SET name = 'Zurich Chile Seguros Generales s.a.', updated_at = NOW() WHERE name = 'ZURICH CHILE SEGUROS GENERALES S.A.';
UPDATE insurance_companies SET name = 'Zurich Santander Seguros de Vida Chile s.a.', updated_at = NOW() WHERE name = 'ZURICH SANTANDER SEGUROS DE VIDA CHILE S.A.';
UPDATE insurance_companies SET name = 'Zurich Santander Seguros Generales Chile s.a.', updated_at = NOW() WHERE name = 'ZURICH SANTANDER SEGUROS GENERALES CHILE S.A.';
