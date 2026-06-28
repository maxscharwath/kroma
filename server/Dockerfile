# Multi-stage build for the LUMA media server.
#
# NOTE (Synology / other NAS): build or pull this image for your NAS CPU arch
# (linux/amd64 for Intel/AMD models, linux/arm64 for ARM models), e.g.
#   docker buildx build --platform linux/arm64 -t luma-server:arm64 .
# Media libraries are bind-mounted into the container and pointed at via the
# LUMA_MEDIA_DIRS env var (see `docker run` in the README).

# ---- Builder ----------------------------------------------------------------
FROM rust:1.81 AS builder
WORKDIR /app

# Cache dependencies separately from source for faster rebuilds.
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY . .
# Touch main so cargo recompiles with the real sources.
RUN touch src/main.rs && cargo build --release

# ---- Runtime ----------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

# ffmpeg provides ffprobe (metadata extraction); curl fetches TMDB lookups +
# artwork (src/metadata.rs, src/image.rs); webp provides cwebp for transcoding
# cached posters/backdrops to WebP.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl webp ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/luma-server /usr/local/bin/luma-server

# Defaults; override at runtime as needed.
ENV LUMA_HOST=0.0.0.0 \
    LUMA_PORT=4040 \
    LUMA_DATA_DIR=/data \
    RUST_LOG=luma_server=info,tower_http=info

VOLUME ["/data"]
EXPOSE 4040

ENTRYPOINT ["luma-server"]
