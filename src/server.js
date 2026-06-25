import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 3200);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const dataDir = join(rootDir, "data");
const modelConfigPath = join(dataDir, "model-config.json");

const NODE_LIBRARY = {
  workflow_start: { type: "start", label: "开始", flow: "workflow", description: "工作流入口，声明外部调用时必须传入的变量。", helpDocUrl: "https://www.coze.cn/open/docs/guides/workflow_node" },
  chat_start: { type: "start", label: "开始", flow: "chatflow", description: "对话流入口，接收用户消息和会话上下文。", helpDocUrl: "https://www.coze.cn/open/docs/guides/chatflow_node" },
  llm: { type: "llm", label: "大模型", flow: "all", description: "负责理解、推理、改写、总结或生成结构化结果。", helpDocUrl: "https://www.coze.cn/open/docs/guides/llm_node" },
  knowledge_retrieval: { type: "knowledge", label: "知识库", flow: "all", description: "按关键词、实体或语义向量检索业务知识。", helpDocUrl: "https://www.coze.cn/open/docs/guides/knowledge_node" },
  intent_recognition: { type: "intent_recognition", label: "意图识别", flow: "chatflow", description: "把用户输入分流到不同业务路径。", helpDocUrl: "https://www.coze.cn/open/docs/guides/intent_node" },
  question: { type: "question", label: "问题", flow: "chatflow", description: "在关键信息不足时向用户补问。", helpDocUrl: "https://www.coze.cn/open/docs/guides/question_node" },
  condition: { type: "selector", label: "选择器", flow: "all", description: "按风险、完整度、意图或业务规则分支。", helpDocUrl: "https://www.coze.cn/open/docs/guides/condition_node" },
  code: { type: "code", label: "代码", flow: "all", description: "执行格式转换、评分、字段校验或自定义规则。", helpDocUrl: "https://www.coze.cn/open/docs/guides/code_node" },
  plugin: { type: "plugin", label: "插件", flow: "all", description: "调用外部系统、检索接口或业务工具。", helpDocUrl: "https://www.coze.cn/open/docs/guides/plugin_node" },
  database: { type: "database", label: "数据库", flow: "workflow", description: "读取或写入结构化业务数据。", helpDocUrl: "https://www.coze.cn/open/docs/guides/database_node" },
  variable_assign: { type: "variable", label: "变量", flow: "all", description: "把中间结果保存为后续节点可引用变量。", helpDocUrl: "https://www.coze.cn/open/docs/guides/variable_node" },
  loop: { type: "loop", label: "循环", flow: "all", description: "按条件重复执行一组节点，并声明最大次数和退出条件。", helpDocUrl: "https://www.coze.cn/open/docs/guides/loop_node" },
  merge: { type: "merge", label: "汇聚", flow: "all", description: "汇聚并行分支或多路结果，统一输出给下游节点。", helpDocUrl: "https://www.coze.cn/open/docs/guides/workflow_node" },
  batch: { type: "batch", label: "批处理", flow: "workflow", description: "对列表数据进行批量处理或逐项执行。", helpDocUrl: "https://www.coze.cn/open/docs/guides/workflow_node" },
  session: { type: "session", label: "会话管理", flow: "chatflow", description: "记录、读取或更新当前会话状态。", helpDocUrl: "https://www.coze.cn/open/docs/guides/chatflow_node" },
  long_term_memory: { type: "memory", label: "长期记忆", flow: "chatflow", description: "读取或更新用户长期偏好、标签和历史行为。", helpDocUrl: "https://www.coze.cn/open/docs/guides/chatflow_node" },
  human: { type: "human", label: "人工", flow: "all", description: "将异常、高风险或需要人工判断的任务转给人工处理。", helpDocUrl: "https://www.coze.cn/open/docs/guides/workflow_node" },
  card: { type: "card", label: "卡片画板", flow: "chatflow", description: "以卡片或画板形式组织交互式输出。", helpDocUrl: "https://www.coze.cn/open/docs/guides/chatflow_node" },
  output: { type: "output", label: "输出", flow: "all", description: "向用户或调用方输出结构化结果、文本或卡片内容。", helpDocUrl: "https://www.coze.cn/open/docs/guides/end_node" },
  planning: { type: "planning", label: "规划", flow: "all", description: "将复杂任务拆解为可执行子任务和依赖关系。", helpDocUrl: "https://www.coze.cn/open/docs/guides/llm_node" },
  agent: { type: "agent", label: "多智能体", flow: "all", description: "将明确分工的复杂任务交给多个智能体协同处理。", helpDocUrl: "https://www.coze.cn/open/docs/guides/llm_node" },
  answer: { type: "answer", label: "回复", flow: "chatflow", description: "面向用户输出最终答复。", helpDocUrl: "https://www.coze.cn/open/docs/guides/answer_node" },
  workflow_end: { type: "end", label: "结束", flow: "workflow", description: "工作流返回标准化结果。", helpDocUrl: "https://www.coze.cn/open/docs/guides/end_node" },
  chat_end: { type: "end", label: "结束", flow: "chatflow", description: "对话流完成并返回用户消息。", helpDocUrl: "https://www.coze.cn/open/docs/guides/end_node" }
};

const COZE_STANDARD_NODE_TYPES = Object.freeze([
  "开始",
  "大模型",
  "知识库",
  "意图识别",
  "问题",
  "选择器",
  "代码",
  "插件",
  "数据库",
  "变量",
  "循环",
  "汇聚",
  "批处理",
  "会话管理",
  "长期记忆",
  "人工",
  "卡片画板",
  "输出",
  "规划",
  "多智能体",
  "回复",
  "结束"
]);

const WORKFLOW_DESIGN_REFERENCE_PROMPT = String.raw`
# 角色
你是COZE平台资深工作流架构师，精通平台所有官方工作流节点的功能与组合逻辑，擅长结合反思、工具调用、规划、多智能体协同等设计思想，为不同业务场景构建高效、合规、可维护的自动化工作流。

# 技能
1. 熟练掌握COZE全品类官方节点：基础流程节点（开始、结束、条件分支、循环、汇聚）、智能处理节点（大模型、意图识别、问答、知识库）、数据链接节点（插件、数据库、代码、批处理）、状态记忆节点（变量、会话管理、长期记忆）、交互输出节点（人工、卡片画板、输出）。
2. 能够根据业务复杂度匹配最优流程模式：简单场景用串行流程，数据查询场景嵌入工具调用，复杂任务用规划节点拆解，分工明确时启用多智能体协同。
3. 精通知识库的场景化应用：可将售后服务话术、退换货政策等标准化内容嵌入知识库节点实现精准调用。
4. 擅长设计分层提示词体系：能撰写包含角色、目标、任务、输出、限制的完整系统提示词，结合用户长期记忆生成个性化用户提示词。
5. 具备严谨的变量管理能力：可设计清晰命名、作用域明确的变量实现节点间数据传递，确保流程数据流转可控。
6. 掌握分支逻辑设计原则：分支条件无重叠、覆盖所有可能场景，且始终设置兜底分支处理异常情况。

# 工作流
### 场景1：简单标准化问答（如售后服务话术查询）
1. 开始节点：触发流程，接收用户提问输入。
2. 变量节点：将用户提问存入 user_query 变量，同时调用长期记忆节点读取用户历史交互标签（如「老用户」「退换货咨询过」）存入 user_tag 变量。
3. 意图识别节点：输入 user_query，识别用户意图是否为「标准化话术查询」（如售后问候、常见问题解答）。
4. 条件分支节点：
   - 分支1（意图匹配）：调用知识库节点，传入 user_query + user_tag，匹配对应个性化话术（如对老用户使用专属问候语）。
   - 分支2（意图不匹配/兜底）：调用大模型节点，使用通用客服提示词生成回复，同时触发会话管理节点记录本次未匹配意图，用于后续知识库更新。
5. 输出节点：将回复内容以卡片形式输出给用户。
6. 结束节点：流程终止。

### 场景2：数据查询类任务（如订单物流状态查询）
1. 开始节点：触发流程，接收用户输入的「订单号」。
2. 变量节点：将订单号存入 order_id 变量，调用长期记忆节点读取用户绑定的手机号存入 user_phone 变量。
3. 插件节点：调用「物流查询插件」，传入 order_id + user_phone 获取物流数据，存入 logistics_data 变量。
4. 条件分支节点：
   - 分支1（插件返回有效数据）：调用大模型节点，将 logistics_data 整理成自然语言描述。
   - 分支2（插件调用失败/无数据）：调用人工节点，推送「订单物流查询异常」工单给客服，同时给用户输出「正在为您转接人工客服，请稍候」的提示。
5. 输出节点：将整理后的物流信息或人工转接提示输出给用户。
6. 结束节点：流程终止。

### 场景3：复杂多步任务（如定制旅行方案）
1. 开始节点：触发流程，接收用户旅行需求输入（如目的地、时间、预算、偏好）。
2. 变量节点：将用户需求存入 travel_demand 变量，调用长期记忆节点读取用户历史旅行偏好（如「喜欢小众景点」「不吃辛辣」）存入 user_preference 变量。
3. 规划节点：调用大模型将 travel_demand + user_preference 拆解为3个子任务：「目的地景点筛选」「住宿推荐」「行程规划」。
4. 并行节点：同时启动3条分支分别处理子任务：
   - 分支A：调用「景点查询插件」+ 知识库节点（小众景点库）筛选符合条件的景点，结果存入 spot_list 变量。
   - 分支B：调用「酒店预订插件」筛选符合预算与偏好的住宿，结果存入 hotel_list 变量。
   - 分支C：调用大模型结合 spot_list + hotel_list 生成每日行程，结果存入 daily_plan 变量。
5. 汇聚节点：整合 spot_list + hotel_list + daily_plan 变量数据。
6. 大模型节点：将整合后的数据整理成结构化的定制旅行方案，加入个性化备注（如根据用户偏好标注「小众景点」「无辣餐厅推荐」）。
7. 条件分支节点：
   - 分支1（用户确认方案）：调用输出节点发送最终方案，触发长期记忆节点更新用户旅行偏好标签。
   - 分支2（用户修改需求/兜底）：跳转回开始节点，接收用户新的需求输入，重新执行流程。
8. 结束节点：流程终止。

# 提示词设计流程
1. 系统提示词：每个智能处理节点（大模型、意图识别、规划、多智能体）必须包含「角色、目标、任务、输出、限制」五大要素。
2. 用户提示词：结合 user_tag、user_preference、长期记忆变量生成个性化用户提示词。
3. 提示词嵌入：系统提示词进入智能节点配置项，用户提示词通过变量传递。

# 输出要求
1. 工作流可视化描述要体现节点链路，并清楚标注并行、分支、循环和汇聚。
2. 提供提示词模板，标注变量占位符。
3. 输出变量说明，包含变量名、作用域、数据类型、来源和用途。
4. 输出分支逻辑矩阵，包含触发条件、处理节点、输出结果、兜底规则。

# 限制
1. 所有流程节点必须为COZE官方提供的节点，不得使用自定义或第三方非官方节点。
2. 每个节点仅承担单一职责，禁止将多任务合并到一个节点中处理。
3. 分支逻辑必须互斥无重叠，覆盖所有可能输入场景，且必须设置兜底分支。
4. 变量命名需清晰易懂，作用域明确，避免变量冲突。
5. 工作流设计需按需匹配复杂度：简单问答采用串行流程，不得过度引入规划或多智能体节点；仅当任务需明确分工时启用多智能体协同。
6. 系统提示词必须包含「角色、目标、任务、输出、限制」五大要素，用户提示词必须结合用户长期记忆体现个性化。
`;

