# Meltwater 项目债务与腾讯云生产可验证性审计

> 审计日期：2026-06-10  
> 本地工作区：`/Users/lute/project/Agent/product/data_achieve/meltwater`  
> 审计对象：本地 Meltwater 数据采集/解析项目、已生成 Excel 数据包、生产部署线索、腾讯云可观测入口  
> 审计结论：本地 Excel 转换结果可验证通过；采集链、工程化、文档治理和生产可观测性仍有明显债务；当前工作区无法证明腾讯云产品级生产状态。

## 1. 执行摘要

当前项目不是完整的线上产品仓库，而是 Meltwater VOC 数据采集、历史数据沉淀和 Excel 关系包生成项目。它已经具备一个可验证的全量 JSON 到 Excel 转换管线，但生产部署链没有出现在当前工作区。

已确认的健康部分：

- `data/excel_complete_20260604/` 数据包存在且验收状态为 `PASS`。
- `uv run --python 3.12 pytest -q` 返回 `19 passed`。
- `uv run --python 3.12 python -m meltwater_excel.cli validate --config config/excel_export_sources.json --output-dir data/excel_complete_20260604` 返回 `{"status": "PASS"}`。
- 6 份 XLSX 通过 Python ZIP 完整性检查。
- 随机回源抽检：120 个 occurrence、2,690 个数组元素，失败项 0。

主要债务集中在四个地方：

1. 老采集脚本仍可被误用，并保留日期语义、失败关闭、网络超时、去重和 Excel 公式注入问题。
2. 新转换管线可运行但工程化不足：非标准包导入 shim、无 Git 仓库、无 CI、ruff/mypy/bandit 不在默认门禁。
3. 项目文档分散且 README 与当前真实能力不一致。
4. 腾讯云生产状态不可验证：当前目录没有腾讯云部署配置、资源 ID、域名、region、健康检查或有效云凭据。

## 2. 事实边界

### 可验证事实

| 项 | 事实 |
|---|---|
| 项目类型 | Python 数据采集与 Excel 关系包生成项目 |
| 版本控制 | 当前目录不是 Git 仓库 |
| Python 环境 | `uv` 管理 Python 3.12.13 虚拟环境 |
| 依赖 | `ijson 3.5.0`、`openpyxl 3.1.5`、`pytest 9.0.3` |
| 测试 | 19 个测试通过 |
| 最终数据包 | 6 份 XLSX + `source_inventory.json` + `validation_manifest.json` |
| 原始数据规模 | 346,891 occurrence，336,288 unique document，6,865,075 array relation rows |
| 数据包权限 | `data/` 与 `data/excel_complete_20260604/` 为 `0700`，最终文件为 `0600` |
| Meltwater Secret | `.env` 存在且权限为 `0600` |
| 历史原始数据权限 | `exports_20260520/` 仍为 `0755` |

### 不可验证事实

| 项 | 状态 | 原因 |
|---|---|---|
| 腾讯云生产产品实例状态 | 不可验证 | 无 CVM/SCF/CLB/COS/CloudBase/TKE 资源 ID |
| 生产域名可用性 | 不可验证 | 当前项目未包含域名、DNS 或健康检查 URL |
| 生产部署版本 | 不可验证 | 无部署脚本、CI/CD、镜像 tag、发布记录 |
| 生产日志与监控 | 不可验证 | 无 CLS、云监控、告警策略配置 |
| 腾讯云账号资源清单 | 不可验证 | `tccli` 不存在；`coscli` 存在但配置为空，执行 `coscli ls` 返回 `secretID is missing` |

