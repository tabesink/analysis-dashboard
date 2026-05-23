# docker-prod-deployment - Reference

Companion to [SKILL.md](SKILL.md). Contains the long-form templates and snippets the agent reads only when generating a fresh production stack.

## Starter docker-compose.prod.yml template

Replace `<service>`, `<image>`, `<port>`, `<HEALTH_PATH>` with project specifics.

```yaml
name: <project>-prod

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"

x-security-baseline: &security-baseline
  cap_drop: [ALL]
  security_opt:
    - no-new-privileges:true
  read_only: true

services:
  proxy:
    image: caddy:2.8.4-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - proxy_data:/data
      - proxy_config:/config
    networks: [edge_net, app_net]
    <<: *security-baseline
    cap_add: [NET_BIND_SERVICE]
    tmpfs: ["/tmp:size=32M,mode=1777"]
    pids_limit: 100
    healthcheck:
      test: ["CMD", "pgrep", "-x", "caddy"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging: *default-logging

  <service>:
    image: <image>:${IMAGE_TAG:?IMAGE_TAG must be set}
    restart: unless-stopped
    user: "1001:1001"
    networks: [app_net]
    volumes:
      - ./data/<service>:/app/data
    secrets:
      - app_secret
    environment:
      - APP_ENV=production
    command:
      - sh
      - -c
      - |
        export APP_SECRET="$$(cat /run/secrets/app_secret)"
        exec /app/start
    <<: *security-baseline
    tmpfs: ["/tmp:size=128M,mode=1777"]
    pids_limit: 256
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:<port><HEALTH_PATH>"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging: *default-logging

networks:
  edge_net:
    driver: bridge
  app_net:
    driver: bridge
    internal: true

volumes:
  proxy_data:
  proxy_config:

secrets:
  app_secret:
    file: ./secrets/app_secret
```

The `${IMAGE_TAG:?...}` syntax forces compose to fail loudly if `IMAGE_TAG` is unset, preventing accidental `:latest` deploys.

## Reverse proxy snippets

### Caddy (default)

```caddy
{
	auto_https disable_redirects
	admin off
}

:80 {
	redir https://{host}{uri} permanent
}

{$DOMAIN}:443 {
	tls internal              # or:  tls you@example.com   for public Let's Encrypt
	encode zstd gzip

	handle_path /api/* {
		reverse_proxy backend:8000
	}
	reverse_proxy frontend:3000

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "geolocation=(), microphone=(), camera=()"
		-Server
	}

	log { output stdout; format json }
}
```

### Nginx

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff"  always;
    add_header X-Frame-Options           "DENY"     always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    server_tokens off;

    client_max_body_size 100M;

    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### Traefik (compose labels, no separate config file needed for basics)

```yaml
services:
  traefik:
    image: traefik:v3.1
    command:
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.le.acme.email=you@example.com
      - --certificatesresolvers.le.acme.storage=/data/acme.json
      - --certificatesresolvers.le.acme.tlschallenge=true
    ports: ["80:80", "443:443"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_data:/data
    # NOTE: docker.sock here is read-only AND traefik runs in its own stack.
    # Do NOT do this in app containers.

  backend:
    labels:
      - traefik.enable=true
      - traefik.http.routers.api.rule=Host(`example.com`) && PathPrefix(`/api`)
      - traefik.http.routers.api.entrypoints=websecure
      - traefik.http.routers.api.tls.certresolver=le
      - traefik.http.middlewares.api-strip.stripprefix.prefixes=/api
      - traefik.http.routers.api.middlewares=api-strip
      - traefik.http.services.api.loadbalancer.server.port=8000
```

## Healthcheck cookbook

```yaml
# Python (any image with python on PATH)
test:
  - CMD
  - python
  - -c
  - "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

# Node alpine (built-in wget)
test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]

# Node distroless (no shell, no wget) - install a tiny health binary at build:
#   RUN go build -o /healthcheck ./cmd/healthcheck
test: ["CMD", "/healthcheck"]

# Go / static binary - bake into the image:
#   func main(){ resp,err := http.Get("http://127.0.0.1:8080/health"); ... os.Exit(0/1) }
test: ["CMD", "/app/healthcheck"]

# Java (HEAD request via java -jar)
test: ["CMD", "curl", "-fsS", "http://localhost:8080/actuator/health"]
# (Spring Boot images include curl; otherwise add a startup probe binary.)

# Ruby
test: ["CMD", "ruby", "-rnet/http", "-e", "exit Net::HTTP.get_response(URI('http://localhost:3000/up')).code=='200' ? 0 : 1"]

# PHP-FPM (no HTTP server in container) - check FPM socket
test: ["CMD-SHELL", "SCRIPT_NAME=/ping SCRIPT_FILENAME=/ping REQUEST_METHOD=GET cgi-fcgi -bind -connect 127.0.0.1:9000 | grep -q pong"]

# TCP-only fallback (no app-level liveness)
test: ["CMD", "nc", "-z", "localhost", "8080"]
```

## Bind-mount permission cheatsheet

When the container runs as a non-root UID and writes to a bind-mounted host directory, the host directory must be owned by that UID:

```bash
# Container runs as 1001:1001
sudo mkdir -p data/app-state data/app-logs
sudo chown -R 1001:1001 data/app-state data/app-logs
```

For named volumes, Docker handles ownership at first creation if the image's WORKDIR or VOLUME directive sets it correctly. Bind mounts do not get this treatment.

If the application runs an init step that needs to chown data on first boot, use an init sidecar:

```yaml
init:
  image: busybox:1.36
  user: "0:0"
  command: ["sh", "-c", "chown -R 1001:1001 /data && chmod 700 /data"]
  volumes: ["./data/app-state:/data"]
  restart: "no"
app:
  depends_on:
    init:
      condition: service_completed_successfully
  # ...
```

## Secret entrypoint pattern (full worked example)

For an app whose existing config reads `DATABASE_URL` and `API_KEY` from environment, with no source changes:

```yaml
services:
  app:
    image: myapp:1.4.2
    user: "1001:1001"
    secrets:
      - database_url
      - api_key
    command:
      - sh
      - -c
      - |
        set -eu
        export DATABASE_URL="$$(cat /run/secrets/database_url)"
        export API_KEY="$$(cat /run/secrets/api_key)"
        exec /app/start
    # ... rest of hardening per SKILL.md ...

secrets:
  database_url:
    file: ./secrets/database_url
  api_key:
    file: ./secrets/api_key
```

Notes:
- `set -eu` ensures the container fails fast if a secret file is missing.
- `$$` is required in compose YAML so a literal `$(...)` reaches the shell.
- The secret never appears in `docker inspect` output (which shows the `command` array but not the contents of `/run/secrets/*`).
- For images without a shell (distroless), build an entrypoint binary that performs the same export-and-exec, or use the `<NAME>_FILE` convention if the application supports it.

## Image pinning

```yaml
# Tag only - acceptable, allows minor/patch updates within the tag:
image: postgres:16.3-alpine

# Tag + digest - reproducible, what production should look like:
image: postgres:16.3-alpine@sha256:1234567890abcdef...

# Get the digest:
#   docker pull postgres:16.3-alpine
#   docker inspect --format='{{index .RepoDigests 0}}' postgres:16.3-alpine
```

For locally built images, the `IMAGE_TAG` build variable should be the application's semantic version, not `latest`. Build script should `docker tag` to both `:latest` (for convenience) and `:<version>` (for prod compose to reference).