const REQUIREMENT_CLARIFIER_PROMPT = String.raw`
# 角色
你是一位资深的COZE工作流方案设计专家，专注于通过精准的需求收集与分析，为用户定制适配性强、可落地的COZE工作流解决方案。

# 技能
- 精通COZE平台的核心功能、组件逻辑与工作流搭建规则。
- 具备敏锐的需求洞察能力，能快速识别用户需求中的信息缺口。
- 掌握高效的用户引导技巧，可通过精准提问补充关键信息，提问优先级聚焦于核心需求、应用场景、目标受众、功能要求、约束条件五大维度。
- 擅长将零散需求结构化转化为清晰的COZE工作流方案，确保方案贴合用户实际业务场景。

# 工作流
1. 接收用户提供的初始需求信息，初步梳理需求核心方向。
2. 评估需求信息的完整性：判断是否具备明确的应用场景、目标任务、功能要求、约束条件等关键要素，足以支撑生成可落地的COZE工作流方案。
3. 若信息不足，根据需求缺口优先级，依次提出针对性问题，提问总数不超过5个；若信息已足够，跳过此步骤。
4. 基于完整的需求信息，分析用户核心诉求，结合COZE平台能力，设计包含触发条件、组件配置、流转逻辑、输出效果的完整工作流方案。
5. 输出最终结果：若为追问阶段则列出问题；若为方案阶段则呈现结构化的工作流方案。

# 输出格式
- 需求不足时：以编号列表形式列出追问问题，每个问题简洁明确，聚焦关键信息补充。
- 需求足够时：采用结构化Markdown格式输出工作流方案，包含方案概述、触发条件、组件配置、流转逻辑、预期效果。

# 限制
- 追问问题总数严格控制在5个以内，避免无关或重复提问。
- 所有提问需围绕生成COZE工作流的核心要素展开，不得偏离需求主题。
- 工作流方案必须基于COZE平台的现有功能设计，不得提出平台不支持的功能需求。
- 方案需具备可操作性，避免过于抽象或无法落地的内容。
`;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const route = `${request.method} ${url.pathname}`;

    if (route === "GET /health") return sendJson(response, 200, { ok: true, service: "coze-workflow-tool", port });
    if (route === "POST /api/workflow/clarify") return sendJson(response, 200, await clarifyRequirement(await readJsonBody(request)));
    if (route === "POST /api/workflow/design") return sendJson(response, 200, await designWorkflow(await readJsonBody(request)));
    if (route === "GET /api/model-config") return sendJson(response, 200, await getModelConfig());
    if (route === "POST /api/model-config") return sendJson(response, 200, await saveModelConfig(await readJsonBody(request)));
    if (route === "POST /api/model-config/test") return sendJson(response, 200, await testModelConfig(await readJsonBody(request)));

    if (request.method === "GET") return serveStatic(url.pathname, response);

    sendJson(response, 404, { error: true, message: "Route not found" });
  } catch (error) {
    sendJson(response, 500, { error: true, message: error.message || "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`Coze workflow tool is running at http://localhost:${port}`);
});

async function clarifyRequirement(body) {
  const requirement = normalizeText(body.requirement || body.message || "");
  const answer = normalizeText(body.answer || "");
  const history = Array.isArray(body.history) ? body.history : [];
  const merged = [requirement, ...history.map((item) => item.answer || ""), answer].filter(Boolean).join("\n");
  const modelConfig = await getSecretModelConfig();

  if (isModelReady(modelConfig)) {
    try {
      const modelResult = await withTimeout(
        runRequirementClarifierModel(modelConfig, { requirement, answer, history, merged }),
        Number(process.env.CLARIFY_TIMEOUT_MS || 120000),
        "需求分析大模型超过 120 秒"
      );
      return normalizeClarifierResult(modelResult, merged);
    } catch (error) {
      const fallback = localClarifyRequirement(merged);
      return {
        ...fallback,
        source: "local_fallback",
        warning: `需求分析大模型失败，已回退本地追问：${error.message}`
      };
    }
  }

  return {
    ...localClarifyRequirement(merged),
    source: "local_rules",
    warning: "未配置完整大模型，当前使用本地追问规则。"
  };
}

function localClarifyRequirement(merged) {
  const missing = inferMissingFields(merged);

  if (!missing.length) {
    return {
      complete: true,
      refined_requirement: merged,
      message: "需求信息已经足够，可以进入方案设计。"
    };
  }

  const questions = missing.map(buildClarifyQuestion).slice(0, 5);
  return {
    complete: false,
    refined_requirement: merged,
    missing_fields: missing,
    questions,
    question: questions[0],
    message: "我还需要补充以下关键信息，确认后生成方案会更稳。"
  };
}

async function designWorkflow(body) {
  const requirement = normalizeText(body.requirement || body.refined_requirement || body.goal || "设计一个 Coze 工作流");
  const fallbackDesign = designWorkflowLocally(requirement);
  const modelConfig = await getSecretModelConfig();
  const startedAt = Date.now();
  const baseTrace = [
    { status: "done", label: "读取需求并构建 Coze 编排提示词" },
    { status: "done", label: "准备标准节点白名单和 JSON 输出约束" }
  ];

  if (isModelReady(modelConfig)) {
    try {
      const modelStartedAt = Date.now();
      const modelPayload = await withTimeout(
        runWorkflowDesignerModel(modelConfig, requirement, fallbackDesign),
        getWorkflowModelTimeoutMs(),
        `大模型生成超过 ${Math.round(getWorkflowModelTimeoutMs() / 1000)} 秒`
      );
      const design = normalizeModelDesign(modelPayload, requirement, fallbackDesign);
      return {
        ...design,
        model_elapsed_ms: Date.now() - modelStartedAt,
        generation_elapsed_ms: Date.now() - startedAt,
        generation_trace: [
          ...baseTrace,
          { status: "done", label: "已调用配置的大模型生成工作流蓝图" },
          { status: "done", label: "已解析模型返回 JSON" },
          { status: "done", label: "已校验 Coze 标准节点、变量、分支、并行和循环关系" }
        ]
      };
    } catch (error) {
      return {
        ...fallbackDesign,
        generation_source: "local_fallback",
        generation_warning: `大模型生成失败，已回退本地规则：${error.message}`,
        generation_elapsed_ms: Date.now() - startedAt,
        generation_trace: [
          ...baseTrace,
          { status: "warn", label: `大模型调用失败：${error.message}` },
          { status: "done", label: "已使用本地规则生成可用兜底蓝图" }
        ]
      };
    }
  }

  return {
    ...fallbackDesign,
    generation_source: "local_rules",
    generation_warning: "未启用或未完整配置大模型，当前使用本地规则生成。",
    generation_elapsed_ms: Date.now() - startedAt,
    generation_trace: [
      ...baseTrace,
      { status: "warn", label: "未找到完整模型配置，跳过大模型调用" },
      { status: "done", label: "已使用本地规则生成可用蓝图" }
    ]
  };
}

function designWorkflowLocally(requirement) {
  const flowType = inferFlowType(requirement);
  const solution = buildSolution(requirement, flowType);
  const nodes = buildNodes(requirement, flowType);
  const edges = buildEdges(nodes, requirement);

  return {
    title: inferTitle(requirement),
    goal: requirement,
    flow_type: flowType,
    coze_standard_node_types: COZE_STANDARD_NODE_TYPES,
    generation_source: "local_rules",
    solution,
    orchestration: { execution_model: normalizeExecutionModel(null, edges), nodes, edges },
    mermaid: buildMermaid(nodes, edges),
    coze_ai_prompt: buildCozePrompt(requirement, flowType, nodes, edges),
    coze_yml: buildCozeYaml({
      title: inferTitle(requirement),
      goal: requirement,
      flow_type: flowType,
      solution,
      orchestration: { execution_model: normalizeExecutionModel(null, edges), nodes, edges }
    })
  };
}

function buildSolution(requirement, flowType) {
  return {
    flow_type: flowType,
    target_audience: inferAudience(requirement),
    use_scenarios: inferScenarios(requirement),
    stages: [
      "需求输入与变量标准化",
      "意图、知识和业务规则判断",
      "生成结构化结果并返回给用户"
    ],
    solution_overview: [
      "先把用户输入转成稳定变量，避免后续节点直接依赖自然语言。",
      "再通过知识库、选择器、插件或数据库补齐业务依据。",
      "最后由回答或结束节点输出可直接落地的 Coze 工作流蓝图。"
    ]
  };
}

function buildNodes(requirement, flowType) {
  const isChat = flowType !== "workflow";
  const nodes = [
    createNode(isChat ? "chat_start" : "workflow_start", "start", "开始：需求入口", "接收用户原始需求、上下文和目标约束。"),
    createNode("llm", "normalize", "大模型：需求标准化", "把自然语言需求转成 task_type、keywords、constraints。")
  ];

  if (flowType !== "workflow") nodes.push(createNode("intent_recognition", "intent", "意图识别：需求分流", "识别用户需要方案设计、节点编排、提示词优化还是导出。"));
  if (needsKnowledge(requirement)) nodes.push(createNode("knowledge_retrieval", "knowledge", "知识库：业务资料检索", "检索 Coze 节点能力、业务知识和配置依据。"));
  if (needsExternalData(requirement)) nodes.push(createNode("plugin", "plugin", "插件：外部接口调用", "调用插件或接口获取外部数据。"));
  nodes.push(createNode("condition", "check", "选择器：完整度分支", "判断需求是否足够进入生成，缺失时进入补充信息分支。"));
  nodes.push(createNode("question", "question", "问题：补充信息", "向用户补问缺失的业务目标、输入输出或约束。"));
  nodes.push(createNode("code", "schema", "代码：结构整理", "整理节点输入输出字段，统一 JSON 结构。"));
  nodes.push(createNode("llm", "designer", "大模型：节点设计", "生成每个节点的配置、提示词、参数来源和说明。"));
  nodes.push(createNode("answer", "answer", "回复：结果展示", "把方案、流程图、节点设计和提示词展示给用户。"));
  nodes.push(createNode(isChat ? "chat_end" : "workflow_end", "end", "结束：返回结果", "返回最终设计结果和可复制蓝图。"));

  return nodes.map((node, index) => enrichNode(node, requirement, index));
}

function createNode(type, id, name, description) {
  const meta = NODE_LIBRARY[type];
  if (!meta) throw new Error(`Unsupported Coze node type: ${type}`);
  return {
    id,
    type: meta.type,
    internal_type: type,
    coze_node_type: meta.label,
    coze_node_flow: meta.flow,
    name,
    description,
    standard_description: meta.description,
    help_doc_url: meta.helpDocUrl
  };
}

function enrichNode(node, requirement, index) {
  const inputs = inferInputs(node);
  const outputs = inferOutputs(node);
  const promptConfig = buildPromptConfig(node, requirement, inputs, outputs);
  const codeConfig = buildCodeConfig(node, requirement, inputs, outputs);
  const knowledgeConfig = buildKnowledgeConfig(node, requirement);
  const { internal_type: internalType, ...publicNode } = node;

  return {
    ...publicNode,
    order: index + 1,
    execution_type: inferExecutionType(internalType || node.type),
    input_parameters: inputs,
    output_parameters: outputs,
    parameter_sources: inferParameterSources(node, inputs),
    prompt_config: promptConfig,
    code_config: codeConfig,
    knowledge_config: knowledgeConfig,
    prompt: promptConfig ? `${promptConfig.system_prompt}\n\n${promptConfig.user_prompt}` : "",
    node_explanation: buildNodeExplanation(node, inputs, outputs)
  };
}

function inferInputs(node) {
  const type = node.internal_type || node.type;
  const map = {
    workflow_start: [{ name: "requirement", type: "string", source: "external_input", required: true }],
    chat_start: [{ name: "user_message", type: "string", source: "user_input", required: true }, { name: "conversation_context", type: "array", source: "global_variable", required: false }],
    llm: [{ name: "normalized_requirement", type: "object", source: "upstream_node", required: true }],
    knowledge_retrieval: [{ name: "keywords", type: "array", source: "upstream_node", required: true }],
    intent_recognition: [{ name: "user_message", type: "string", source: "start_node", required: true }],
    condition: [{ name: "constraints", type: "object", source: "upstream_node", required: true }],
    question: [{ name: "missing_fields", type: "array", source: "condition_node", required: true }],
    plugin: [{ name: "query", type: "object", source: "upstream_node", required: true }],
    code: [{ name: "node_draft", type: "object", source: "upstream_node", required: true }],
    answer: [{ name: "workflow_blueprint", type: "object", source: "designer_node", required: true }],
    workflow_end: [{ name: "result", type: "object", source: "answer_node", required: true }],
    chat_end: [{ name: "reply", type: "string", source: "answer_node", required: true }]
  };
  return map[type] || [];
}

function inferOutputs(node) {
  const type = node.internal_type || node.type;
  const map = {
    workflow_start: [{ name: "requirement", type: "string", description: "原始业务需求" }],
    chat_start: [{ name: "user_message", type: "string", description: "用户当前消息" }],
    llm: [{ name: "structured_result", type: "object", description: "大模型结构化输出" }],
    knowledge_retrieval: [{ name: "knowledge_chunks", type: "array", description: "召回的知识片段" }],
    intent_recognition: [{ name: "intent", type: "string", description: "识别后的用户意图" }],
    condition: [{ name: "branch", type: "string", description: "pass 或 need_more_info" }],
    question: [{ name: "followup_question", type: "string", description: "补问信息" }],
    plugin: [{ name: "plugin_result", type: "object", description: "外部工具返回结果" }],
    code: [{ name: "workflow_schema", type: "object", description: "整理后的蓝图结构" }],
    answer: [{ name: "final_answer", type: "string", description: "面向用户的展示结果" }],
    workflow_end: [{ name: "workflow_result", type: "object", description: "工作流返回值" }],
    chat_end: [{ name: "chat_reply", type: "string", description: "对话最终回复" }]
  };
  return map[type] || [];
}

function inferParameterSources(node, inputs) {
  return inputs.map((item) => ({
    parameter: item.name,
    source_type: item.source,
    source_ref: item.source === "global_variable" ? "conversation_context" : item.source === "start_node" ? "start" : "previous_node",
    description: `从 ${item.source} 映射到 ${node.name} 的 ${item.name}`
  }));
}

function buildPromptConfig(node, requirement, inputs, outputs) {
  const type = node.internal_type || node.type;
  if (!isPromptNodeType(type)) return null;
  const inputNames = inputs.map((item) => `${item.name}: ${item.type}`).join("\n");
  const outputNames = outputs.map((item) => `${item.name}: ${item.type}`).join("\n");
  return {
    system_prompt: buildStructuredSystemPrompt(node, requirement, inputs, outputs),
    user_prompt: `业务目标：${requirement}\n\n节点职责：${node.description}\n\n输入参数：\n${inputNames || "无"}\n\n输出参数：\n${outputNames || "无"}\n\n请输出稳定、可被后续节点引用的结果。`,
    output_format: type === "answer" ? "自然语言，可附带结构化清单。" : "JSON 对象，字段名必须与输出参数一致。",
    model_recommendation: {
      model: type === "llm" ? "推理能力强、稳定输出 JSON 的模型" : "响应稳定、中文表达自然的模型",
      temperature: type === "llm" ? 0.2 : 0.4,
      reason: "节点需要稳定遵循变量约束，低温度更适合流程编排与结构化输出。"
    }
  };
}

function isPromptNodeType(type) {
  return ["llm", "answer", "question", "intent_recognition", "planning", "agent"].includes(type);
}

function buildStructuredSystemPrompt(node, requirement, inputs = [], outputs = [], existingPrompt = "") {
  const inputNames = inputs.map((item) => `${item.name}(${item.type})`).join("、") || "无显式输入";
  const outputNames = outputs.map((item) => `${item.name}(${item.type})`).join("、") || "按节点输出配置返回";
  const existingInstruction = normalizeText(existingPrompt);
  const reference = existingInstruction ? `\n\n可参考但不得违反以下原始提示词要求：\n${existingInstruction}` : "";
  return [
    "# 角色",
    `你是 Coze 工作流中的「${node.coze_node_type}」节点，节点名称为「${node.name}」。你负责在本节点边界内完成明确、单一的处理职责。`,
    "",
    "# 目标",
    `围绕业务需求「${requirement}」，完成本节点职责：${node.description}`,
    "",
    "# 任务",
    `1. 读取并理解上游输入变量：${inputNames}。`,
    "2. 严格按照节点职责处理信息，只完成当前节点应该承担的判断、生成、提问或回复工作。",
    "3. 保持输出字段、语义和格式稳定，确保下游节点可以直接引用。",
    "",
    "# 输出",
    `输出内容必须匹配节点输出参数：${outputNames}。若要求 JSON，必须返回可解析的 JSON 对象；若要求自然语言，必须结构清晰、语气符合业务场景。`,
    "",
    "# 限制",
    "1. 不编造输入变量中不存在的业务事实、订单状态、知识库内容或用户信息。",
    "2. 不越权处理其他节点职责，不把意图识别、知识查询、工具调用、最终回复等多个职责混在一起。",
    "3. 如果信息不足，必须明确指出缺失项或输出可被分支节点识别的状态。",
    "4. 输出必须简洁、稳定、可复用，避免无关解释和 Markdown 包裹 JSON。"
  ].join("\n") + reference;
}

function buildCodeConfig(node, requirement, inputs, outputs) {
  const type = node.internal_type || node.type;
  if (type !== "code") return null;
  return {
    language: "JavaScript",
    runtime: "Coze Code 节点",
    input_mapping: inputs.map((item) => ({
      variable: item.name,
      source: item.source,
      description: `从上游节点映射 ${item.name}，作为代码节点的入参。`
    })),
    output_mapping: outputs.map((item) => ({
      variable: item.name,
      description: `代码执行后返回 ${item.name}，供后续节点引用。`
    })),
    code: [
      "async function main({ node_draft = {}, requirement = '', knowledge_chunks = [] }) {",
      "  // 1. 统一输入，避免上游节点字段缺失导致后续引用报错。",
      "  const draft = typeof node_draft === 'object' && node_draft !== null ? node_draft : {};",
      "  const chunks = Array.isArray(knowledge_chunks) ? knowledge_chunks : [];",
      "",
      "  // 2. 将知识库召回内容整理成简短引用，方便大模型节点生成解释时引用。",
      "  const references = chunks.map((item, index) => ({",
      "    id: item.id || `ref_${index + 1}`,",
      "    title: item.title || item.name || '未命名知识片段',",
      "    summary: item.summary || item.content || item.text || ''",
      "  }));",
      "",
      "  // 3. 标准化工作流蓝图字段，确保前端、结束节点和后续节点都能稳定消费。",
      "  const workflow_schema = {",
      "    title: draft.title || 'Coze 工作流设计',",
      "    goal: draft.goal || requirement,",
      "    flow_type: draft.flow_type || 'workflow',",
      "    nodes: Array.isArray(draft.nodes) ? draft.nodes : [],",
      "    edges: Array.isArray(draft.edges) ? draft.edges : [],",
      "    references,",
      "    validation: {",
      "      has_nodes: Array.isArray(draft.nodes) && draft.nodes.length > 0,",
      "      has_edges: Array.isArray(draft.edges) && draft.edges.length > 0,",
      "      missing_fields: []",
      "    }",
      "  };",
      "",
      "  // 4. 轻量校验：缺少关键字段时写入 missing_fields，让条件节点或回答节点给出提示。",
      "  if (!workflow_schema.goal) workflow_schema.validation.missing_fields.push('goal');",
      "  if (!workflow_schema.nodes.length) workflow_schema.validation.missing_fields.push('nodes');",
      "",
      "  return { workflow_schema };",
      "}"
    ].join("\n"),
    comments: [
      "代码节点的核心职责是做字段整理和轻量校验，不建议在这里写复杂业务推理。",
      "如果上游有知识库检索结果，可以把片段压缩成 references，后续回答节点可引用来源。",
      "返回值必须是对象，并且字段名要与输出参数保持一致。"
    ],
    test_cases: [
      {
        name: "标准蓝图输入",
        input: { node_draft: { title: "新人入职助手", nodes: [{ id: "start" }], edges: [] }, requirement },
        expected: "返回 workflow_schema，保留 title、goal、nodes，并生成 validation 字段。"
      },
      {
        name: "空节点输入",
        input: { node_draft: {}, requirement },
        expected: "validation.missing_fields 包含 nodes。"
      }
    ]
  };
}

function buildKnowledgeConfig(node, requirement) {
  const type = node.internal_type || node.type;
  if (type !== "knowledge_retrieval") return null;
  const scenario = inferTitle(requirement);
  return {
    knowledge_base_name: `${scenario}知识库`,
    retrieval_mode: "语义检索 + 关键词检索",
    top_k: 5,
    score_threshold: 0.55,
    content_scope: [
      "业务流程说明：当前场景的标准处理流程、阶段、角色和交付物。",
      "制度/规则文档：判断条件、限制条件、风险规则、审批边界和兜底策略。",
      "话术与模板：面向用户、客户、员工或内部协作对象的标准表达模板。",
      "案例与 FAQ：常见问题、异常场景、边界案例和推荐处理方式。",
      "Coze 节点配置资料：相关节点的使用条件、输入输出变量和配置注意事项。"
    ],
    document_structure: [
      { field: "title", description: "文档标题，例如：新人入职 30 天计划模板" },
      { field: "category", description: "分类，例如：制度、流程、话术、FAQ、案例、节点配置" },
      { field: "scenario", description: "适用场景，例如：入职第 1 周、客户退款、销售跟进" },
      { field: "content", description: "正文内容，建议按步骤、规则、示例分段" },
      { field: "tags", description: "关键词标签，用于提升召回稳定性" },
      { field: "updated_at", description: "更新时间，便于判断内容是否过期" }
    ],
    sample_documents: buildKnowledgeSamples(requirement),
    maintenance_notes: [
      "每份文档只解决一个主题，避免把制度、话术和 FAQ 混在一篇里。",
      "高频问题和兜底规则要单独成文档，方便知识库稳定召回。",
      "涉及政策、价格、权限或审批的内容需要标注更新时间和负责人。",
      "上线前用 5 到 10 条真实用户问题测试召回结果，检查是否召回到正确分类。"
    ]
  };
}

function buildKnowledgeSamples(requirement) {
  if (/入职|新人|员工|HR|人事/.test(requirement)) {
    return [
      {
        title: "新人入职 30/60/90 天计划模板",
        category: "流程",
        content: "包含第 1 周融入任务、第 30 天能力熟悉、第 60 天独立承担任务、第 90 天复盘评估。",
        tags: ["入职", "30天", "60天", "90天", "计划"]
      },
      {
        title: "新员工常见风险与处理建议",
        category: "风险规则",
        content: "覆盖目标不清、直属上级沟通不足、跨部门协作受阻、试用期反馈缺失等风险信号和建议动作。",
        tags: ["风险", "试用期", "沟通", "反馈"]
      },
      {
        title: "入职沟通话术模板",
        category: "话术",
        content: "提供向直属上级确认目标、向导师请求反馈、向协作部门介绍自己的标准话术。",
        tags: ["话术", "直属上级", "导师", "协作"]
      }
    ];
  }
  if (/客服|售后|退款|工单|客户/.test(requirement)) {
    return [
      {
        title: "售后问题分类与处理规则",
        category: "流程",
        content: "包含退款、换货、物流延迟、质量问题、发票问题的判断条件和处理步骤。",
        tags: ["售后", "退款", "换货", "物流", "工单"]
      },
      {
        title: "客户安抚话术模板",
        category: "话术",
        content: "按轻微不满、强烈投诉、重复投诉三类场景提供安抚表达和升级说明。",
        tags: ["客服", "安抚", "投诉", "升级"]
      }
    ];
  }
  return [
    {
      title: "业务流程标准说明",
      category: "流程",
      content: "描述该业务从输入、判断、执行到输出的标准步骤，以及每一步需要的数据。",
      tags: ["流程", "标准", "输入", "输出"]
    },
    {
      title: "常见问题与兜底策略",
      category: "FAQ",
      content: "记录用户常见问题、缺失信息时的追问方式、系统失败时的兜底回复。",
      tags: ["FAQ", "追问", "兜底", "异常"]
    },
    {
      title: "输出模板与质量标准",
      category: "模板",
      content: "定义最终回答的结构、字段、语气、长度限制和质量检查标准。",
      tags: ["模板", "质量", "输出", "格式"]
    }
  ];
}

function buildNodeExplanation(node, inputs, outputs) {
  return {
    purpose: node.description,
    why_needed: `${node.name}用于保证流程在这一阶段有明确职责，避免把理解、判断、执行和输出混在一个节点里。`,
    how_to_configure: `在 Coze 中选择${node.coze_node_type}节点，按输入参数完成变量映射，再按输出参数声明后续节点要引用的字段。`,
    data_flow: `读取 ${inputs.map((item) => item.name).join("、") || "无显式输入"}，输出 ${outputs.map((item) => item.name).join("、") || "无显式输出"}。`,
    config_steps: [
      "确认上游节点已经输出本节点需要的变量。",
      "在 Coze 右侧配置面板完成变量引用和字段命名。",
      "使用一条真实样例跑通到本节点，检查输出字段是否稳定。",
      "把异常、缺字段或低置信度结果接到追问或兜底分支。"
    ],
    fallback_strategy: "如果节点执行失败，返回明确错误原因；如果信息不足，进入追问节点；如果外部依赖失败，保留人工处理或简化回答分支。",
    test_suggestions: [
      "标准输入：验证主链路完整输出。",
      "缺字段输入：验证追问或条件分支。",
      "边界输入：验证 JSON 字段和变量引用不漂移。"
    ]
  };
}

function buildEdges(nodes, requirement = "") {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const has = (id) => byId.has(id);
  const edges = [];
  const add = (from, to, label = "下一步", execution = "serial", condition = "") => {
    if (has(from) && has(to)) edges.push({ from, to, label, execution, condition });
  };
  const source = has("intent") ? "intent" : "normalize";
  add("start", "normalize");
  add("normalize", "intent");

  if (has("knowledge") && has("plugin")) {
    add(source, "knowledge", "并行检索知识库", "parallel", "需要同时获取业务规则或文档依据");
    add(source, "plugin", "并行调用插件", "parallel", "需要同时查询外部系统或接口数据");
    add("knowledge", "check", "检索结果汇合", "serial");
    add("plugin", "check", "接口结果汇合", "serial");
  } else if (has("knowledge")) {
    add(source, "knowledge");
    add("knowledge", "check");
  } else if (has("plugin")) {
    add(source, "plugin");
    add("plugin", "check");
  } else {
    add(source, "check");
  }

  add("check", "question", "信息不足", "branch", "缺少关键输入、低置信度或无法判断时进入问题节点");
  add("check", "schema", "信息完整", "branch", "输入完整且判断可以继续时进入结构整理");
  add("question", "check", "补充后重新判断", needsLoop(requirement) ? "loop" : "serial", "用户补充信息后回到选择器，最多追问 3 次或直到信息完整");
  add("schema", "designer");
  add("designer", "answer");
  add("answer", "end");
  return dedupeEdges(edges);
}

function buildMermaid(nodes, edges) {
  const lines = ["flowchart TD"];
  nodes.forEach((node) => lines.push(`  ${safeId(node.id)}["${node.name}<br/>${node.coze_node_type}"]`));
  edges.forEach((edge) => lines.push(`  ${safeId(edge.from)} -->|${edge.label}| ${safeId(edge.to)}`));
  return lines.join("\n");
}

function buildCozePrompt(requirement, flowType, nodes, edges) {
  return [
    "请在 Coze 中创建以下工作流/对话流。",
    `只能使用以下 Coze 标准节点类型：${COZE_STANDARD_NODE_TYPES.join("、")}。不要自造节点类型。`,
    `业务需求：${requirement}`,
    `流程类型：${flowType}`,
    "",
    "节点设计：",
    ...nodes.map((node) => `- ${node.name}（${node.coze_node_type}）：${node.description}；文档：${node.help_doc_url}`),
    "",
    "连线：",
    ...edges.map((edge) => `- ${edge.from} -> ${edge.to}：${edge.label}`)
  ].join("\n");
}

function buildCozeYaml(design) {
  const nodes = design.orchestration?.nodes || [];
  const edges = design.orchestration?.edges || [];
  const executionModel = design.orchestration?.execution_model || {};
  const payload = {
    version: "coze-workflow-blueprint/v1",
    import_note: "按 Coze 标准节点生成的 YAML 蓝图；如 Coze 官方导入器要求字段不同，请按官方 schema 做最后映射。",
    workflow: {
      name: design.title,
      type: design.flow_type,
      goal: design.goal
    },
    execution_model: executionModel,
    solution: design.solution || {},
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      coze_node_type: node.coze_node_type,
      name: node.name,
      description: node.description,
      inputs: node.input_parameters || [],
      outputs: node.output_parameters || [],
      parameter_sources: node.parameter_sources || [],
      prompt_config: node.prompt_config || undefined,
      code_config: node.code_config || undefined,
      knowledge_config: node.knowledge_config || undefined,
      layout: node.layout || { lane: 0, order: node.order || 1 }
    })),
    edges: edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      label: edge.label,
      execution: edge.execution || "serial",
      condition: edge.condition || ""
    }))
  };
  return toYaml(payload);
}

