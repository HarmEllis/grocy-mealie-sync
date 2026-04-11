FROM mcr.microsoft.com/devcontainers/base:bookworm@sha256:4d49e42a3eda8a8fd8437ecd8830d50a9113dc0f3623226db5e5c10a2b156f1e

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      g++ \
      libsqlite3-dev \
      make \
      python3 \
      sqlite3 \
    && rm -rf /var/lib/apt/lists/*
