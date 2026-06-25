const state = {
  design: null,
  qaHistory: [],
  refinedRequirement: "",
  selectedNodeId: "",
  progressTimer: null,
  hasAskedClarifyingQuestions: false
};

const els = {
  tabs: document.querySelectorAll(".stage-tab"),
  panels: document.querySelectorAll(".stage-panel"),
  presetButtons: document.querySelectorAll(".preset-chip"),
  requirement: document.querySelector("#requirement"),
  clarify: document.querySelector("#clarify"),
  generate: document.querySelector("#generate"),
  generationProgress: document.querySelector("#generation-progress"),
  chatLog: document.querySelector("#chat-log"),
  status: document.querySelector("#status"),
  solutionEmpty: document.querySelector("#solution-empty"),
  solutionContent: document.querySelector("#solution-content"),
  solutionSummary: document.querySelector("#solution-summary"),
  solutionStages: document.querySelector("#solution-stages"),
  solutionOverview: document.querySelector("#solution-overview"),
  goOrchestration: document.querySelector("#go-orchestration"),
  orchestrationEmpty: document.querySelector("#orchestration-empty"),
  orchestrationContent: document.querySelector("#orchestration-content"),
  executionSummary: document.querySelector("#execution-summary"),
  diagram: document.querySelector("#diagram"),
  selectedNode: document.querySelector("#selected-node"),
  nodes: document.querySelector("#nodes"),
  json: document.querySelector("#json"),
  yaml: document.querySelector("#yaml")
};

if (window.mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      background: "#fbf7ef",
      primaryColor: "#fffaf2",
      primaryTextColor: "#2f261f",
      primaryBorderColor: "#6d4c35",
      lineColor: "#76685c",
      fontFamily: "Noto Serif SC, serif"
    }
  });
}

els.tabs.forEach((tab) => tab.addEventListener("click", () => switchStage(tab.dataset.stage)));
els.presetButtons.forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.requirement)));
els.clarify.addEventListener("click", onClarify);
els.requirement.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    onClarify();
  }
});
els.generate.addEventListener("click", onGenerate);
els.goOrchestration.addEventListener("click", () => switchStage("orchestration"));

async function onClarify() {
  const requirement = els.requirement.value.trim();
  if (!requirement) return setStatus("请先输入业务需求。");

  addChatMessage("你", requirement);
  els.requirement.value = "";

  if (state.hasAskedClarifyingQuestions) {
    state.refinedRequirement = [state.refinedRequirement, requirement].filter(Boolean).join("\n");
    state.qaHistory.push({ question: "用户补充需求", answer: requirement });
    addChatMessage("系统", "已收到你的补充需求。我不会继续追加追问，你可以直接生成方案。");
    addDecisionOptions("是否现在直接生成方案？");
    els.generate.disabled = false;
    setStatus("已收到补充需求，可以直接生成方案。");
    return;
  }

  setBusy(true, "正在分析需求...");

  try {
    const result = await postJson("/api/workflow/clarify", {
      requirement,
      history: state.qaHistory
    });
    state.refinedRequirement = result.refined_requirement || requirement;
    renderClarification(result, requirement);
  } catch (error) {
    setStatus(error.message || "需求分析失败。");
  } finally {
    setBusy(false);
  }
}

function renderClarification(result, submittedRequirement = "") {
  if (result.complete) {
    addChatMessage("系统", getDisplayText(result.markdown_solution) || getDisplayText(result.message) || "需求已完整，可以生成方案。");
    addDecisionOptions("需求已经比较清楚，你想现在生成方案，还是继续补充需求？");
    els.generate.disabled = false;
    setStatus("需求信息足够，点击“生成方案”。");
    return;
  }

  const questions = Array.isArray(result.questions) && result.questions.length
    ? result.questions.map(getDisplayText).filter(Boolean)
    : [getDisplayText(result.question) || "请补充更多业务约束。"];
  const question = questions[0];
  state.hasAskedClarifyingQuestions = true;
  state.qaHistory.push({ question, answer: submittedRequirement });
  addChatMessage("系统", questions.map((item, index) => `${index + 1}. ${item}`).join("\n"));
  if (questions.length >= 5 || state.qaHistory.length >= 5) {
    addDecisionOptions("已经收集到 5 个关键问题。你可以回答这些问题后直接生成方案。");
  }
  els.requirement.placeholder = "在这里回答上面的问题，然后继续点击“分析需求 / 继续追问”。";
  els.generate.disabled = false;
  setStatus("如果你认为信息已经足够，也可以直接生成方案。");
}