function toYaml(value, indent = 0) {
  const space = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value.map((item) => {
      if (isScalar(item)) return `${space}- ${yamlScalar(item)}`;
      const rendered = toYaml(item, indent + 2);
      return `${space}-\n${rendered}`;
    }).join("\n");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "");
    if (!entries.length) return "{}";
    return entries.map(([key, item]) => {
      if (isScalar(item)) return `${space}${key}: ${yamlScalar(item)}`;
      return `${space}${key}:\n${toYaml(item, indent + 2)}`;
    }).join("\n");
  }
  return `${space}${yamlScalar(value)}`;
}

function isScalar(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function yamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = String(value);
  if (!text) return "\"\"";
  if (/[\n\r]/.test(text)) return `|\n${text.split(/\r?\n/).map((line) => `  ${line}`).join("\n")}`;
  return JSON.stringify(text);
}

async function runWorkflowDesignerModel(config, requirement, fallbackDesign) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getWorkflowModelTimeoutMs());
  const response = await fetch(toChatUrl(config.base_url), {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.api_key}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: Number(config.temperature ?? 0.2),
      messages: [
        {
          role: "system",
          content: buildWorkflowDesignerSystemPrompt()
        },
        {
          role: "user",
          content: buildWorkflowDesignerUserPrompt(requirement, fallbackDesign)
        }
      ]
    })
  }).finally(() => clearTimeout(timeout));

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`模型接口返回 ${response.status}：${raw.slice(0, 240)}`);
  }

  const payload = JSON.parse(raw);
  const content = payload.choices?.[0]?.message?.content || payload.output_text || "";
  if (!content) throw new Error("模型没有返回可解析内容");
  return parseJsonObject(content);
}

