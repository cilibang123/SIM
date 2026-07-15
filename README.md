# SIM

SIM 是一个 SIM/eSIM 管理方向的合并源码仓库，当前先以 monorepo
方式收纳两套项目源码：

- `simadmin/`: 从 `3899/SimAdmin` 导入的源码。
- `vohive-collection/`: 从 VoHive collection 工作区导入的完整源码集合。

当前合并刻意保留两个项目的独立边界。每个子项目继续使用自己的构建文件、
依赖、运行假设和文档，方便先验证原项目能力，再逐步做更深层的架构融合。

## 目录

```text
simadmin/           SimAdmin 原项目源码
vohive-collection/  VoHive 及其本地依赖源码集合
```

## 常用入口

SimAdmin:

```bash
cd simadmin
```

VoHive collection:

```bash
cd vohive-collection
```

VoHive collection 的 Docker 构建入口保留在：

```bash
docker build -f Dockerfile.collection -t vohive-local .
```

## 后续融合方向

后续如果要真正合并为一个产品，建议按以下顺序推进：

1. 统一硬件发现与设备状态模型。
2. 抽象 SIM/eSIM 管理接口，先兼容 ModemManager/lpac 与 QMI/APDU 两种路径。
3. 再统一 WebUI、配置、Docker Compose 和运行时权限。
