# RSP Dashboard API - Production Dockerfile
# Python 3.11 + FastAPI + DuckDB

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Build context is Dashboard/ root; preserve server package at /app/server.
COPY server/pyproject.toml ./server/pyproject.toml

# Install Python dependencies using pip
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir ./server

# Copy application code
COPY VERSION ./VERSION
COPY server ./server

# Use Docker-specific settings
RUN cp /app/server/settings.docker.yaml /app/server/settings.yaml

# Create non-root user (UID/GID 1001) and data/log dirs owned by it.
# The container can still be started as root (legacy dev compose) by passing
# `user: "0:0"`; production compose pins `user: "1001:1001"`.
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --home-dir /app --shell /sbin/nologin app \
    && mkdir -p /app/data /app/logs \
    && chown -R 1001:1001 /app/data /app/logs

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DEBUG=false
ENV DATA_ROOT=/app/data
ENV LOG_DIR=/app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["python", "-m", "server"]