async function runRequirementClarifierModel(config, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.CLARIFY_TIMEOUT_MS || 120000));
  const response = await fetch(toChatUrl(config.base_url), {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.api_key}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: Number(config.temperature ?? 0.2),
      messages: [
        {
          role: "system",
          content: [
            REQUIREMENT_CLARIFIER_PROMPT,
            "",
            "你必须只返回 JSON 对象，不要 Markdown，不要代码块。",
            "如果需求不足，complete=false，questions 一次性给出最多 5 个关键问题；后续不会再继续追问，所以要尽量覆盖核心需求、应用场景、目标受众、功能要求、约束条件。",
            "如果需求足够，complete=true，并给出 refined_requirement 和 markdown_solution。",
            "JSON 字段：complete(boolean), refined_requirement(string), missing_fields(array), questions(array), question(string), message(string), markdown_solution(string)。"
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "分析用户需求是否足以生成 Coze 工作流方案，并在不足时提出追问",
            requirement: payload.requirement,
            latest_answer: payload.answer,
            history: payload.history,
            merged_requirement: payload.merged,
            output_rules: [
              "追问问题总数严格控制在 5 个以内，并尽量一次性覆盖所有关键缺口",
              "问题聚焦核心需求、应用场景、目标受众、功能要求、约束条件",
              "问题必须简洁明确，不能偏离 Coze 工作流设计"
            ]
          })
        }
      ]
    })
  }).finally(() => clearTimeout(timeout));

  const raw = await response.text();
  if (!response.ok) throw new Error(`模型接口返回 ${response.status}：${raw.slice(0, 240)}`);
  const data = JSON.parse(raw);
  const content = data.choices?.[0]?.message?.content || data.output_text || "";
  if (!content) throw new Error("需求分析模型没有返回内容");
  return parseJsonObject(content);
}

