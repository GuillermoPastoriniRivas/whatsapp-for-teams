# Hivvo — Guía de Deploy en AWS

## Arquitectura

```
Internet → Nginx (puerto 80/443)
              ├── /api/*      → API container (NestJS, puerto 3000)
              ├── /socket.io/ → API container (WebSocket)
              ├── /webhook    → API container (Meta webhook)
              └── /*          → UI container  (Next.js, puerto 3001)

MongoDB Atlas (externo) ← API container
```

Todo corre en **un solo EC2** con Docker Compose. La base de datos está en MongoDB Atlas (free tier).

---

## Prerequisitos

- [Terraform CLI](https://developer.hashicorp.com/terraform/install) instalado
- [AWS CLI](https://aws.amazon.com/cli/) configurado (`aws configure`)
- Cuenta de GitHub con el repo pusheado
- MongoDB Atlas cluster creado (free tier sirve)

---

## Paso 1: Crear Key Pair en AWS

```bash
# Crear key pair y guardar el .pem
aws ec2 create-key-pair \
  --key-name hivvo-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/hivvo-key.pem

chmod 400 ~/.ssh/hivvo-key.pem
```

---

## Paso 2: Levantar infraestructura con Terraform

```bash
cd infra/terraform

# Crear tu archivo de variables
cp terraform.tfvars.example terraform.tfvars
```

Editar `terraform.tfvars`:
```hcl
aws_region       = "us-east-1"
instance_type    = "t3.small"        # ~$15/mes
key_name         = "hivvo-key"
allowed_ssh_cidr = "TU_IP_PUBLICA/32" # curl ifconfig.me
app_name         = "hivvo"
```

```bash
terraform init
terraform plan      # revisar qué se va a crear
terraform apply     # escribir "yes" para confirmar
```

Terraform va a mostrar:
- `public_ip` — la IP elástica (usala para el DNS)
- `ssh_command` — el comando para conectarte

---

## Paso 3: Configurar el .env en el servidor

```bash
# Conectarte al EC2
ssh -i ~/.ssh/hivvo-key.pem ubuntu@<PUBLIC_IP>

# Esperar a que termine el user-data (primera vez tarda ~2 min)
tail -f /var/log/user-data.log

# Crear el directorio y el .env del API
mkdir -p ~/hivvo/api
nano ~/hivvo/api/.env
```

Contenido del `.env`:
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/hivvo?retryWrites=true&w=majority
JWT_SECRET=tu-secreto-jwt-seguro
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=otro-secreto-seguro
JWT_REFRESH_EXPIRES_IN=7d
META_API_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=tu-verify-token
PORT=3000
```

> Tip: Generá secrets seguros con `openssl rand -hex 32`

---

## Paso 4: Configurar GitHub Secrets

En tu repo de GitHub → Settings → Secrets and variables → Actions, agregar:

| Secret | Valor |
|--------|-------|
| `EC2_HOST` | La IP elástica del Paso 2 |
| `EC2_SSH_KEY` | Contenido completo del archivo `hivvo-key.pem` |
| `NEXT_PUBLIC_API_URL` | `https://tudominio.com` (o `http://<IP>` si todavía no tenés dominio) |

---

## Paso 5: Deploy automático

Simplemente hacé push a `main`:

```bash
git add .
git commit -m "setup deployment infrastructure"
git push origin main
```

GitHub Actions va a:
1. Buildear las imágenes Docker del API y UI
2. Copiarlas al EC2 como tarballs
3. Cargarlas en Docker y levantar los containers

Podés ver el progreso en la tab **Actions** de GitHub.

---

## Paso 6: Dominio y SSL

### Apuntar DNS
En tu registrador de dominio, crear un **A record**:
```
tudominio.com    → <PUBLIC_IP>
www.tudominio.com → <PUBLIC_IP>
```

### Configurar Nginx con tu dominio
```bash
ssh -i ~/.ssh/hivvo-key.pem ubuntu@<PUBLIC_IP>

# Editar la config de Nginx para poner tu dominio
nano ~/hivvo/infra/nginx/default.conf
# Cambiar "server_name _;" por "server_name tudominio.com www.tudominio.com;"

# Reiniciar Nginx
cd ~/hivvo && docker compose restart nginx
```

### Obtener SSL con Certbot
```bash
# Instalar certbot nginx plugin dentro del host (no en container)
# Opción: parar nginx container, correr certbot en el host, montar certs

# Parar el container de nginx temporalmente
cd ~/hivvo && docker compose stop nginx

# Obtener certificado
sudo certbot certonly --standalone -d tudominio.com -d www.tudominio.com

# Los certs quedan en /etc/letsencrypt/ que ya está montado en el container
# Reiniciar
docker compose up -d nginx
```

Después de obtener el SSL, actualizar `infra/nginx/default.conf` para HTTPS:

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tudominio.com www.tudominio.com;

    ssl_certificate     /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    # ... (mismas locations de arriba)
}
```

---

## Paso 7: MongoDB Atlas — Whitelist IP

En MongoDB Atlas → Network Access, agregar la IP elástica del EC2 para que el API pueda conectarse.

---

## Comandos útiles en el servidor

```bash
# Ver logs de todos los containers
cd ~/hivvo && docker compose logs -f

# Ver logs de un container específico
docker compose logs -f api
docker compose logs -f ui

# Reiniciar un servicio
docker compose restart api

# Rebuild manual (sin CI/CD)
docker compose build --no-cache
docker compose up -d

# Ver estado
docker compose ps
```

---

## Estructura de archivos creados

```
├── .github/workflows/deploy.yml    # CI/CD pipeline
├── api/
│   ├── Dockerfile                  # Build del NestJS API
│   ├── .dockerignore
│   └── .env.production.example     # Template de variables
├── ui/
│   ├── Dockerfile                  # Build del Next.js UI
│   └── .dockerignore
├── docker-compose.yml              # Orquestación de containers
└── infra/
    ├── nginx/default.conf          # Reverse proxy config
    └── terraform/
        ├── main.tf                 # EC2 + SG + EIP
        ├── variables.tf            # Variables de input
        ├── outputs.tf              # IP, instance ID, SSH command
        ├── user-data.sh            # Bootstrap script (Docker, certbot)
        └── terraform.tfvars.example
```

---

## Costos estimados (USD/mes)

| Recurso | Costo |
|---------|-------|
| EC2 t3.small | ~$15 |
| Elastic IP (en uso) | $0 |
| MongoDB Atlas Free | $0 |
| **Total** | **~$15/mes** |

> Nota: t3.micro ($8/mes) puede funcionar si el tráfico es bajo, pero con NestJS + Next.js + Nginx en Docker, t3.small es más cómodo.
