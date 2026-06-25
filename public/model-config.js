const els = {
  provider: document.querySelector("#provider"),
  baseUrl: document.querySelector("#base-url"),
  model: document.querySelector("#model"),
  apiKey: document.querySelector("#api-key"),
  temperature: document.querySelector("#temperature"),
  enabled: document.querySelector("#enabled"),
  save: document.querySelector("#save"),
  test: document.querySelector("#test"),
  status: document.querySelector("#status")
};

loadConfig();
els.save.addEventListener("click", onSave);
els.test.addEventListener("click", onTest);

async function loadConfig() {
  const config = await fetchJson("/api/model-config");
  els.provider.value = config.provider || "openai-compatible";
  els.baseUrl.value = config.base_url || "";
  els.model.value = config.model || "";
  els.apiKey.value = config.api_key || "";
  els.temperature.value = config.temperature ?? 0.2;
  els.enabled.checked = Boolean(config.enabled);
}

async function onSave() {
  setBusy(true, "正在保存...");
  try {
    await postJson("/api/model-config", readForm());
    setStatus("配置已保存。");
  } catch (error) {
    setStatus(error.message || "保存失败。");
  } finally {
    setBusy(false);
  }
}

async function onTest() {
  setBusy(true, "正在测试...");
  try {
    const result = await postJson("/api/model-config/test", readForm());
    setStatus(result.message || (result.ok ? "模型连接成功。" : "模型连接失败。"));
  } catch (error) {
    setStatus(error.message || "测试失败。");
  } finally {
    setBusy(false);
  }
}

function readForm() {
  return {
    provider: els.provider.value.trim(),
    base_url: els.baseUrl.value.trim(),
    model: els.model.value.trim(),
    api_key: els.apiKey.value.includes("*") ? "" : els.apiKey.value.trim(),
    temperature: Number(els.temperature.value || 0.2),
    enabled: els.enabled.checked
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.message || "请求失败");
  return result;
}

function setBusy(isBusy, message = "") {
  els.save.disabled = isBusy;
  els.test.disabled = isBusy;
  if (message) setStatus(message);
}

function setStatus(message) {
  els.status.textContent = message;
}
