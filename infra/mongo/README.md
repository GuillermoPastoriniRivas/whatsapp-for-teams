# MongoDB en el host compartido

Base de datos propia para producción, en la misma EC2 `t4g.small` que nginx y las APIs.

## Qué corre

- Contenedor `shared-mongo` (imagen `mongo:7`), red `shared-apps`, volumen `shared_mongo-data`.
- Puerto publicado solo en `127.0.0.1:27017`: no es accesible desde internet (el security group abre 22, 80 y 443). Para administrarla desde una máquina local se hace un túnel SSH.
- Límites: caché de WiredTiger en 0.25 GB y `mem_limit` de 768 MB. El host tiene 1,8 GB y también corre nginx, la API y la UI de quiero-menu y la API de fluws.

## Archivos

- `docker-compose.yml` se copia a `/opt/mongo/docker-compose.yml` en el host.
- `.env` (solo en el host, permisos 600) tiene `MONGO_ROOT_USERNAME` y `MONGO_ROOT_PASSWORD`.
- `backup.sh` se copia a `/opt/mongo/backup.sh` y lo corre un cron diario.

## Conectarse desde la máquina local

```
ssh -i ~/.ssh/hivvo-key.pem -L 27017:127.0.0.1:27017 ubuntu@<host>
```

Y después `mongodb://<usuario>:<password>@127.0.0.1:27017/<db>?authSource=admin`.

## Cadena de conexión para las apps

Las apps corren en la misma red de Docker, así que usan el nombre del contenedor:

```
mongodb://<usuario>:<password>@shared-mongo:27017/<db>?authSource=admin
```

Va en SSM, en `/quiero-menu/api` (parámetro `MONGODB_URI`). El host solo puede leer SSM, así que escribir el parámetro requiere las credenciales de AWS del dueño.

## Respaldos

- `backup.sh` hace `mongodump` completo comprimido y lo sube a `s3://fluws-backups-213407352322/mongo/`. Deja las últimas 3 copias en disco.
- Restaurar:

```
aws s3 cp s3://fluws-backups-213407352322/mongo/<archivo> /tmp/
docker exec -i shared-mongo mongorestore --username <u> --password <p> \
  --authenticationDatabase admin --archive --gzip --drop < /tmp/<archivo>
```

- Pendiente de hacer con las credenciales del dueño: bucket propio con reglas de retención y snapshots del disco EBS. Hoy el respaldo depende de un solo bucket y de este disco.
