FROM rust:alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM alpine
COPY --from=builder /app/target/release/codenames_backend /usr/local/bin/codenames_backend
EXPOSE 3001
CMD ["codenames_backend"]
