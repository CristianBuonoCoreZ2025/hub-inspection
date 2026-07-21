# Guía de Despliegue GRATIS: OnlyOffice + Gotenberg

> **Objetivo:** costo cero permanente (solo ~$1/año del dominio).
> **Stack:** Oracle Cloud Always Free (VM ARM 4 OCPU + 24 GB RAM) + Docker + Cloudflare Tunnel (HTTPS).

## Resumen de pasos

1. Comprar dominio .xyz en Namecheap (~$1/año)
2. Migrar dominio a Cloudflare (gratis)
3. Crear cuenta Oracle Cloud Always Free
4. Crear VM ARM (4 OCPU + 24 GB RAM)
5. Instalar Docker en la VM
6. Desplegar OnlyOffice + Gotenberg con docker-compose
7. Instalar Cloudflare Tunnel para HTTPS público
8. Configurar `.env.local` del proyecto

---

## Paso 1: Comprar dominio .xyz en Namecheap

1. Ir a https://www.namecheap.com/
2. Crear cuenta (gratis)
3. Buscar un dominio .xyz o .top barato:
   - https://www.namecheap.com/domains/registration/results/?domain=xyz
   - Buscar uno que cueste ~$1-3/año el primer año
   - Ej: `hub-inspection.xyz`, `hubapp.xyz`, `tu-marca.xyz`
4. Agregar al carrito y comprar (~$1-3 con métodos: tarjeta, PayPal, crypto)
5. **NO contratar hosting ni extras** — solo el dominio
6. Esperar email de confirmación (instantáneo)

⚠️ **Renovación:** los .xyz suelen subir a ~$10/año al renovar. Antes de renovar, buscar promos o cambiar a otro TLD barato. Por ~$1-3 el primer año está perfecto para arrancar.

---

## Paso 2: Migrar dominio a Cloudflare (gratis)

Cloudflare Tunnel requiere que el dominio esté gestionado en Cloudflare.

1. Crear cuenta en Cloudflare → https://dash.cloudflare.com/sign-up (gratis)
2. Click **"Add a site"** → escribir tu dominio (ej: `hub-inspection.xyz`)
3. Seleccionar plan **Free**
4. Cloudflare escanea los DNS existentes — revisar que estén OK
5. Cloudflare te da **2 nameservers** tipo:
   ```
   lloyd.ns.cloudflare.com
   mia.ns.cloudflare.com
   ```
6. Ir a **Namecheap** → Domain List → Manage → Nameservers → "Custom DNS":
   - Pegar los 2 nameservers de Cloudflare
   - Guardar
7. Volver a Cloudflare → click "Check nameservers" — tarda 5 min a 24 hs
8. Cuando diga "Active", el dominio está gestionado por Cloudflare

---

## Paso 3: Crear cuenta Oracle Cloud Always Free

1. Ir a https://www.oracle.com/cloud/free/
2. Click **"Start for free"**
3. Completar:
   - Email
   - País: Chile
   - **Tarjeta de crédito/débito** (verificación — NO se cobra mientras estés en Always Free)
4. Región: **South America East (São Paulo)** o **US West (San Jose)** — tienen más disponibilidad ARM
5. Esperar email de confirmación (puede tardar hasta 24 hs)

⚠️ **IMPORTANTE — para quedarte en Always Free:**
- NO agregues capacidades pagas
- NO excedas los límites free (4 OCPU + 24 GB RAM ARM)
- Si Oracle te ofrece "upgrade", rechazalo
- La tarjeta es solo verificación — no se cobra mientras uses solo Always Free

---

## Paso 4: Crear VM ARM (4 OCPU + 24 GB RAM)

1. Entrar al Console: https://cloud.oracle.com
2. **Compute → Instances → Create Instance**
3. Configurar:
   - **Name:** `hub-srv`
   - **Image:** "Change image" → **Canonical Ubuntu 22.04** → **Always Free Eligible** → ARM64
   - **Shape:** "Change shape" →
     - **Ampere** → `VM.Standard.A1.Flex`
     - **OCPUs: 4**
     - **Memory: 24 GB**
   - **Networking:** crear nuevo VCN + subnet público, ✅ "Assign a public IPv4 address"
   - **SSH keys (IMPORTANTE):**
     - "Generate a keypair"
     - **Download PRIVATE key** (.key) — guardarlo bien, es tu acceso
     - **Download PUBLIC key** (.pub)