function normalizeClarifierResult(result, merged) {
  const questions = normalizeQuestionList(result?.questions).slice(0, 5);
  const question = normalizeQuestionItem(result?.question) || questions[0] || "";
  const complete = Boolean(result?.complete) && !question;
  return {
    complete,
    refined_requirement: normalizeText(result?.refined_requirement) || merged,
    missing_fields: normalizeStringList(result?.missing_fields),
    questions,
    question,
    message: normalizeText(result?.message) || (complete ? "需求信息已经足够，可以进入方案设计。" : "我还需要补充以下关键信息。"),
    markdown_solution: normalizeText(result?.markdown_solution),
    source: "configured_model"
  };
}

function normalizeQuestionList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeQuestionItem).filter(Boolean);
}

function normalizeQuestionItem(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return normalizeText(value.question)
      || normalizeText(value.text)
      || normalizeText(value.content)
      || normalizeText(value.title)
      || normalizeText(value.prompt)
      || normalizeText(value.description);
  }
  return "";
}

function buildWorkflowDesignerSystemPrompt() {
  return [
    WORKFLOW_DESIGN_REFERENCE_PROMPT,
    "",
    "你现在必须基于以上角色、技能、流程模式、提示词设计流程和限制，为用户需求生成可被系统解析的 Coze 工作流 JSON 蓝图。",
    "不要套固定模板，要根据业务复杂度选择串行、并行、分支、循环、汇聚、规划或多智能体协同。",
    `只能使用这些 Coze 标准节点类型：${COZE_STANDARD_NODE_TYPES.join("、")}。`,
    "必须判断流程关系：该串行就串行，该并行就并行，需要选择器判断就写清分支条件，需要循环就写清循环条件和退出条件。",
    "必须输出完整方案和完整工作流编排，不要简化节点设计。",
    "每个节点都要给出完整职责、输入输出、参数来源、配置说明、兜底策略和测试建议。",
    "代码节点必须给出完整可复制 JavaScript 代码和注释说明。",
    "知识库节点必须给出完整知识库内容范围、字段结构、示例文档和维护建议。",
    "智能处理节点必须给出完整系统提示词、用户提示词、输出格式和模型建议。",
    "每个 system_prompt 必须使用 Markdown 分段，并且严格包含这 5 个一级标题：# 角色、# 目标、# 任务、# 输出、# 限制；缺一不可。",
    "不要把五要素写成一句话；每个标题下必须有可直接复制到 Coze 节点中的具体内容。",
    "必须输出完整变量说明表和分支逻辑矩阵。",
    "只返回 JSON 对象，不要 Markdown，不要代码块。"
  ].join("\n");
}

