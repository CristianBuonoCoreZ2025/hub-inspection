-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 68: Password Reset Codes
-- Sistema propio de códigos de verificación para reset de contraseña
-- No depende de la configuración de OTP de Nhost
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla para almacenar códigos de reset temporales
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_reset_codes_code ON password_reset_codes(code);

-- 3. Función para generar código de 6 dígitos
CREATE OR REPLACE FUNCTION generate_reset_code(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_existing TEXT;
BEGIN
  -- Generar código único de 6 dígitos
  LOOP
    v_code := lpad(floor(random() * 1000000)::TEXT, 6, '0');
    SELECT code INTO v_existing FROM password_reset_codes 
    WHERE code = v_code AND used = false AND expires_at > NOW()
    LIMIT 1;
    EXIT WHEN v_existing IS NULL;
  END LOOP;
  
  -- Insertar el código (expira en 10 minutos)
  INSERT INTO password_reset_codes (email, code, expires_at)
  VALUES (p_email, v_code, NOW() + INTERVAL '10 minutes');
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para validar un código
CREATE OR REPLACE FUNCTION validate_reset_code(p_email TEXT, p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM password_reset_codes
    WHERE email = p_email
    AND code = p_code
    AND used = false
    AND expires_at > NOW()
  ) INTO v_valid;
  
  IF v_valid THEN
    -- Marcar como usado
    UPDATE password_reset_codes 
    SET used = true 
    WHERE email = p_email AND code = p_code AND used = false;
  END IF;
  
  RETURN v_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Limpiar códigos expirados automáticamente (cron manual o trigger)
-- Por ahora, los códigos expirados se ignoran en las queries

COMMENT ON TABLE password_reset_codes IS 'Códigos temporales para reset de contraseña. Expiran en 10 minutos.';
