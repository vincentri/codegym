# CodeGym in a browser: `docker compose up`, then open http://localhost:8080.
# The image carries every language's toolchain, so Python, JavaScript, TypeScript, Go, Java, C++
# and Rust all work without installing anything on your computer.

# --- the UI, built to talk to the server over HTTP -----------------------------------------
FROM node:22-trixie-slim AS ui
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vite.config.ts ./
COPY apps/desktop/package.json apps/desktop/
COPY tools tools
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY apps/desktop apps/desktop
RUN cd apps/desktop && VITE_CODEGYM_BACKEND=http pnpm build

# --- the server ------------------------------------------------------------------------------
FROM rust:1-trixie AS server
WORKDIR /src
COPY . .
RUN --mount=type=cache,id=cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=cargo-target,target=/src/target \
    cargo build --release --locked -p codegym-server \
    && cp target/release/codegym-server /usr/local/bin/

# --- what runs: the server plus every language's toolchain ----------------------------------
# rust:1-trixie already has rustc, gcc/g++ and python3; Node, Java and Go come from their
# official images, so nothing is fetched from package mirrors.
FROM rust:1-trixie
COPY --from=node:22-trixie-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=eclipse-temurin:21-jdk /opt/java/openjdk /opt/java/openjdk
COPY --from=golang:1-trixie /usr/local/go /usr/local/go
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:/usr/local/go/bin:$PATH \
    GOCACHE=/tmp/go-cache \
    GOTOOLCHAIN=local \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo

RUN useradd --create-home --uid 1000 codegym && mkdir -p /data && chown codegym /data
COPY --from=server /usr/local/bin/codegym-server /usr/local/bin/codegym-server
COPY --from=ui /src/apps/desktop/dist /app/ui

USER codegym
ENV CODEGYM_ADDR=0.0.0.0:8080 \
    CODEGYM_DATA_DIR=/data \
    CODEGYM_UI_DIR=/app/ui
VOLUME /data
EXPOSE 8080
CMD ["codegym-server"]
