# ── Stage 1: dependency builder ───────────────────────────────────────────────
# Compile/install wheels in an isolated layer so the final image stays clean.
FROM python:3.11-slim AS builder

WORKDIR /build

# System libraries needed to build some wheels (e.g. numpy)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: runtime image ─────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# ----- OpenCV runtime dependencies -----
# opencv-python-headless still links against these shared libraries at runtime
# even though it ships its own libopencv*.so.  Without them the import fails
# with "libGL.so.1: cannot open shared object file" on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgomp1 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from the builder stage
COPY --from=builder /install /usr/local

# ----- App files -----
WORKDIR /app

# Copy only the files the service needs to run.
# The model weights file must exist in the build context (ml-service/app.pt).
COPY app.py        .
COPY app.pt        .

# ----- Non-root user (security best-practice) -----
RUN useradd --no-create-home --shell /bin/false appuser \
 && chown -R appuser:appuser /app
USER appuser

# ----- Runtime configuration -----
# All secrets (ML_API_KEY, ALLOWED_ORIGINS, …) are injected at container start
# via environment variables — never baked into the image.
#
# PORT defaults to 8000 but is overridden by the hosting platform (Railway,
# Render, Fly, etc.) automatically.
ENV PORT=8000 \
    MODEL_PATH=app.pt \
    IMGSZ=800 \
    CONF=0.28 \
    MODEL_VERSION=yolo11m-dental-v1

EXPOSE ${PORT}

# Use shell form so ${PORT} is expanded at container start, not build time.
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT}
