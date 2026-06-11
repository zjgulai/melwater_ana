# Quality Gates Runbook

本项目的质量门禁分为数据正确性、代码质量、类型检查和安全扫描四组。所有命令都从项目根目录执行。

## 常用命令

| 命令 | 目的 |
| --- | --- |
| `make test` | 运行单元测试 |
| `make validate` | 校验现有 Excel 数据包 |
| `make checksum` | 校验本地数据产物 checksum |
| `make lint` | 运行 ruff |
| `make type` | 运行 mypy |
| `make security` | 运行 bandit |
| `make quality` | 顺序运行全部门禁 |

## 验收标准

- `make test` 必须通过。
- `make validate` 必须返回 `{"status": "PASS"}`。
- `make checksum` 必须全部 `OK`。
- `make lint` 必须无 lint 错误。
- `make type` 必须无类型错误。
- `make security` 必须无未解释的中高风险问题。

## 生产状态相关限制

本地门禁只能证明当前数据处理包和代码质量。腾讯云生产状态仍依赖 `docs/production/tencent-cloud-inventory.md` 和私有 `config/production.json` 中的域名、资源 ID、地域、只读 CAM/COS/CLS/Monitor 权限。缺少这些信息时，不得把本地门禁通过解释为生产环境健康。