4. Click **"Create"** — esperar 2-5 min

⚠️ **Si te dice "Out of host capacity":**
- Es normal en Oracle Free. Reintentar cada 1-2 horas.
- Probar otra región (cambiar región arriba a la derecha del Console)
- Mejor horario: 3-6 AM hora local
- Si persiste por días, abrir ticket a Oracle support (gratis)

### Conectarse por SSH

```powershell
# En Windows PowerShell
# 1. Proteger la private key (Windows exige permisos restrictivos)
icacls "C:\ruta\ssh-key-xxxx.key" /inheritance:r /grant:r "$($env:USERNAME):(R)"

# 2. Conectarse
ssh -i "C:\ruta\ssh-key-xxxx.key" ubuntu@<IP-PÚBLICA-DE-LA-VM>
```

La IP pública la ves en Oracle Console → Compute → Instances → tu VM → "Public IP Address".

---

## Paso 5: Instalar Docker en la VM

Una vez conectado por SSH como `ubuntu@...`:

```bash
# Update
sudo apt update && sudo apt upgrade -y

# Prerrequisitos
sudo apt install -y ca-certificates curl gnupg lsb-release

# Repo de Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker sin sudo
sudo usermod -aG docker ubuntu

# Salir y volver a entrar
exit
# Volver a conectarse por SSH
ssh -i "C:\ruta\ssh-key.key" ubuntu@<IP>

# Verificar
docker --version
docker run hello-world
```

---

## Paso 6: Generar JWT_SECRET y desplegar servicios

```bash
# Generar JWT secret para OnlyOffice
openssl rand -hex 32
# ANOTAR este valor — lo vas a usar en docker-compose.yml Y en .env.local del proyecto
```

Crear estructura y docker-compose:

```bash
mkdir -p ~/services/onlyoffice/{logs,data,lib}
mkdir -p ~/services/gotenberg
cd ~/services
nano docker-compose.yml
```

Pegar este contenido (reemplazar `TU_JWT_SECRET` con el valor generado arriba):

```yaml
services:
  onlyoffice:
    image: onlyoffice/documentserver:latest
    container_name: onlyoffice
    restart: always
    ports:
      - "127.0.0.1:8080:80"
    environment:
      - JWT_ENABLED=true
      - JWT_SECRET=TU_JWT_SECRET
      - JWT_HEADER=Authorization
      - JWT_USE_FOR_REQUEST=true
      - WOPI_ENABLED=false
    volumes:
      - ./onlyoffice/logs:/var/log/onlyoffice
      - ./onlyoffice/data:/var/www/onlyoffice/Data
      - ./onlyoffice/lib:/var/lib/onlyoffice
    mem_limit: 4g
    memswap_limit: 4g

  gotenberg:
    image: gotenberg/gotenberg:8
    container_name: gotenberg
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    mem_limit: 1g
    command:
      - "--api-timeout=120s"
      - "--libreoffice-restart-after=100"
      - "--libreoffice-auto-restart=true"
```

Levantar:

```bash
cd ~/services
docker compose up -d

# Verificar que están corriendo
docker compose ps

# OnlyOffice tarda 2-3 min en arrancar la primera vez
docker compose logs -f onlyoffice
# Cuando veas "Nginx is ready" → Ctrl+C para salir de los logs
```

Verificar localmente (desde la VM):

```bash
# OnlyOffice
curl http://localhost:8080/healthcheck
# Debe devolver: true

# Gotenberg
curl http://localhost:3000/health
# Debe devolver: {"status":"pass"}
```

---

## Paso 7: Cloudflare Tunnel para HTTPS público

En lugar de abrir puertos y configurar SSL, usamos **Cloudflare Tunnel** — gratis, sin IP pública expuesta, HTTPS automático.