function buildWorkflowDesignerUserPrompt(requirement, fallbackDesign) {
  return JSON.stringify({
    task: "设计 Coze 工作流蓝图",
    mode: "full_blueprint",
    instruction: "请生成完整可落地的 Coze 工作流蓝图，不要简化。需要完整方案、完整节点编排、完整节点配置、完整提示词、完整代码节点实现、完整知识库设计、变量说明表和分支逻辑矩阵。",
    requirement,
    required_json_schema: {
      title: "string",
      goal: "string",
      flow_type: "workflow | chatflow | hybrid",
      solution: {
        target_audience: "string",
        use_scenarios: ["string"],
        stages: ["string"],
        solution_overview: ["string"],
        workflow_visual_description: "完整描述主链路，并说明并行/分支/循环/汇聚的变量传递逻辑",
        prompt_templates: [
          {
            scene: "场景名称",
            system_prompt_template: "完整模板，必须包含角色、目标、任务、输出、限制",
            user_prompt_template: "完整模板，必须结合长期记忆变量占位符，如 {{user_tag}}"
          }
        ],
        variable_table: [
          {
            name: "user_query",
            scope: "global | local",
            data_type: "string | object | array | number | boolean",
            source: "来源节点或输入",
            usage: "用途"
          }
        ],
        branch_logic_matrix: [
          {
            selector_node: "选择器节点 ID",
            condition: "互斥条件",
            target_node: "目标节点 ID",
            output_result: "输出结果",
            fallback_rule: "兜底规则"
          }
        ]
      },
      orchestration: {
        execution_model: {
          summary: "说明整体是串行、并行、分支、循环或混合结构",
          has_parallel: "boolean",
          has_branch: "boolean",
          has_loop: "boolean",
          parallel_notes: ["并行节点组和汇合方式"],
          branch_notes: ["每个选择器的判断条件"],
          loop_notes: ["循环触发条件、最大次数、退出条件"]
        },
        nodes: [
          {
            id: "stable_node_id",
            type: "start | llm | knowledge | intent_recognition | selector | question | plugin | code | database | variable | loop | merge | batch | session | memory | human | card | output | planning | agent | answer | end",
            coze_node_type: "开始 | 大模型 | 知识库 | 意图识别 | 问题 | 选择器 | 代码 | 插件 | 数据库 | 变量 | 循环 | 汇聚 | 批处理 | 会话管理 | 长期记忆 | 人工 | 卡片画板 | 输出 | 规划 | 多智能体 | 回复 | 结束",
            name: "标准类型：业务用途",
            description: "完整节点职责",
            input_parameters: ["完整输入参数列表"],
            output_parameters: ["完整输出参数列表"],
            parameter_sources: ["完整参数来源列表"],
            prompt_config: "大模型/问题/回复/意图识别/规划/多智能体节点必须填写完整提示词配置；system_prompt 必须包含 # 角色、# 目标、# 任务、# 输出、# 限制",
            code_config: "代码节点必须填写完整代码、注释、输入输出映射和测试样例",
            knowledge_config: "知识库节点必须填写完整知识库名称、内容范围、字段结构、示例文档和维护建议",
            node_explanation: {
              why_needed: "详细说明为什么需要",
              how_to_configure: "详细说明如何配置",
              data_flow: "详细说明数据流",
              config_steps: ["完整配置步骤"],
              fallback_strategy: "完整失败兜底策略",
              test_suggestions: ["完整测试建议"]
            },
            layout: { lane: 0, order: 1 }
          }
        ],
        edges: [
          {
            from: "source_node_id",
            to: "target_node_id",
            label: "连线说明",
            execution: "serial | parallel | branch | loop",
            condition: "分支或循环条件；串行可为空"
          }
        ]
      }
    },
    coze_standard_node_types: COZE_STANDARD_NODE_TYPES,
    fallback_reference: {
      title: fallbackDesign.title,
      flow_type: fallbackDesign.flow_type,
      node_types: fallbackDesign.orchestration.nodes.map((node) => node.coze_node_type)
    }
  });
}

function normalizeModelDesign(modelPayload, requirement, fallbackDesign) {
  const rawNodes = Array.isArray(modelPayload?.orchestration?.nodes) ? modelPayload.orchestration.nodes : [];
  const nodes = rawNodes.length
    ? rawNodes.map((node, index) => normalizeModelNode(node, requirement, index))
    : fallbackDesign.orchestration.nodes;
  const edges = normalizeModelEdges(modelPayload?.orchestration?.edges, nodes);
  const solution = normalizeModelSolution(modelPayload?.solution, fallbackDesign.solution);
  const executionModel = normalizeExecutionModel(modelPayload?.orchestration?.execution_model, edges);
  const flowType = ["workflow", "chatflow", "hybrid"].includes(modelPayload?.flow_type) ? modelPayload.flow_type : fallbackDesign.flow_type;

  const design = {
    title: normalizeText(modelPayload?.title) || fallbackDesign.title,
    goal: normalizeText(modelPayload?.goal) || requirement,
    flow_type: flowType,
    coze_standard_node_types: COZE_STANDARD_NODE_TYPES,
    generation_source: "configured_model",
    model_provider: "configured",
    solution,
    orchestration: { execution_model: executionModel, nodes, edges },
    mermaid: buildMermaid(nodes, edges),
    coze_ai_prompt: buildCozePrompt(requirement, flowType, nodes, edges)
  };
  return {
    ...design,
    coze_yml: buildCozeYaml(design)
  };
}

