# 构建阶段 1: 前端构建 (Frontend)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY vohive/web/package*.json ./
RUN npm ci
COPY vohive/web/ .
RUN npm run build

# 构建阶段 2: 后端构建 (Backend)
FROM golang:1.24-alpine AS backend-builder
ARG GH_PAT=""
WORKDIR /app

# 启用 Go 工具链自动下载
ENV GOTOOLCHAIN=auto
ENV GOPRIVATE=github.com/iniwex5/*
ENV GONOSUMDB=github.com/iniwex5/*

# 安装构建依赖
RUN apk add --no-cache git

# 配置 Git 以支持拉取私有库
RUN if [ -n "${GH_PAT}" ]; then git config --global url."https://x-access-token:${GH_PAT}@github.com/iniwex5/".insteadOf "https://github.com/iniwex5/"; fi

# 复制 go mod 文件
COPY vohive/go.mod vohive/go.sum ./
COPY netlink /deps/netlink
COPY quectel-qmi-go /deps/quectel-qmi-go
COPY swu-go /deps/swu-go
COPY euicc-go /deps/euicc-go
COPY uicc-go /deps/uicc-go
COPY vowifi-go /deps/vowifi-go
COPY qqbot /deps/qqbot

RUN go mod edit -replace github.com/iniwex5/netlink=/deps/netlink && \
    go mod edit -replace github.com/iniwex5/quectel-qmi-go=/deps/quectel-qmi-go && \
    go mod edit -replace github.com/iniwex5/swu-go=/deps/swu-go && \
    go mod edit -replace github.com/iniwex5/vowifi-go=/deps/vowifi-go && \
    go mod edit -replace github.com/iniwex5/qqbot=/deps/qqbot && \
    go mod edit -replace github.com/damonto/euicc-go=/deps/euicc-go && \
    go mod edit -replace github.com/damonto/uicc-go=/deps/uicc-go && \
    go mod download

# 复制源代码 (不包含 internal/web/dist，这将在下一步从前端构建阶段复制)
COPY vohive/ .
RUN go mod edit -replace github.com/iniwex5/netlink=/deps/netlink && \
    go mod edit -replace github.com/iniwex5/quectel-qmi-go=/deps/quectel-qmi-go && \
    go mod edit -replace github.com/iniwex5/swu-go=/deps/swu-go && \
    go mod edit -replace github.com/iniwex5/vowifi-go=/deps/vowifi-go && \
    go mod edit -replace github.com/iniwex5/qqbot=/deps/qqbot && \
    go mod edit -replace github.com/damonto/euicc-go=/deps/euicc-go && \
    go mod edit -replace github.com/damonto/uicc-go=/deps/uicc-go

# 复制构建好的前端资源到 internal/web/dist 以便嵌入
# 必须在 go build 之前完成
COPY --from=frontend-builder /app/web/dist ./internal/web/dist/

# 验证前端资源已复制
RUN ls -la internal/web/dist/ && echo "Frontend assets copied successfully"

# 整理依赖并编译二进制
RUN go mod tidy
RUN VERSION=$(git describe --tags --always --dirty || echo "unknown") && \
    BUILD_TIME=$(date "+%Y-%m-%d %H:%M:%S") && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -buildvcs=false -tags "with_utls nomsgpack" -ldflags "-s -w -X 'github.com/iniwex5/vohive/internal/global.Version=${VERSION}' -X 'github.com/iniwex5/vohive/internal/global.BuildTime=${BUILD_TIME}'" -o vo-hive ./cmd/vohive

# 运行阶段 (Runtime)
FROM alpine:latest
WORKDIR /app

# 安装运行时依赖
# - ca-certificates / tzdata: 基础 HTTPS 与时区支持
# - kmod: 提供 modprobe，便于容器启动时触发宿主内核模块加载
RUN apk add --no-cache ca-certificates tzdata kmod

# 复制二进制文件
COPY --from=backend-builder /app/vo-hive .
COPY vohive/multi-modem-bind.sh /usr/local/sbin/multi-modem-bind.sh
COPY vohive/vohive-docker-entrypoint.sh /usr/local/bin/vohive-docker-entrypoint.sh

RUN chmod 0755 /usr/local/sbin/multi-modem-bind.sh /usr/local/bin/vohive-docker-entrypoint.sh

# 创建配置和数据目录
RUN mkdir -p config data logs

# 暴露端口 (API)
EXPOSE 7575

# 默认配置路径环境变量
ENV CONFIG_PATH=/app/config/config.yaml

# 入口点
ENTRYPOINT ["/usr/local/bin/vohive-docker-entrypoint.sh"]
CMD ["-c", "/app/config/config.yaml"]
