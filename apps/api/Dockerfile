# ============================================
# Huế Travel API — Multi-stage Dockerfile
# ============================================

# Stage 1: Build
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api ./cmd/server/

# Stage 2: Run
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata curl

COPY --from=builder /bin/api /bin/api
COPY --from=builder /app/internal/migration /app/migration

ENV TZ=Asia/Ho_Chi_Minh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/bin/api"]