function normalizeModelNode(rawNode = {}, requirement, index) {
  const metaKey = normalizeCozeNodeKey(rawNode.coze_node_type || rawNode.type);
  const meta = NODE_LIBRARY[metaKey] || NODE_LIBRARY.llm;
  const baseNode = {
    id: safeNodeId(rawNode.id || `${meta.type}_${index + 1}`),
    type: meta.type,
    internal_type: metaKey,
    coze_node_type: meta.label,
    coze_node_flow: meta.flow,
    name: normalizeText(rawNode.name) || `${meta.label}：节点${index + 1}`,
    description: normalizeText(rawNode.description) || meta.description,
    standard_description: meta.description,
    help_doc_url: rawNode.help_doc_url || meta.helpDocUrl
  };
  const inputs = normalizeParameters(rawNode.input_parameters, inferInputs(baseNode));
  const outputs = normalizeParameters(rawNode.output_parameters, inferOutputs(baseNode));
  const promptConfig = normalizePromptConfig(rawNode.prompt_config, baseNode, requirement, inputs, outputs)
    || buildPromptConfig(baseNode, requirement, inputs, outputs);
  const codeConfig = normalizeCodeConfig(rawNode.code_config) || buildCodeConfig(baseNode, requirement, inputs, outputs);
  const knowledgeConfig = normalizeKnowledgeConfig(rawNode.knowledge_config) || buildKnowledgeConfig(baseNode, requirement);
  const explanation = normalizeExplanation(rawNode.node_explanation) || buildNodeExplanation(baseNode, inputs, outputs);
  const { internal_type: internalType, ...publicNode } = baseNode;

  return {
    ...publicNode,
    order: index + 1,
    layout: normalizeLayout(rawNode.layout, index),
    execution_type: inferExecutionType(internalType || baseNode.type),
    input_parameters: inputs,
    output_parameters: outputs,
    parameter_sources: Array.isArray(rawNode.parameter_sources) && rawNode.parameter_sources.length
      ? rawNode.parameter_sources
      : inferParameterSources(baseNode, inputs),
    prompt_config: promptConfig,
    code_config: codeConfig,
    knowledge_config: knowledgeConfig,
    prompt: promptConfig ? `${promptConfig.system_prompt}\n\n${promptConfig.user_prompt}` : "",
    node_explanation: explanation
  };
}

function normalizeModelEdges(rawEdges, nodes) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(rawEdges)
    ? rawEdges
        .map((edge) => ({
          from: safeNodeId(edge.from),
          to: safeNodeId(edge.to),
          label: normalizeText(edge.label) || normalizeText(edge.condition) || "下一步",
          execution: normalizeExecution(edge.execution),
          condition: normalizeText(edge.condition)
        }))
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to)
    : [];
  return edges.length ? edges : buildEdges(nodes);
}

function normalizeModelSolution(solution, fallbackSolution) {
  return {
    target_audience: normalizeText(solution?.target_audience) || fallbackSolution.target_audience,
    use_scenarios: normalizeStringList(solution?.use_scenarios, fallbackSolution.use_scenarios),
    stages: normalizeStringList(solution?.stages, fallbackSolution.stages),
    solution_overview: normalizeStringList(solution?.solution_overview, fallbackSolution.solution_overview),
    workflow_visual_description: normalizeText(solution?.workflow_visual_description),
    prompt_templates: normalizeObjectList(solution?.prompt_templates),
    variable_table: normalizeObjectList(solution?.variable_table),
    branch_logic_matrix: normalizeObjectList(solution?.branch_logic_matrix)
  };
}

function normalizeExecutionModel(rawExecutionModel, edges) {
  const executions = new Set(edges.map((edge) => edge.execution));
  return {
    summary: normalizeText(rawExecutionModel?.summary) || summarizeExecution(edges),
    has_parallel: Boolean(rawExecutionModel?.has_parallel ?? executions.has("parallel")),
    has_branch: Boolean(rawExecutionModel?.has_branch ?? executions.has("branch")),
    has_loop: Boolean(rawExecutionModel?.has_loop ?? executions.has("loop")),
    parallel_notes: normalizeStringList(rawExecutionModel?.parallel_notes),
    branch_notes: normalizeStringList(rawExecutionModel?.branch_notes),
    loop_notes: normalizeStringList(rawExecutionModel?.loop_notes)
  };
}

function summarizeExecution(edges) {
  const executions = new Set(edges.map((edge) => edge.execution));
  const parts = [];
  if (executions.has("serial")) parts.push("串行主链路");
  if (executions.has("parallel")) parts.push("并行处理");
  if (executions.has("branch")) parts.push("选择器分支");
  if (executions.has("loop")) parts.push("循环回路");
  return parts.length ? `本工作流包含：${parts.join("、")}。` : "本工作流以串行主链路为主。";
}

function normalizeCozeNodeKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const map = {
    start: "workflow_start",
    "开始": "workflow_start",
    llm: "llm",
    "大模型": "llm",
    knowledge: "knowledge_retrieval",
    knowledge_retrieval: "knowledge_retrieval",
    "知识库": "knowledge_retrieval",
    intent: "intent_recognition",
    intent_recognition: "intent_recognition",
    "意图识别": "intent_recognition",
    selector: "condition",
    condition: "condition",
    "选择器": "condition",
    "条件分支": "condition",
    "条件分支节点": "condition",
    question: "question",
    "问题": "question",
    "问答": "question",
    "问答节点": "question",
    code: "code",
    "代码": "code",
    plugin: "plugin",
    "插件": "plugin",
    database: "database",
    "数据库": "database",
    variable: "variable_assign",
    "变量": "variable_assign",
    loop: "loop",
    "循环": "loop",
    merge: "merge",
    "汇聚": "merge",
    batch: "batch",
    "批处理": "batch",
    session: "session",
    "会话管理": "session",
    memory: "long_term_memory",
    long_term_memory: "long_term_memory",
    "长期记忆": "long_term_memory",
    human: "human",
    "人工": "human",
    card: "card",
    "卡片画板": "card",
    output: "output",
    "输出": "output",
    planning: "planning",
    "规划": "planning",
    agent: "agent",
    "多智能体": "agent",
    answer: "answer",
    "回复": "answer",
    end: "workflow_end",
    "结束": "workflow_end"
  };
  return map[normalized] || "llm";
}

function normalizeParameters(value, fallback = []) {
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.map((item) => ({
    name: normalizeText(item.name) || "param",
    type: normalizeText(item.type) || "string",
    source: normalizeText(item.source) || normalizeText(item.source_type) || "",
    required: item.required !== false,
    description: normalizeText(item.description)
  }));
}

function normalizePromptConfig(config, node, requirement, inputs = [], outputs = []) {
  if (!config || typeof config !== "object") return null;
  const systemPrompt = normalizeText(config.system_prompt);
  return {
    system_prompt: hasCompletePromptSections(systemPrompt)
      ? systemPrompt
      : buildStructuredSystemPrompt(node, requirement, inputs, outputs, systemPrompt),
    user_prompt: normalizeText(config.user_prompt),
    output_format: normalizeText(config.output_format) || "JSON 对象",
    model_recommendation: {
      model: normalizeText(config.model_recommendation?.model) || "推理能力强、稳定输出 JSON 的模型",
      temperature: Number(config.model_recommendation?.temperature ?? 0.2),
      reason: normalizeText(config.model_recommendation?.reason) || "需要稳定遵循变量约束。"
    }
  };
}

function hasCompletePromptSections(prompt) {
  const text = normalizeText(prompt);
  return ["角色", "目标", "任务", "输出", "限制"].every((section) => text.includes(section));
}

function normalizeCodeConfig(config) {
  if (!config || typeof config !== "object") return null;
  return {
    language: normalizeText(config.language) || "JavaScript",
    runtime: normalizeText(config.runtime) || "Coze Code 节点",
    input_mapping: Array.isArray(config.input_mapping) ? config.input_mapping : [],
    output_mapping: Array.isArray(config.output_mapping) ? config.output_mapping : [],
    code: normalizeText(config.code),
    comments: normalizeStringList(config.comments),
    test_cases: Array.isArray(config.test_cases) ? config.test_cases : []
  };
}

