# Deploy — asis.chat

Guía operativa para levantar, deployar y mantener asis.chat en producción.

## Arquitectura actual

```
GitHub (push a main) ──▶ GitHub Actions
                            │
                            ├─ build hivvo-api (Docker) ─▶ tarball
                            ├─ build hivvo-ui  (Docker) ─▶ tarball
                            │
                            └─ scp + ssh ─▶ EC2 (Ubuntu 24.04)
                                              │
                                              ├─ hydrate-env.sh ──▶ SSM → api/.env
                                              │
                                              └─ docker compose up -d
                                                    ├─ hivvo-api     :3000
                                                    ├─ hivvo-ui      :3001
                                                    └─ nginx          :80, :443 (letsencrypt)
```

- **Infra**: [infra/terraform/](infra/terraform/) — EC2 + EIP + Route53 + SES + CloudWatch log groups + bucket de media
- **Secretos**: SSM Parameter Store bajo `/asis/api/*`. El EC2 los lee vía su IAM role
- **Certs SSL**: Let's Encrypt en `/etc/letsencrypt/` (persisten en el disco del EC2).
  Dos certs: `asis.chat` (+ www) y `media.asis.chat`
- **Media**: bucket S3 privado `asis-chat-media`; se sirve por URLs prefirmadas y,
  en plan free, por el proxy en `media.asis.chat` ([MEDIA-LIBRARY.md](MEDIA-LIBRARY.md))
- **DB**: MongoDB Atlas (externo, con IP del EC2 en whitelist)
- **Deploy**: GitHub Actions en cada push a `main` ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))

---

## Setup inicial (una sola vez)

### Pre-requisitos locales

```bash
aws configure
aws sts get-caller-identity        # verificar cuenta correcta
terraform version                   # >= 1.5
```

### 1. Red de seguridad en Terraform

Agregar a [infra/terraform/main.tf](infra/terraform/main.tf), dentro del `resource "aws_instance" "hivvo"`:

```hcl
lifecycle {
  ignore_changes  = [ami]
  prevent_destroy = true
}
```

Esto previene que un AMI nuevo de Ubuntu dispare un replace del EC2 (causa raíz del outage pasado).

### 2. Subir los secretos a SSM

Con `api/.env` local (fuente de verdad de los valores), correr desde la raíz del repo:

```bash
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  value="${value%\"}"; value="${value#\"}"
  MSYS_NO_PATHCONV=1 aws ssm put-parameter \
    --region us-east-1 \
    --name "/asis/api/$key" \
    --value "$value" \
    --type SecureString \
    --overwrite
done < api/.env
```

> **Git Bash en Windows**: el `MSYS_NO_PATHCONV=1` impide que Git Bash convierta `/asis/api/...` a una ruta de Windows. Sin eso, el comando falla con `"Parameter name must be a fully qualified name"`. En Linux/macOS no hace falta.

Verificar:
```bash
MSYS_NO_PATHCONV=1 aws ssm get-parameters-by-path --path /asis/api --region us-east-1 --query 'Parameters[*].Name'
```

### 3. IAM policy para que el EC2 lea SSM

Nuevo archivo [infra/terraform/ssm.tf](infra/terraform/ssm.tf):

```hcl
resource "aws_iam_role_policy" "ssm_read" {
  name = "${var.app_name}-ssm-read"
  role = aws_iam_role.ec2_ses.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParametersByPath",
          "ssm:GetParameters",
          "ssm:GetParameter",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/asis/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}
```

Aplicar:
```bash
cd infra/terraform
terraform plan      # verificar que SOLO agrega la policy, no recrea EC2
terraform apply
```

### 4. Script de hidratación

Nuevo archivo `infra/scripts/hydrate-env.sh`:

```bash
#!/bin/bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
SSM_PATH="${1:-/asis/api}"
OUT="${2:-./api/.env}"

mkdir -p "$(dirname "$OUT")"

aws ssm get-parameters-by-path \
  --region "$REGION" \
  --path "$SSM_PATH" \
  --recursive \
  --with-decryption \
  --query 'Parameters[*].[Name,Value]' \
  --output text \
| while IFS=$'\t' read -r name value; do
    key="${name##*/}"
    printf '%s=%s\n' "$key" "$value"
  done > "$OUT"

chmod 600 "$OUT"
echo "Escrito $OUT con $(wc -l < "$OUT") variables"
```

Hacerlo ejecutable:
```bash
chmod +x infra/scripts/hydrate-env.sh
```

### 5. Actualizar el workflow de GitHub Actions