function getDisplayText(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return getDisplayText(value.question)
      || getDisplayText(value.text)
      || getDisplayText(value.content)
      || getDisplayText(value.title)
      || getDisplayText(value.prompt)
      || getDisplayText(value.description);
  }
  return "";
}

async function onGenerate() {
  const currentInput = els.requirement.value.trim();
  const requirement = [state.refinedRequirement, currentInput].filter(Boolean).join("\n") || currentInput;
  if (!requirement) return setStatus("请先输入需求。");

  els.requirement.value = "";
  setBusy(true, "正在生成 Coze 工作流方案...");
  startGenerationProgress();
  try {
    state.design = await postJson("/api/workflow/design", { requirement });
    finishGenerationProgress(state.design);
    renderSolution(state.design);
    renderOrchestration(state.design);
    switchStage("solution");
    setStatus("方案已生成。");
  } catch (error) {
    failGenerationProgress(error);
    setStatus(error.message || "生成失败。");
  } finally {
    setBusy(false);
  }
}

function startGenerationProgress() {
  const startedAt = Date.now();
  const steps = [
    ["done", "读取需求并准备 Coze 编排提示词"],
    ["active", "调用大模型生成方案概览、节点目录和边关系"],
    ["pending", "按节点目录循环调用大模型生成节点详情"],
    ["pending", "校验 Coze 标准节点、变量、连线和系统提示词五要素"],
    ["pending", "渲染流程图、节点详情和提示词"]
  ];
  els.generationProgress.hidden = false;
  renderProgressSteps("生成进度", steps, "不会展示原始 COT；这里显示可见阶段、耗时和模型调用状态。");
  clearInterval(state.progressTimer);
  state.progressTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    renderProgressSteps("生成进度", steps, `大模型正在分阶段生成中，已等待 ${elapsed} 秒。`);
  }, 5000);
}

function finishGenerationProgress(design) {
  clearInterval(state.progressTimer);
  const trace = Array.isArray(design.generation_trace) && design.generation_trace.length
    ? design.generation_trace
    : [
        { status: "done", label: "需求解析完成" },
        { status: "done", label: "大模型已返回工作流 JSON" },
        { status: "done", label: "节点、变量、分支和循环关系已校验" },
        { status: "done", label: "页面渲染完成" }
      ];
  const subtitle = [
    "生成来源：已配置大模型",
    design.model_elapsed_ms ? `模型耗时：${Math.round(design.model_elapsed_ms / 1000)} 秒` : "",
    design.model_attempts ? `模型调用次数：${design.model_attempts}` : "",
    design.generation_warning || ""
  ].filter(Boolean).join("；");
  renderProgressSteps("生成完成", trace.map((item) => [item.status || "done", item.label || item.message || item]), subtitle);
}

function failGenerationProgress(error) {
  clearInterval(state.progressTimer);
  els.generationProgress.hidden = false;
  renderProgressSteps("生成失败", [["warn", error.message || "生成失败"]], "请检查模型配置或稍后重试。");
}

function renderProgressSteps(title, steps, subtitle = "") {
  els.generationProgress.innerHTML = `
    <div class="progress-title">${escapeHtml(title)}</div>
    ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
    <ol class="progress-steps">
      ${steps.map(([status, label]) => progressStepHtml(status, label)).join("")}
    </ol>
  `;
}

function progressStepHtml(status, label) {
  const statusText = {
    done: "已完成",
    active: "进行中",
    pending: "未开始",
    warn: "需注意"
  }[status] || "未开始";
  return `
    <li class="progress-step ${escapeAttr(status)}">
      <span class="progress-icon" aria-hidden="true"></span>
      <span class="progress-copy">
        <strong>${escapeHtml(statusText)}</strong>
        <span>${escapeHtml(label)}</span>
      </span>
    </li>
  `;
}