腾讯云公共健康看板可以访问，并显示页面会实时展示云服务可用性；但该看板只能说明云厂商公共服务状态，不等价于本产品生产实例健康状态。来源：[Tencent Cloud Health Dashboard](https://status.tencentcloud.com/)。

## 3. 当前项目结构判断

项目内存在两条不同成熟度的链路：

### 3.1 新链路：完整 JSON 到 Excel 转换管线

位置：

- `src/meltwater_excel/`
- `scripts/json_to_complete_excel.py`
- `config/excel_export_sources.json`
- `tests/`

当前能力：

- 流式读取 JSON。
- SQLite staging。
- canonical document 选择。
- 标量变体保留。
- 数组关系按 `occurrence_id + field_path + ordinal` 展开。
- Excel 公式风险转义。
- 超长文本 chunk。
- 高精度小数 raw + number 双列。
- 最终工作簿验收和随机回源抽检。

主要问题：

- 只覆盖已采集 JSON 到 Excel 的转换，不覆盖下一轮 API 补采。
- `pyproject.toml` 设置 `package = false`，同时用根目录 `meltwater_excel/__init__.py` shim 让 `python -m meltwater_excel.cli` 生效；这是可运行但非标准的导入方案。
- `build-all` 不支持从已有 staging 恢复，失败时需重新 staging。
- 缺少结构化进度日志，大数据构建时只能靠文件大小和进程状态判断进度。
- full baseline 写在代码校验里，适合当前固定数据包，不适合长期多批次数据产品。

### 3.2 老链路：Meltwater API 采集与旧 Excel 输出

位置：

- `scripts/collect.py`
- `scripts/analytics.py`

已知问题仍存在：

- 使用 `urllib.request.urlopen`，没有 timeout。
- 只捕获 `HTTPError`，没有处理 `URLError`、无效 JSON、连接超时。
- 批次超时后会继续发布部分结果。
- 日期区间语义不统一。
- 多搜索结果直接拼接，没有按 `document.id` 建立关系模型。
- `except:` 裸捕获仍存在。
- Excel 输出直接写外部文本，老产物曾出现公式化内容。
- `analytics.py --days 0` 风险未消除。

结论：老链路应进入“维护冻结”，只允许紧急补丁；新采集管线应单独重构，而不是继续扩展 `collect.py`。

## 4. 债务诊断

### 4.1 技术债务

| 编号 | 严重度 | 债务 | 证据 | 影响 |
|---|---|---|---|---|
| TD-01 | P0 | 老采集脚本不是失败关闭 | 历史审计已复现部分批次失败仍生成 Excel | 可能发布不完整数据 |
| TD-02 | P0 | 老脚本日期区间契约错误 | `--end` 直接作为 API end_date 00:00Z | 月报可能漏结束日 |
| TD-03 | P0 | 老脚本网络无 timeout | `collect.py`、`analytics.py` 直接 `urlopen` | 生产任务可能永久挂起 |
| TD-04 | P0 | 采集与转换模型割裂 | 新 `meltwater_excel` 只处理已下载 JSON | 下一轮 API 补采仍会回到旧风险链路 |
| TD-05 | P1 | 新管线导入方式非标准 | `pyproject.toml package=false` + shim package | CI/部署环境容易导入失败 |
| TD-06 | P1 | 类型门禁缺失 | `mypy` 当前 12 个错误 | 重构风险高 |
| TD-07 | P1 | lint 门禁缺失 | `ruff` 当前 37 个问题，其中多处来自非 UTF-8 识别和旧脚本风格问题 | 风格和语法质量不可控 |
| TD-08 | P1 | 安全扫描问题 | `bandit` 发现 9 个问题，其中 `urlopen` 与 XML 解析为中风险 | 供应链和不可信输入风险 |
| TD-09 | P1 | baseline 与固定批次耦合 | `checks.py` 内写死 346,891 等完整基线 | 下一批次复用需要改代码 |
| TD-10 | P2 | 大任务缺少进度事件 | 全量构建期间没有阶段性结构化进度输出 | 运维只能黑盒等待 |

### 4.2 工程债务

| 编号 | 严重度 | 债务 | 证据 | 影响 |
|---|---|---|---|---|
| ED-01 | P0 | 没有 Git 仓库 | `git rev-parse` 无结果 | 无变更历史、无回滚、无法 PR 审查 |
| ED-02 | P0 | 没有 CI/CD | 未发现 GitHub Actions、部署脚本、腾讯云流水线配置 | 质量依赖人工命令 |
| ED-03 | P1 | 无标准 check 命令 | 无 Makefile；`pytest` 可跑但 ruff/mypy/bandit 未纳入 | 门禁不可重复 |
| ED-04 | P1 | 目录内有生成缓存 | 43 个 `__pycache__`、336 个 `.pyc`、`.DS_Store` | 污染交付目录 |
| ED-05 | P1 | 数据与源码混放 | 1.6 GB 项目目录内同时有源码、原始数据、最终 Excel | 备份、同步、权限和迁移成本高 |
| ED-06 | P1 | 没有发布版本号 | 数据包、转换代码、配置没有统一 release manifest | 不能回答“哪个代码生成哪个产物” |
| ED-07 | P2 | `.venv` 缺少 pip | `python -m pip list` 不可用，需 `uv pip list` | 排障路径不符合常规 Python 预期 |

### 4.3 项目管理债务

| 编号 | 严重度 | 债务 | 证据 | 影响 |
|---|---|---|---|---|
| PM-01 | P0 | 生产定义不清 | 当前项目内无腾讯云产品边界、域名、资源 ID | 无法判断“生产最新状态” |
| PM-02 | P0 | 缺少资产清单 | 没有云资源、数据集、任务、密钥、负责人映射 | 事故时无法定位责任和影响面 |
| PM-03 | P1 | backlog 没有状态机 | `TODO.md` 记录缺口，但没有 owner、截止时间、验收标准 | 容易遗忘 API 缺口 |
| PM-04 | P1 | 缺少发布流程 | 没有 release checklist、rollback checklist | 数据产品交付靠个人记忆 |
| PM-05 | P2 | 缺少需求分层 | 数据采集、数据资产、线上产品部署被混在一个上下文里 | 计划难以拆分执行 |

### 4.4 文档管理债务

| 编号 | 严重度 | 债务 | 证据 | 影响 |
|---|---|---|---|---|
| DD-01 | P0 | README 与当前事实不一致 | README 仍强调旧 `collect.py` 和 45 列 Excel；当前新数据包为关系型 6 工作簿 | 新接手者会走错链路 |
| DD-02 | P1 | 文档入口分散 | 审计、Runbook、计划、TODO 分散，无总索引 | 信息检索成本高 |
| DD-03 | P1 | 生产运维文档缺失 | 无腾讯云部署、监控、恢复、权限文档 | 不能支撑生产值班 |
| DD-04 | P1 | 数据字典没有独立版本 | 字段字典在 Excel 和代码里，缺少 `schema-vX.md` | 下游消费方难追踪字段演进 |
| DD-05 | P2 | 历史决策未分层 | 6 月 4 日审计、计划、验收都存在，但缺少“当前推荐路径” | 后续执行可能重复踩旧链路 |

### 4.5 脆弱点债务

| 编号 | 严重度 | 脆弱点 | 证据 | 影响 |
|---|---|---|---|---|
| FR-01 | P0 | Meltwater 配额是单点约束 | 已知 429 restricted，缺口 255 次命中 | 补采无法按计划保证 |
| FR-02 | P0 | 腾讯云生产不可观测 | 无凭据、无资源清单、无健康检查 | 不能做真实生产审计 |
| FR-03 | P0 | 老数据目录权限过宽 | `exports_20260520/` 为 `0755` | 同机其他用户可遍历目录 |
| FR-04 | P1 | 生产与本地没有环境隔离模型 | `.env` 只含 Meltwater；无 dev/staging/prod 配置 | 容易把本地假设带到生产 |
| FR-05 | P1 | 云供应商状态未绑定业务指标 | 只能访问腾讯云公共健康看板 | 厂商正常不代表产品正常 |
| FR-06 | P1 | 大文件输出依赖本地磁盘 | 生成包约 505 MB，源数据约 1.6 GB | 磁盘和本地机器成为隐性依赖 |
| FR-07 | P2 | XLSX 是消费接口但不适合长期资产层 | 大量 sheet 分片、手工消费成本高 | 后续应沉淀 Parquet/SQLite/数据库资产 |

## 5. 腾讯云生产最新状态结论

当前只能确认三件事：

1. 腾讯云公共健康看板可访问，并提供实时云服务可用性事件入口。
2. 本机安装了 `coscli`，但配置为空；`coscli ls` 返回 `secretID is missing`。
3. 当前项目没有任何可用于定位腾讯云生产产品的部署配置或健康检查 URL。

因此，不能声称“腾讯云生产产品当前正常”或“异常”。缺少以下最小输入：

- 产品生产域名或健康检查 URL。
- 腾讯云 region。
- 服务类型：CVM、CLB、COS、SCF、TKE、CloudBase、云托管或其他。
- 资源 ID：实例 ID、负载均衡 ID、函数名、桶名、命名空间、镜像 tag。
- 只读 CAM 凭据或已配置 `tccli`/`coscli`。
- 生产部署记录和当前 release 标识。
- 业务级 SLO：可用性、延迟、错误率、数据新鲜度。

## 6. 优先级总览

| 优先级 | 目标 | 判断 |
|---|---|---|
| P0 | 建立生产事实源、冻结旧采集误用、收紧数据权限 | 先止血，避免继续产生不可审计结果 |
| P1 | 建立工程门禁和统一入口 | 让已通过的数据转换能力可持续维护 |
| P2 | 重构采集链为可靠 manifest 管道 | 解决下一轮 API 获取的真实风险 |
| P3 | 建立腾讯云生产观测与发布体系 | 让“生产最新状态”可被机器验证 |
| P4 | 数据资产长期化 | 从 Excel 交付走向可查询、可增量、可治理的数据资产 |