En [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

**En el step "Copy images to EC2"**, incluir los scripts:
```yaml
source: "hivvo-api.tar.gz,hivvo-ui.tar.gz,docker-compose.yml,docker-compose.cloudwatch.yml,infra/nginx/,infra/scripts/"
```

**En el step "Deploy containers"**, reemplazar el `script:` por:
```yaml
script: |
  cd ${{ env.APP_DIR }}

  docker load < hivvo-api.tar.gz
  docker load < hivvo-ui.tar.gz

  # Hidratar secretos desde SSM
  chmod +x infra/scripts/hydrate-env.sh
  bash infra/scripts/hydrate-env.sh /asis/api ./api/.env

  # Restart services con CloudWatch
  docker compose down
  docker compose -f docker-compose.yml -f docker-compose.cloudwatch.yml up -d

  sleep 20
  docker compose ps

  rm -f hivvo-api.tar.gz hivvo-ui.tar.gz
  docker image prune -f

  echo "Deploy complete!"
```

### 6. Preparar el EC2 actual

El EC2 actual no tiene AWS CLI. En Ubuntu 24.04 el paquete `awscli` fue removido de los repos de apt, hay que instalar AWS CLI v2 oficial:

```bash
ssh -i ~/.ssh/<key>.pem ubuntu@asis.chat

sudo apt-get update
sudo apt-get install -y unzip curl
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws/

aws --version   # aws-cli/2.x.x ...

# Verificar que el role IAM funciona
aws ssm get-parameter --name /asis/api/MONGODB_URI --region us-east-1 --with-decryption
```

Si el `get-parameter` falla con AccessDenied, revisar en AWS Console que el role `hivvo-ec2-ses-role` tenga la policy `hivvo-ssm-read` adjunta.

> `user-data.sh` ya instala AWS CLI v2 en EC2 nuevos. Este bloque es solo para el EC2 actual que no re-ejecuta user-data.

### 7. Secrets de GitHub Actions

En el repo → Settings → Secrets and variables → Actions:

| Secret | Descripción |
|---|---|
| `EC2_HOST` | Dominio o IP del EC2 (`asis.chat`) |
| `EC2_SSH_KEY` | Clave privada SSH completa (con BEGIN/END lines) |
| `NEXT_PUBLIC_API_URL` | `https://asis.chat/api` — **con el sufijo `/api`**: el cliente arma las URLs como `${base}${path}` (`/flows`, `/conversations`…), y nginx enruta `/api/` al contenedor de la API. Sin el sufijo, todas las llamadas caen en la UI y devuelven 404. El socket deriva el origen quitando `/api`. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Client ID de Google OAuth |

**Los secretos de la API (MONGODB_URI, JWT_SECRET, etc) NO van acá** — viven en SSM.

### Variables de entorno que NO pueden faltar en SSM

El código tiene defaults de desarrollo (`http://localhost:...`) para varias variables. Si faltan en
SSM, la app arranca igual pero se comporta como si fuera local — el síntoma aparece recién en el mail
que le llega a un usuario real:

| Variable | Valor en producción | Qué rompe si falta |
|---|---|---|
| `FRONTEND_URL` | `https://asis.chat` | Links de recuperar contraseña, verificación de mail e invitaciones salen apuntando a `http://localhost:3001`; los redirects de billing también |
| `ALLOWED_ORIGINS` | `https://asis.chat,https://www.asis.chat` | CORS del API y del gateway de WebSocket. Hoy no se nota porque todo es mismo-origen detrás de nginx, pero cualquier cliente cross-origin queda bloqueado |
| `FLOW_SECRETS_KEY` | 32 bytes hex | Las Conexiones de Flujos (credenciales del nodo HTTP) tiran 500 al crearse. **Si se pierde o se rota, las Conexiones ya guardadas quedan indescifrables** |
| `API_BASE_URL` | `https://asis.chat/api` | Base pública que la API expone a integradores |
| `API_PUBLIC_URL` | `https://asis.chat` | Base con la que se arman las URLs de los archivos. Si falta, las imágenes del chat apuntan a `localhost` y no cargan |
| `MEDIA_S3_BUCKET` | `asis-chat-media` | **Sin esto la media library queda deshabilitada para todos los tenants**: la app opera en passthrough y los archivos se pierden a los 30 días (ver [MEDIA-LIBRARY.md](MEDIA-LIBRARY.md)) |
| `MEDIA_S3_REGION` | `us-east-1` | Región del bucket. Cae a `AWS_REGION` si falta |
| `MEDIA_URL_SECRET` | 32 bytes hex | Firma de las URLs del proxy de media. Si falta usa `JWT_SECRET`; rotarlo invalida las URLs ya emitidas (duran 15 min, así que es inocuo) |

> El bucket lo crea Terraform ([infra/terraform/media.tf](infra/terraform/media.tf)) junto con
> los permisos del rol IAM del EC2. Es privado: no se accede por URL pública, la lectura sale por
> URLs prefirmadas de corta vida y lo que se manda a WhatsApp viaja por `media_id`.

### 8. Primer deploy

```bash
git add -A
git commit -m "Migrate to SSM-based secrets + harden EC2 lifecycle"
git push origin main
```

Seguir el progreso en GitHub → Actions → "Build & Deploy to EC2".

### 9. Regenerar certs SSL (solo si se perdieron)

Si el EC2 es nuevo, no tiene certs y nginx no arranca. Después de que api/ui estén arriba:

```bash
ssh -i ~/.ssh/<key>.pem ubuntu@asis.chat
cd ~/hivvo

docker compose stop nginx
sudo certbot certonly --standalone -d asis.chat -d www.asis.chat \
  --email contact@asis.chat --agree-tos --no-eff-email
sudo certbot certonly --standalone -d media.asis.chat \
  --email contact@asis.chat --agree-tos --no-eff-email
docker compose up -d nginx
```

Verificar: abrir https://asis.chat en el navegador.

> **El cert de `media.asis.chat` va ANTES que el config de nginx que lo usa.**
> El server block referencia `/etc/letsencrypt/live/media.asis.chat/fullchain.pem`;
> si el archivo no existe, nginx no arranca y se cae el sitio entero, no solo el
> subdominio. Ante la duda, validar el config sin aplicarlo:
>
> ```bash
> docker run --rm \
>   -v $PWD/infra/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro \
>   -v /etc/letsencrypt:/etc/letsencrypt:ro \
>   nginx:alpine nginx -t
> ```

### 10. MongoDB Atlas — whitelist IP

En MongoDB Atlas → Network Access, asegurarse de que la IP elástica del EC2 (`terraform output public_ip`) esté en la whitelist. Si el EC2 fue recreado, la IP puede ser distinta.

---

## Operaciones del día a día

### Deployar cambios

```bash
git push origin main
```

Eso dispara el workflow. Mirar progreso en Actions.

**Deploy manual (sin push):** GitHub → Actions → "Build & Deploy to EC2" → Run workflow → branch `main`.

### Agregar o rotar un secreto

```bash
# Agregar
aws ssm put-parameter \
  --region us-east-1 \
  --name "/asis/api/NUEVA_VAR" \
  --value "valor-secreto" \
  --type SecureString

# Rotar
aws ssm put-parameter \
  --region us-east-1 \
  --name "/asis/api/JWT_SECRET" \
  --value "nuevo-valor" \
  --type SecureString \
  --overwrite
```

Luego re-deployar:
```bash
git commit --allow-empty -m "chore: rotate JWT_SECRET"
git push
```

### Ver logs

**CloudWatch (persistido 7 días):**
- Console → CloudWatch → Log groups → `/asis/api`, `/asis/ui`, `/asis/nginx`

**CLI:**
```bash
aws logs tail /asis/api --follow --region us-east-1
```

**En tiempo real desde el servidor:**
```bash
ssh -i ~/.ssh/<key>.pem ubuntu@asis.chat
cd ~/hivvo && docker compose logs -f api
```

### SSH al servidor

```bash
ssh -i ~/.ssh/<key>.pem ubuntu@asis.chat
```

### Estado de los contenedores

```bash
cd ~/hivvo
docker compose ps
docker compose logs --tail=100
```

### Reiniciar un servicio

```bash
docker compose restart api
docker compose restart nginx
```

---

## Troubleshooting

### El deploy falla con "no such file: api/.env"

El script de hidratación no corrió o el EC2 no tiene permisos.
```bash
ssh -i ~/.ssh/<key>.pem ubuntu@asis.chat
aws ssm get-parameters-by-path --path /asis/api --region us-east-1 --query 'Parameters[*].Name'
```
Si falla por permisos: verificar que la policy `hivvo-ssm-read` esté adjunta al role `hivvo-ec2-ses-role`.

### Nginx no arranca: certs ausentes o expirados

```bash
sudo ls /etc/letsencrypt/live/asis.chat/
# si está vacío: ver paso 9

# renovación manual:
sudo certbot renew
docker compose restart nginx
```

### Terraform quiere recrear el EC2

Si `terraform plan` muestra `# aws_instance.hivvo must be replaced`:
1. **No aplicar**.
2. Revisar qué atributo cambió (probablemente `ami`).
3. Si es el AMI y el `lifecycle { ignore_changes = [ami] }` está puesto, corré `terraform refresh` primero.
4. Si el replace es verdaderamente intencional, hay que eliminar `prevent_destroy` temporalmente y hacer un backup manual del `.env`, certs y cualquier otra cosa persistente antes.

### El servidor no responde

1. Ver en AWS Console que la instancia está `running`.
2. Probar SSH. Si falla: security group, disco lleno, kernel roto.
3. **Nunca `terraform destroy`** como respuesta a un problema.

---

## Costos estimados

| Recurso | Costo/mes |
|---|---|
| EC2 t3.small | ~$15 |
| Elastic IP (en uso) | $0 |
| Route53 hosted zone | $0.50 |
| SES (primeros 62K emails/mes) | $0 |
| CloudWatch Logs (1 GB/mes) | ~$0.50 |
| SSM Parameter Store (Standard) | $0 |
| MongoDB Atlas Free tier | $0 |
| **Total** | **~$16/mes** |

---

## Recuperación desde cero

Si hay que reconstruir todo:

1. `terraform apply` en [infra/terraform/](infra/terraform/) — levanta EC2 nuevo con AWS CLI preinstalado
2. Los secretos ya están en SSM (no hay que re-subirlos)
3. Disparar el workflow manual en GitHub Actions
4. Regenerar certs SSL (paso 9)
5. Verificar IP del EC2 en MongoDB Atlas whitelist
6. Abrir https://asis.chat