function normalizeKnowledgeConfig(config) {
  if (!config || typeof config !== "object") return null;
  return {
    knowledge_base_name: normalizeText(config.knowledge_base_name) || "业务知识库",
    retrieval_mode: normalizeText(config.retrieval_mode) || "语义检索 + 关键词检索",
    top_k: Number(config.top_k || 5),
    score_threshold: Number(config.score_threshold || 0.55),
    content_scope: normalizeStringList(config.content_scope),
    document_structure: Array.isArray(config.document_structure) ? config.document_structure : [],
    sample_documents: Array.isArray(config.sample_documents) ? config.sample_documents : [],
    maintenance_notes: normalizeStringList(config.maintenance_notes)
  };
}

function normalizeExplanation(explanation) {
  if (!explanation || typeof explanation !== "object") return null;
  return {
    purpose: normalizeText(explanation.purpose),
    why_needed: normalizeText(explanation.why_needed),
    how_to_configure: normalizeText(explanation.how_to_configure),
    data_flow: normalizeText(explanation.data_flow),
    config_steps: normalizeStringList(explanation.config_steps),
    fallback_strategy: normalizeText(explanation.fallback_strategy),
    test_suggestions: normalizeStringList(explanation.test_suggestions),
    notes: normalizeStringList(explanation.notes)
  };
}

function normalizeLayout(layout, index) {
  return {
    lane: Number.isFinite(Number(layout?.lane)) ? Number(layout.lane) : 0,
    order: Number.isFinite(Number(layout?.order)) ? Number(layout.order) : index + 1
  };
}

function normalizeExecution(value) {
  const normalized = String(value || "").toLowerCase();
  if (["parallel", "branch", "loop", "serial"].includes(normalized)) return normalized;
  if (/并行/.test(value)) return "parallel";
  if (/判断|分支|选择/.test(value)) return "branch";
  if (/循环|回退|重试/.test(value)) return "loop";
  return "serial";
}

function normalizeStringList(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return fallback;
}

function normalizeObjectList(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item) => item && typeof item === "object");
}

function safeNodeId(value) {
  return String(value || "node").trim().replace(/[^\w-]/g, "_");
}

function parseJsonObject(content) {
  const text = String(content || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("模型返回不是 JSON 对象");
    return JSON.parse(match[0]);
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function getWorkflowModelTimeoutMs() {
  return Number(process.env.MODEL_TIMEOUT_MS || 45000);
}

async function getModelConfig() {
  if (!existsSync(modelConfigPath)) return publicModelConfig(defaultModelConfig());
  return publicModelConfig(JSON.parse(await readFile(modelConfigPath, "utf8")));
}

async function getSecretModelConfig() {
  if (!existsSync(modelConfigPath)) return defaultModelConfig();
  return JSON.parse(await readFile(modelConfigPath, "utf8"));
}

function isModelReady(config) {
  return Boolean(config?.base_url && config.api_key && config.model);
}

async function saveModelConfig(body) {
  await mkdir(dataDir, { recursive: true });
  const previous = existsSync(modelConfigPath) ? JSON.parse(await readFile(modelConfigPath, "utf8")) : defaultModelConfig();
  const nextApiKey = normalizeSecret(body.api_key ?? body.apiKey, previous.api_key);
  const config = {
    provider: body.provider || "openai-compatible",
    base_url: body.base_url || body.baseUrl || previous.base_url || "",
    api_key: nextApiKey,
    model: body.model || previous.model || "",
    temperature: Number(body.temperature ?? previous.temperature ?? 0.2),
    enabled: Boolean(body.enabled)
  };
  await writeFile(modelConfigPath, JSON.stringify(config, null, 2), "utf8");
  return publicModelConfig(config);
}

async function testModelConfig(body) {
  const previous = existsSync(modelConfigPath) ? JSON.parse(await readFile(modelConfigPath, "utf8")) : defaultModelConfig();
  const config = normalizeRuntimeModelConfig(body, previous);
  if (!config.base_url || !config.api_key || !config.model) return { ok: false, message: "请先填写 base_url、api_key 和 model。" };
  try {
    const response = await fetch(toChatUrl(config.base_url), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.api_key}` },
      body: JSON.stringify({
        model: config.model,
        temperature: Number(config.temperature ?? 0.2),
        messages: [{ role: "user", content: "请回复 ok" }]
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, message: `模型接口返回 ${response.status}：${detail.slice(0, 240)}` };
    }
    return { ok: true, message: "模型连接成功。" };
  } catch (error) {
    return { ok: false, message: `模型连接失败：${error.message}` };
  }
}

function defaultModelConfig() {
  return { provider: "openai-compatible", base_url: "", api_key: "", model: "", temperature: 0.2, enabled: false };
}

function publicModelConfig(config) {
  return { ...config, api_key: config.api_key ? "********" : "" };
}

function normalizeRuntimeModelConfig(body = {}, previous = defaultModelConfig()) {
  return {
    provider: body.provider || previous.provider || "openai-compatible",
    base_url: body.base_url || body.baseUrl || previous.base_url || "",
    api_key: normalizeSecret(body.api_key ?? body.apiKey, previous.api_key),
    model: body.model || previous.model || "",
    temperature: Number(body.temperature ?? previous.temperature ?? 0.2),
    enabled: Boolean(body.enabled ?? previous.enabled)
  };
}

function normalizeSecret(value, previousValue = "") {
  const nextValue = String(value || "").trim();
  if (!nextValue || /^\*+$/.test(nextValue)) return previousValue || "";
  return nextValue;
}

function inferMissingFields(text) {
  const missing = [];
  if (!/(目标|目的|为了|需要|生成|设计)/.test(text)) missing.push("business_goal");
  if (!/(输入|用户|来源|字段|数据)/.test(text)) missing.push("input");
  if (!/(输出|结果|返回|展示|报告|方案)/.test(text)) missing.push("output");
  return missing;
}

function buildClarifyQuestion(field) {
  const questions = {
    business_goal: "这个工作流最核心要解决的业务目标是什么？",
    input: "用户或系统会给这个工作流传入哪些输入字段？",
    output: "你希望最终输出什么结果，格式有什么要求？"
  };
  return questions[field] || "还有哪些关键约束需要补充？";
}

function inferFlowType(text) {
  if (/(对话|聊天|客服|追问|多轮)/.test(text)) return "chatflow";
  if (/(混合|先对话|再工作流|人工确认)/.test(text)) return "hybrid";
  return "workflow";
}

function inferTitle(text) {
  if (/入职|新人/.test(text)) return "入职助手工作流";
  if (/客服|售后/.test(text)) return "客服处理工作流";
  if (/内容|文案/.test(text)) return "内容生成工作流";
  return "Coze 工作流设计";
}

function inferAudience(text) {
  if (/HR|人事|入职|员工/.test(text)) return "HR、用人部门和新员工";
  if (/客服|用户|客户/.test(text)) return "客服团队和终端用户";
  return "业务运营、产品经理和自动化搭建人员";
}

function inferScenarios(text) {
  const scenarios = ["需求澄清", "自动化流程编排", "节点配置生成"];
  if (/知识库|文档/.test(text)) scenarios.push("知识库问答");
  if (/审批|风险|判断/.test(text)) scenarios.push("规则判断与风险分流");
  return scenarios;
}

function needsKnowledge(text) {
  return /(知识库|文档|制度|资料|手册|官网|帮助)/.test(text);
}

function needsExternalData(text) {
  return /(接口|插件|API|系统|数据库|查询|同步)/i.test(text);
}

function needsLoop(text) {
  return /(循环|反复|重新|重试|直到|最多.*次|追问|补充|信息不完整)/.test(text);
}

function dedupeEdges(edges) {
  const seen = new Set();
  return edges.filter((edge) => {
    const key = `${edge.from}->${edge.to}:${edge.execution}:${edge.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferExecutionType(type) {
  const map = {
    llm: "大模型",
    plugin: "插件",
    knowledge_retrieval: "知识库",
    code: "代码",
    condition: "选择器",
    intent_recognition: "意图识别",
    database: "数据库",
    variable_assign: "变量",
    loop: "循环",
    merge: "汇聚",
    batch: "批处理",
    session: "会话管理",
    long_term_memory: "长期记忆",
    human: "人工",
    card: "卡片画板",
    output: "输出",
    planning: "规划",
    agent: "多智能体"
  };
  return map[type] || "流程控制";
}

async function readJsonBody(request) {
  if (request.method === "GET") return {};
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "/workflow.html" : pathname;
  const normalizedPath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, normalizedPath);
  if (!filePath.startsWith(publicDir)) return sendText(response, 403, "Forbidden");
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    sendText(response, 404, "Not found");
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}

function setCorsHeaders(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type, authorization");
}

function toChatUrl(baseUrl) {
  const trimmed = String(baseUrl || "").replace(/\/$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function safeId(value) {
  return String(value).replace(/[^\w]/g, "_");
}
