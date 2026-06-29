# COZE 工作流生成工具

这是一个独立程序，不属于入职助手项目。

## 启动

```bash
npm start
```

默认端口：

```text
http://localhost:3200/workflow.html
```

模型配置页：

```text
http://localhost:3200/model-config.html
```

如需改端口：

```bash
PORT=3200 npm start
```

## 功能

- 需求沟通：判断是否需要追问。
- 方案设计：通过已配置的大模型生成流程类型、目标用户、阶段说明；生成失败时会报错，不返回本地兜底方案。
- 节点编排：生成 Coze 节点、输入输出参数、系统提示词、用户提示词、模型建议、节点解释和官方文档链接。
- 流程图：优先使用 Mermaid，失败时使用本地 SVG 兜底。

## 大模型生成策略

方案生成必须使用模型配置页中保存的大模型。服务会按阶段循环调用大模型：先生成方案概览和节点目录，再并发生成节点详情。单次调用超时、最大重试次数、重试间隔和节点详情并发数可通过 `.env` 配置：

```bash
MODEL_TIMEOUT_MS=120000
MODEL_MAX_ATTEMPTS=3
MODEL_RETRY_DELAY_MS=1500
MODEL_NODE_CONCURRENCY=3
```