### Instalar cloudflared en la VM

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
cloudflared --version
```

### Autenticar con Cloudflare

```bash
cloudflared tunnel login
```

Te va a imprimir un URL. Abrila en tu navegador, elegí tu dominio (`hub-inspection.xyz`), autorizá. Esto guarda credentials en `~/.cloudflared/cert.pem`.

### Crear tunnel

```bash
cloudflared tunnel create hub-inspection
# Anotá el UUID del tunnel
# Se crea ~/.cloudflared/<UUID>.json
```

### Configurar el tunnel

```bash
nano ~/.cloudflared/config.yml
```

Contenido (reemplazar `<UUID>` y `tu-dominio.xyz`):

```yaml
tunnel: <UUID>
credentials-file: /home/ubuntu/.cloudflared/<UUID>.json

ingress:
  # OnlyOffice → onlyoffice.tu-dominio.xyz
  - hostname: onlyoffice.tu-dominio.xyz
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
      http2Origin: false
      # OnlyOffice necesita WebSocket para co-edición
      disableChunkedEncoding: false

  # Gotenberg → gotenberg.tu-dominio.xyz
  - hostname: gotenberg.tu-dominio.xyz
    service: http://localhost:3000

  # Catch-all (404)
  - service: http_status:404
```

### Crear registros DNS en Cloudflare

```bash
cloudflared tunnel route dns hub-inspection onlyoffice.tu-dominio.xyz
cloudflared tunnel route dns hub-inspection gotenberg.tu-dominio.xyz
```

Esto crea automáticamente los CNAMEs en Cloudflare apuntando al tunnel.

### Iniciar el tunnel como servicio systemd

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
sudo systemctl status cloudflared
```

### Verificar desde afuera (tu PC)

```bash
# OnlyOffice
curl https://onlyoffice.tu-dominio.xyz/healthcheck
# Debe devolver: true

# Gotenberg
curl https://gotenberg.tu-dominio.xyz/health
# Debe devolver: {"status":"pass"}

# Test de conversión Gotenberg
curl -X POST https://gotenberg.tu-dominio.xyz/forms/libreoffice/convert \
  -F "files=@documento.docx" \
  -o test.pdf
# Debe descargar un PDF válido
```

🎉 **Tenés OnlyOffice y Gotenberg públicos con HTTPS, gratis, permanentes.**

---

## Paso 8: Configurar el proyecto Next.js

### En `.env.local` (desarrollo local)

```bash
# OnlyOffice
ONLYOFFICE_URL=https://onlyoffice.tu-dominio.xyz
ONLYOFFICE_JWT_SECRET=<el-mismo-JWT_SECRET-que-en-docker-compose>

# Gotenberg
GOTENBERG_URL=https://gotenberg.tu-dominio.xyz

# Lock de documentos
DOCUMENT_LOCK_EXPIRY_HOURS=24
```

### En Vercel (producción)

Project Settings → Environment Variables:

```
ONLYOFFICE_URL = https://onlyoffice.tu-dominio.xyz
ONLYOFFICE_JWT_SECRET = <mismo valor>
GOTENBERG_URL = https://gotenberg.tu-dominio.xyz
DOCUMENT_LOCK_EXPIRY_HOURS = 24
```

⚠️ **CRÍTICO:** `ONLYOFFICE_JWT_SECRET` debe ser **exactamente igual** en:
- `docker-compose.yml` (en la VM)
- `.env.local` (tu PC)
- Vercel environment variables

Si no coinciden, OnlyOffice rechaza todas las requests con error de JWT.

---

## Costos reales

| Item | Costo |
|------|-------|
| Dominio .xyz (primer año) | ~$1-3 |
| Dominio .xyz (renovación) | ~$10/año (buscar promos o cambiar TLD) |
| Oracle Cloud Always Free VM | **$0** |
| Docker | $0 |
| Cloudflare Tunnel | **$0** |
| Vercel (Next.js) | $0 (Hobby plan) |
| Supabase | $0 (Free tier) |
| Cloudflare R2 | $0 (10 GB free) |
| **Total mensual** | **$0** |
| **Total anual** | **~$1-10** (solo dominio) |