function renderSolution(design) {
  els.solutionEmpty.hidden = true;
  els.solutionContent.hidden = false;
  els.solutionSummary.innerHTML = [
    ["流程名称", design.title],
    ["流程类型", design.flow_type],
    ["目标用户", design.solution.target_audience],
    ["使用场景", design.solution.use_scenarios.join("、")]
  ].map(([label, value]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  els.solutionStages.innerHTML = design.solution.stages.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  els.solutionOverview.innerHTML = design.solution.solution_overview.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderOrchestration(design) {
  els.orchestrationEmpty.hidden = true;
  els.orchestrationContent.hidden = false;
  renderExecutionSummary(design.orchestration.execution_model);
  els.json.textContent = JSON.stringify(design, null, 2);
  els.yaml.textContent = design.coze_yml || "";
  els.nodes.innerHTML = design.orchestration.nodes.map(nodeDetailHtml).join("");
  els.nodes.querySelectorAll("[data-node-id]").forEach((card) => {
    card.addEventListener("click", () => selectNode(card.dataset.nodeId));
  });
  renderDiagram(design);
  selectNode(design.orchestration.nodes[0].id);
}

async function renderDiagram(design) {
  renderCozeDiagram(design);
}

function renderCozeDiagram(design) {
  const nodes = design.orchestration.nodes;
  const edges = design.orchestration.edges || [];
  const nodeWidth = 280;
  const nodeHeight = 76;
  const laneGap = 96;
  const rowGap = 56;
  const positions = resolveNodePositions(nodes, edges, nodeWidth, nodeHeight, laneGap, rowGap);
  const width = positions.width;
  const height = positions.height;
  const startY = 28;
  const parts = [`<svg class="coze-flow-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Coze 工作流节点编排">`];
  edges.forEach((edge) => {
    const from = positions.map.get(edge.from);
    const to = positions.map.get(edge.to);
    if (!from || !to) return;
    parts.push(edgePathHtml(edge, from, to, nodeWidth, nodeHeight));
  });
  nodes.forEach((node) => {
    const position = positions.map.get(node.id);
    const x = position?.x || (width - nodeWidth) / 2;
    const y = position?.y || startY;
    parts.push(`<g data-node-id="${escapeAttr(node.id)}" class="coze-flow-node" transform="translate(${x},${y})">`);
    parts.push(`<rect class="coze-node-card" width="${nodeWidth}" height="${nodeHeight}" rx="12" />`);
    parts.push(`<rect class="coze-node-icon" x="16" y="18" width="40" height="40" rx="10" />`);
    parts.push(`<text class="coze-node-icon-text" x="36" y="43" text-anchor="middle">${escapeSvg(nodeIcon(node.type))}</text>`);
    parts.push(`<text class="coze-node-title" x="70" y="32">${escapeSvg(node.name)}</text>`);
    parts.push(`<text class="coze-node-type" x="70" y="55">${escapeSvg(node.coze_node_type)} · ${escapeSvg(node.execution_type)}</text>`);
    parts.push(`<circle class="coze-node-dot" cx="${nodeWidth - 18}" cy="38" r="4" />`);
    parts.push("</g>");
  });
  parts.push("</svg>");
  els.diagram.innerHTML = parts.join("");
  bindDiagramClicks(design);
}

function renderExecutionSummary(executionModel) {
  if (!executionModel) {
    els.executionSummary.innerHTML = "";
    return;
  }
  const flags = [
    executionModel.has_parallel ? "包含并行" : "",
    executionModel.has_branch ? "包含判断分支" : "",
    executionModel.has_loop ? "包含循环" : ""
  ].filter(Boolean);
  els.executionSummary.innerHTML = `
    <p><strong>执行关系：</strong>${escapeHtml(executionModel.summary || "串行主链路")}</p>
    ${flags.length ? `<p>${flags.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</p>` : ""}
    ${executionNotes("并行说明", executionModel.parallel_notes)}
    ${executionNotes("判断说明", executionModel.branch_notes)}
    ${executionNotes("循环说明", executionModel.loop_notes)}
  `;
}

function executionNotes(title, items = []) {
  if (!items.length) return "";
  return `<p><strong>${escapeHtml(title)}：</strong>${items.map(escapeHtml).join("；")}</p>`;
}

function resolveNodePositions(nodes, edges, nodeWidth, nodeHeight, laneGap, rowGap) {
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const outgoingGroups = new Map();
  edges.forEach((edge) => {
    if (!outgoingGroups.has(edge.from)) outgoingGroups.set(edge.from, []);
    outgoingGroups.get(edge.from).push(edge);
  });
  const raw = nodes.map((node, index) => {
    const layout = node.layout || {};
    return {
      id: node.id,
      lane: Number.isFinite(Number(layout.lane)) ? Number(layout.lane) : 0,
      order: Number.isFinite(Number(layout.order)) ? Number(layout.order) : index + 1
    };
  });
  outgoingGroups.forEach((group, from) => {
    const meaningful = group.filter((edge) => edge.execution === "parallel" || edge.execution === "branch");
    if (meaningful.length < 2) return;
    meaningful.forEach((edge, index) => {
      const target = raw.find((item) => item.id === edge.to);
      const source = raw.find((item) => item.id === from);
      if (!target || !source || target.lane !== 0) return;
      target.lane = index - (meaningful.length - 1) / 2;
      target.order = Math.max(target.order, source.order + 1);
    });
  });
  const minLane = Math.min(...raw.map((item) => item.lane), 0);
  const maxLane = Math.max(...raw.map((item) => item.lane), 0);
  const maxOrder = Math.max(...raw.map((item) => item.order), nodes.length);
  const marginX = 52;
  const marginY = 28;
  const map = new Map();
  raw.forEach((item) => {
    map.set(item.id, {
      x: marginX + (item.lane - minLane) * (nodeWidth + laneGap),
      y: marginY + (item.order - 1) * (nodeHeight + rowGap)
    });
  });
  return {
    map,
    width: marginX * 2 + (maxLane - minLane + 1) * nodeWidth + (maxLane - minLane) * laneGap,
    height: marginY * 2 + maxOrder * nodeHeight + (maxOrder - 1) * rowGap
  };
}

function edgePathHtml(edge, from, to, nodeWidth, nodeHeight) {
  const startX = from.x + nodeWidth / 2;
  const startY = edge.execution === "loop" ? from.y + nodeHeight / 2 : from.y + nodeHeight;
  const endX = to.x + nodeWidth / 2;
  const endY = edge.execution === "loop" ? to.y + nodeHeight / 2 : to.y;
  const className = `coze-edge coze-edge-${escapeAttr(edge.execution || "serial")}`;
  const labelX = (startX + endX) / 2;
  const labelY = (startY + endY) / 2 - 8;
  const path = edge.execution === "loop"
    ? `M ${startX} ${startY} C ${startX - 120} ${startY}, ${endX - 120} ${endY}, ${endX} ${endY}`
    : `M ${startX} ${startY} C ${startX} ${startY + 34}, ${endX} ${endY - 34}, ${endX} ${endY}`;
  return [
    `<path class="${className}" d="${path}" />`,
    `<circle class="coze-port" cx="${startX}" cy="${startY}" r="4" />`,
    `<circle class="coze-port" cx="${endX}" cy="${endY}" r="4" />`,
    edge.label ? `<text class="coze-edge-label" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeSvg(edge.label)}</text>` : ""
  ].join("");
}

function renderFallbackDiagram(design) {
  renderCozeDiagram(design);
}

function bindDiagramClicks(design) {
  design.orchestration.nodes.forEach((node) => {
    const safeId = cssSafeId(node.id);
    const mermaidNode = els.diagram.querySelector(`#flowchart-${safeId}-0`) || els.diagram.querySelector(`[id*="${safeId}"]`);
    const fallbackNode = els.diagram.querySelector(`[data-node-id="${cssEscapeAttr(node.id)}"]`);
    [mermaidNode, fallbackNode].filter(Boolean).forEach((element) => {
      element.style.cursor = "pointer";
      element.addEventListener("click", () => selectNode(node.id));
    });
  });
}

function applyPreset(requirement) {
  els.requirement.value = requirement || "";
  state.refinedRequirement = "";
  state.qaHistory = [];
  state.hasAskedClarifyingQuestions = false;
  els.generate.disabled = false;
  setStatus("已填入预设场景，可以直接分析需求或生成方案。");
}

function nodeIcon(type) {
  const icons = {
    start: "S",
    llm: "AI",
    knowledge: "K",
    intent_recognition: "I",
    selector: "IF",
    question: "?",
    plugin: "P",
    code: "{}",
    database: "DB",
    variable: "V",
    loop: "LO",
    merge: "M",
    batch: "B",
    session: "S",
    memory: "M",
    human: "H",
    card: "C",
    output: "O",
    planning: "PL",
    agent: "AG",
    answer: "A",
    end: "E"
  };
  return icons[type] || "N";
}

function selectNode(nodeId) {
  const node = state.design?.orchestration.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  state.selectedNodeId = nodeId;
  els.selectedNode.innerHTML = nodeDetailHtml(node, true);
  document.querySelectorAll(".selected-diagram-node").forEach((item) => item.classList.remove("selected-diagram-node"));
  const safeId = cssSafeId(node.id);
  const graphNode = els.diagram.querySelector(`#flowchart-${safeId}-0`) || els.diagram.querySelector(`[id*="${safeId}"]`) || els.diagram.querySelector(`[data-node-id="${cssEscapeAttr(node.id)}"]`);
  graphNode?.classList.add("selected-diagram-node");
}

function nodeDetailHtml(node, compact = false) {
  return `
    <article class="node-card" data-node-id="${escapeAttr(node.id)}">
      <a class="doc-link node-doc-link" href="${escapeAttr(node.help_doc_url)}" target="_blank" rel="noreferrer">查看 Coze 官方帮助文档</a>
      <h3>${escapeHtml(node.order ? `${node.order}. ` : "")}${escapeHtml(node.name)}</h3>
      <p class="node-meta">${escapeHtml(node.coze_node_type)} / ${escapeHtml(node.execution_type)}</p>
      <p>${escapeHtml(node.description)}</p>
      ${parameterBlock("输入参数", node.input_parameters)}
      ${parameterBlock("输出参数", node.output_parameters)}
      ${codeConfigBlock(node.code_config)}
      ${knowledgeConfigBlock(node.knowledge_config)}
      ${promptBlock(node.prompt_config)}
      ${explanationBlock(node.node_explanation)}
      ${compact ? "" : ""}
    </article>
  `;
}

function parameterBlock(title, items = []) {
  if (!items.length) return "";
  return `<div class="prompt-block"><h3>${escapeHtml(title)}</h3><ul class="parameter-list">${items.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.type)}): ${escapeHtml(item.description || item.source || "")}</li>`).join("")}</ul></div>`;
}

function promptBlock(config) {
  if (!config) return "";
  return `
    <div class="prompt-block">
      <h3>提示词设计</h3>
      <p><strong>系统提示词</strong></p>
      <pre class="mini-code">${escapeHtml(config.system_prompt)}</pre>
      <p><strong>用户提示词</strong></p>
      <pre class="mini-code">${escapeHtml(config.user_prompt)}</pre>
      <p><strong>输出格式</strong>：${escapeHtml(config.output_format)}</p>
      <p><strong>模型建议</strong>：${escapeHtml(config.model_recommendation.model)}，temperature=${escapeHtml(config.model_recommendation.temperature)}</p>
      <p>${escapeHtml(config.model_recommendation.reason)}</p>
    </div>
  `;
}

function codeConfigBlock(config) {
  if (!config) return "";
  return `
    <div class="prompt-block">
      <h3>代码实现</h3>
      <p><strong>语言 / 运行环境</strong>：${escapeHtml(config.language)} / ${escapeHtml(config.runtime)}</p>
      <p><strong>代码</strong></p>
      <pre class="mini-code">${escapeHtml(config.code)}</pre>
      <p><strong>注释说明</strong></p>
      <ul class="parameter-list">${config.comments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <p><strong>测试样例</strong></p>
      <ul class="parameter-list">${config.test_cases.map((item) => `<li><strong>${escapeHtml(item.name)}</strong>：${escapeHtml(item.expected)}</li>`).join("")}</ul>
    </div>
  `;
}

function knowledgeConfigBlock(config) {
  if (!config) return "";
  return `
    <div class="prompt-block">
      <h3>知识库内容设计</h3>
      <p><strong>建议知识库名称</strong>：${escapeHtml(config.knowledge_base_name)}</p>
      <p><strong>检索方式</strong>：${escapeHtml(config.retrieval_mode)}；Top K=${escapeHtml(config.top_k)}；阈值=${escapeHtml(config.score_threshold)}</p>
      <p><strong>知识库应包含的内容</strong></p>
      <ul class="parameter-list">${config.content_scope.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <p><strong>文档字段结构</strong></p>
      <ul class="parameter-list">${config.document_structure.map((item) => `<li><strong>${escapeHtml(item.field)}</strong>：${escapeHtml(item.description)}</li>`).join("")}</ul>
      <p><strong>示例文档</strong></p>
      <div class="knowledge-samples">${config.sample_documents.map(knowledgeSampleHtml).join("")}</div>
      <p><strong>维护建议</strong></p>
      <ul class="parameter-list">${config.maintenance_notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function knowledgeSampleHtml(item) {
  return `
    <article class="knowledge-sample">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.category)} / ${escapeHtml((item.tags || []).join("、"))}</p>
      <p>${escapeHtml(item.content)}</p>
    </article>
  `;
}

function explanationBlock(explain) {
  if (!explain) return "";
  return `
    <div class="explain-block">
      <h3>节点解释</h3>
      <p><strong>为什么需要：</strong>${escapeHtml(explain.why_needed)}</p>
      <p><strong>如何配置：</strong>${escapeHtml(explain.how_to_configure)}</p>
      <p><strong>数据流：</strong>${escapeHtml(explain.data_flow)}</p>
      <p><strong>兜底策略：</strong>${escapeHtml(explain.fallback_strategy)}</p>
      <p><strong>配置步骤</strong></p>
      <ul class="parameter-list">${explain.config_steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <p><strong>测试建议</strong></p>
      <ul class="parameter-list">${explain.test_suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function switchStage(stage) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.stage === stage));
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.id === stage));
}

function addChatMessage(role, content) {
  const div = document.createElement("div");
  div.className = `chat-message ${role === "你" ? "user" : "assistant"}`;
  div.innerHTML = `<strong>${escapeHtml(role)}：</strong>${escapeHtml(content)}`;
  els.chatLog.appendChild(div);
}

function addDecisionOptions(message) {
  const div = document.createElement("div");
  div.className = "chat-message assistant decision-message";
  div.innerHTML = `
    <strong>系统：</strong>${escapeHtml(message)}
    <div class="decision-actions">
      <button type="button" class="decision-primary" data-action="generate">直接生成方案</button>
    </div>
  `;
  div.querySelector('[data-action="generate"]').addEventListener("click", onGenerate);
  els.chatLog.appendChild(div);
}

async function postJson(url, payload) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error("无法连接后端服务，请确认本地服务正在运行。");
  }
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.message || "请求失败");
  return result;
}

function setBusy(isBusy, message = "") {
  els.clarify.disabled = isBusy;
  els.generate.disabled = isBusy || (!state.refinedRequirement && !els.requirement.value.trim());
  if (message) setStatus(message);
}

function setStatus(message) {
  els.status.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeSvg(value) {
  return escapeHtml(value);
}

function cssSafeId(value) {
  return String(value).replace(/[^\w]/g, "_");
}

function cssEscapeAttr(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
