FROM mcr.microsoft.com/devcontainers/base:bookworm

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