---

## Mantenimiento

### Ver estado de servicios
```bash
ssh -i "C:\ruta\ssh-key.key" ubuntu@<IP>
docker compose -f ~/services/docker-compose.yml ps
docker compose -f ~/services/docker-compose.yml logs --tail=50 onlyoffice
sudo systemctl status cloudflared
```

### Reiniciar servicios
```bash
docker compose -f ~/services/docker-compose.yml restart
sudo systemctl restart cloudflared
```

### Actualizar imágenes (cada 1-3 meses)
```bash
cd ~/services
docker compose pull
docker compose up -d
```

### Backups
OnlyOffice guarda logs/data/lib en `~/services/onlyoffice/`:
```bash
tar -czf onlyoffice-backup-$(date +%Y%m%d).tar.gz ~/services/onlyoffice/
# Subir a Cloudflare R2 o donde prefieras
```

---

## Troubleshooting

### "Out of host capacity" al crear VM ARM
- **Normal en Oracle Free.** Reintentar cada 1-2 horas.
- Probar otra región (cambiar región arriba a la derecha del Console)
- Mejor horario: 3-6 AM hora local
- Si persiste por días, abrir ticket a Oracle support (gratis)

### No puedo conectarme por SSH
- Verificar security list en Oracle: VCN → Security Lists → Default → **Add Ingress Rule**:
  - Source: 0.0.0.0/0
  - Destination Port: 22
  - Protocol: TCP
- Verificar permisos de la private key (Windows: `icacls` como arriba)

### OnlyOffice no arranca (502)
- Verificar RAM: `free -h` (necesita 4 GB)
- Ver logs: `docker compose logs onlyoffice`
- Primera arranque tarda 2-3 min — esperar
- Verificar que el container está corriendo: `docker compose ps`

### OnlyOffice rechaza requests (JWT error)
- Verificar `JWT_SECRET` idéntico en docker-compose.yml y `.env.local`
- Verificar `JWT_HEADER=Authorization` (no `AuthorizationJwt`)
- Ver logs: `docker compose logs onlyoffice | grep -i jwt`

### Gotenberg no convierte
- Verificar tamaño del archivo (< 50 MB)
- Verificar formato soportado (.docx, .xlsx, .pptx, .odt, .rtf, .txt, .html)
- Ver logs: `docker compose logs gotenberg`

### Cloudflare Tunnel no conecta
- `sudo systemctl status cloudflared`
- `cloudflared tunnel list`
- Verificar `~/.cloudflared/config.yml` tiene el UUID correcto
- Verificar registros DNS: `nslookup onlyoffice.tu-dominio.xyz`

### Nameservers no propagan
- Esperar hasta 24 hs
- Verificar con: `nslookup -type=ns tu-dominio.xyz`
- Deben aparecer los `*.ns.cloudflare.com`

---

## Próximos pasos

Una vez verificado que OnlyOffice y Gotenberg responden públicamente:

1. **Pasame por chat:**
   - `ONLYOFFICE_URL` (ej: `https://onlyoffice.hub-inspection.xyz`)
   - `ONLYOFFICE_JWT_SECRET` (el valor que generaste con `openssl rand -hex 32`)
   - `GOTENBERG_URL` (ej: `https://gotenberg.hub-inspection.xyz`)

2. **Implemento la Fase 5** del plan:
   - API route `/api/claims/actions/[actionId]/onlyoffice-config` (genera config JWT firmada)
   - API route `/api/claims/actions/[actionId]/onlyoffice-callback` (recibe el guardado de OnlyOffice)
   - Componente `OnlyOfficeEditor` (modal con editor embebido)
   - Botón "Editar Online" en el `DocumentWorkspace`

3. **El botón "Convertir a PDF" ya funciona** apenas setees `GOTENBERG_URL` — no requiere código nuevo.

Decime cuando tengas todo desplegado y pasame las URLs + JWT_SECRET.
