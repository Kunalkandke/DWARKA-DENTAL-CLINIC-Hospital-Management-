# Deploying ml-service with Docker

## Prerequisites

- Docker Desktop (or Docker Engine on Linux)
- `app.pt` present in the `ml-service/` folder
- The Node backend's `ML_SERVICE_URL` env var pointed at this container's URL

---

## 1 — Build the image

Run from the **repository root** (so Docker can find `ml-service/` as the build context):

```bash
docker build -t dwarka-ml-service ./ml-service
```

Or from inside `ml-service/`:

```bash
docker build -t dwarka-ml-service .
```

The build has two stages:
- **builder** — installs Python wheels (gcc is available here)
- **runtime** — lean `python:3.11-slim` image with only the installed packages and `app.py` + `app.pt`

---

## 2 — Run locally

```bash
docker run --rm \
  -p 8000:8000 \
  -e ML_API_KEY=your-secret-key \
  -e ALLOWED_ORIGINS=http://localhost:5173,https://your-clinic.com \
  dwarka-ml-service
```

Test it:
```bash
curl http://localhost:8000/health
# → {"status":"ok","model_loaded":true,"classes":[...]}
```

---

## 3 — Environment variables

Pass all secrets at `docker run` time (never bake them into the image).

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8000` | Port uvicorn listens on |
| `MODEL_PATH` | No | `app.pt` | Path to weights, relative to `/app` inside the container |
| `IMGSZ` | No | `800` | Inference image size (must match training) |
| `CONF` | No | `0.28` | Confidence threshold |
| `MODEL_VERSION` | No | `yolo11m-dental-v1` | Version tag in every response |
| `ML_API_KEY` | No | _(none)_ | If set, every request except `/health` must send `x-api-key: <value>` |
| `ALLOWED_ORIGINS` | No | _(none)_ | Comma-separated CORS origins, e.g. `https://my-clinic.com` |

---

## 4 — Deploy to a cloud platform

### Railway / Render / Fly.io

These platforms detect the `Dockerfile` automatically.

1. Push `ml-service/` contents (including `app.pt`) to a repo or connect via CLI.
2. Set the environment variables listed above in the platform's dashboard.
3. The platform injects `PORT` automatically — the `CMD` already reads it.

### Docker Compose (run alongside the Node backend)

Add this service to your `docker-compose.yml` at the repo root:

```yaml
services:
  ml-service:
    build: ./ml-service
    ports:
      - "8000:8000"
    environment:
      ML_API_KEY: ${ML_API_KEY}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
    restart: unless-stopped

  backend:
    # ... your existing Node service
    environment:
      ML_SERVICE_URL: http://ml-service:8000
```

With Compose, the Node backend reaches the ML service via the internal hostname `ml-service` — no localhost needed.

---

## 5 — Security notes

- The container runs as a non-root user (`appuser`).
- `.env` files are excluded from the build context via `.dockerignore`.
- `ML_API_KEY` and `ALLOWED_ORIGINS` are runtime-only — they never appear in the image layers.
- `app.pt` **is** baked into the image (it is model weights, not a secret). If you prefer to mount it externally: remove the `COPY app.pt .` line from the Dockerfile and add `-v /path/to/app.pt:/app/app.pt` to your `docker run` command.

---

## 6 — Verify the deployment

```bash
# Health check — model_loaded must be true
curl https://your-deployed-url/health

# Quick prediction test
curl -X POST https://your-deployed-url/predict \
     -H "x-api-key: your-secret-key" \
     -F "file=@/path/to/xray.jpg"
```
