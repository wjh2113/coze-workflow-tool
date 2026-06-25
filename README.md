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
- 方案设计：生成流程类型、目标用户、阶段说明。
- 节点编排：生成 Coze 节点、输入输出参数、系统提示词、用户提示词、模型建议、节点解释和官方文档链接。
- 流程图：优先使用 Mermaid，失败时使用本地 SVG 兜底。
