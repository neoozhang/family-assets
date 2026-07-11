const STORAGE_KEY = "annual-bill-planner-v1";
const FLOAT_POSITION_KEY = "annual-bill-float-position-v1";

const groups = {
  liquid: { name: "灵活资金", color: "#477c79", soft: "#e4f0ef", mark: "1" },
  investment: { name: "投资资产", color: "#4d7c62", soft: "#e8f1eb", mark: "50" },
  longterm: { name: "房产实物", color: "#a5743e", soft: "#f5eddf", mark: "20" },
  reserve: { name: "长期储备", color: "#6d5b85", soft: "#eeeaf3", mark: "5" },
  restricted: { name: "受限权益", color: "#64748b", soft: "#eef2f6", mark: "限" },
  other: { name: "其他资产", color: "#a83f4b", soft: "#f8e9eb", mark: "100" },
  debt: { name: "全部负债", color: "#82333e", soft: "#f8e9eb", mark: "−" },
};

const researchColors = {
  liquid: "#18aaa2",
  investment: "#45b86b",
  longterm: "#f0a13a",
  reserve: "#7869e8",
  other: "#e85d78",
};

const typeCatalog = [
  { id: "wechat", name: "微信 / 零钱通", short: "微信", kind: "asset", group: "liquid", icon: "微" },
  { id: "alipay", name: "支付宝 / 余额宝", short: "支付宝", kind: "asset", group: "liquid", icon: "支" },
  { id: "bank", name: "银行卡 / 存款", short: "银行存款", kind: "asset", group: "liquid", icon: "银" },
  { id: "cash", name: "现金", short: "现金", kind: "asset", group: "liquid", icon: "现" },
  { id: "stock", name: "股票账户", short: "股票", kind: "asset", group: "investment", icon: "股" },
  { id: "fund", name: "基金 / 理财", short: "基金理财", kind: "asset", group: "investment", icon: "基" },
  { id: "bond", name: "债券 / 固收", short: "债券固收", kind: "asset", group: "investment", icon: "债" },
  { id: "crypto", name: "数字货币 / 交易所", short: "数字货币", kind: "asset", group: "investment", icon: "币" },
  { id: "property", name: "房产", short: "房产", kind: "asset", group: "longterm", icon: "房" },
  { id: "car", name: "车辆 / 贵重物品", short: "实物资产", kind: "asset", group: "longterm", icon: "物" },
  { id: "pension", name: "社保养老个人账户", short: "养老个人账户", kind: "restricted", group: "restricted", icon: "养" },
  { id: "provident", name: "住房公积金", short: "住房公积金", kind: "restricted", group: "restricted", icon: "公" },
  { id: "individual-pension", name: "个人养老金账户", short: "个人养老金", kind: "restricted", group: "restricted", icon: "退" },
  { id: "annuity", name: "企业年金 / 职业年金", short: "企业职业年金", kind: "restricted", group: "restricted", icon: "年" },
  { id: "receivable", name: "应收款 / 外借款", short: "应收款", kind: "asset", group: "reserve", icon: "借" },
  { id: "other", name: "其他", short: "其他", kind: "asset", group: "other", icon: "其" },
  { id: "credit", name: "信用卡 / 花呗 / 白条", short: "消费负债", kind: "debt", group: "debt", icon: "卡" },
  { id: "loan", name: "房贷 / 车贷 / 贷款", short: "长期贷款", kind: "debt", group: "debt", icon: "贷" },
];

const typeById = new Map(typeCatalog.map((type) => [type.id, type]));
const moneyFormatter = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

let state = loadState();
let ui = { view: "worth", accountFilter: "all", amountsHidden: false };
let toastTimer;

const dom = {
  views: document.querySelectorAll(".view"),
  navButtons: document.querySelectorAll("[data-target]"),
  yearSelect: byId("yearSelect"),
  latestDate: byId("latestDate"),
  netWorth: byId("netWorth"),
  yearChange: byId("yearChange"),
  yearRate: byId("yearRate"),
  totalAssets: byId("totalAssets"),
  totalDebt: byId("totalDebt"),
  assetCount: byId("assetCount"),
  debtCount: byId("debtCount"),
  debtRate: byId("debtRate"),
  assetMap: byId("assetMap"),
  debtBand: byId("debtBand"),
  mapDate: byId("mapDate"),
  recordCount: byId("recordCount"),
  trendChart: byId("trendChart"),
  trendFoot: byId("trendFoot"),
  changeList: byId("changeList"),
  recordStats: byId("recordStats"),
  historyMeta: byId("historyMeta"),
  recordList: byId("recordList"),
  analysisDate: byId("analysisDate"),
  analysisMetrics: byId("analysisMetrics"),
  donutChart: byId("donutChart"),
  donutLegend: byId("donutLegend"),
  categoryBars: byId("categoryBars"),
  analysisTableMeta: byId("analysisTableMeta"),
  researchTable: byId("researchTable"),
  analysisNarrative: byId("analysisNarrative"),
  debtPriority: byId("debtPriority"),
  accountFilter: byId("accountFilter"),
  accountGrid: byId("accountGrid"),
  recordDialog: byId("recordDialog"),
  recordForm: byId("recordForm"),
  recordFormList: byId("recordFormList"),
  accountDialog: byId("accountDialog"),
  accountForm: byId("accountForm"),
  accountDialogTitle: byId("accountDialogTitle"),
  accountDialogHelp: byId("accountDialogHelp"),
  accountSubmit: byId("accountSubmit"),
  accountTypeSelect: byId("accountTypeSelect"),
  customTypeLabel: byId("customTypeLabel"),
  customTypeText: byId("customTypeText"),
  customNameInput: byId("customNameInput"),
  debtTip: byId("debtTip"),
  restrictedTip: byId("restrictedTip"),
  receivableTip: byId("receivableTip"),
  toggleAmounts: byId("toggleAmounts"),
  toast: byId("toast"),
};

bindEvents();
render();

function byId(id) {
  return document.getElementById(id);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.accounts) && Array.isArray(saved.snapshots)) return normalizeState(saved);
  } catch {
    // Invalid local data falls back to the example ledger.
  }
  return createDemoState();
}

function normalizeState(saved) {
  const snapshots = saved.snapshots
    .filter((item) => item.accountId && item.date && Number.isFinite(Number(item.balance)))
    .map((item) => ({ ...item, balance: Number(item.balance) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestYear = snapshots.at(-1)?.date.slice(0, 4) || String(new Date().getFullYear());
  const savedYear = String(saved.settings?.year || saved.settings?.period || "");
  return {
    accounts: saved.accounts.map((account) => ({ ...account, currency: account.currency || "CNY" })),
    snapshots,
    settings: { year: /^\d{4}$/.test(savedYear) ? savedYear : latestYear },
  };
}

function createDemoState() {
  const accounts = [
    account("wechat-wallet", "微信", "wechat", "微信"),
    account("alipay-yuebao", "支付宝", "alipay", "余额宝"),
    account("cmb-card", "银行存款", "bank", "招商银行"),
    account("icbc-card", "银行存款", "bank", "工商银行"),
    account("stock-a", "股票", "stock", "证券账户"),
    account("fund-main", "基金理财", "fund", "基金平台"),
    account("home-property", "房产", "property", "自住房"),
    account("housing-fund", "公积金养老", "pension", "住房公积金"),
    account("credit-card", "消费负债", "credit", "信用卡 / 花呗"),
    account("mortgage", "长期贷款", "loan", "住房贷款"),
  ];
  const values = {
    "2025-12-31": [2600, 19800, 79000, 118000, 72000, 59000, 1240000, 84500, -14200, -640000],
    "2026-03-31": [3250, 23500, 72100, 122000, 81500, 56100, 1252000, 90400, -19600, -630000],
    "2026-06-30": [3820, 24150, 68400, 125000, 88000, 54600, 1260000, 96500, -18400, -620000],
  };
  return {
    accounts,
    snapshots: Object.entries(values).flatMap(([date, balances]) => accounts.map((item, index) => ({ id: uid(), accountId: item.id, date, balance: balances[index] }))),
    settings: { year: "2026" },
  };
}

function account(id, name, type, institution) {
  return { id, name, type, institution, currency: "CNY" };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  dom.navButtons.forEach((button) => button.addEventListener("click", () => navigate(button.dataset.target)));
  ["recordHeader", "recordHero", "recordRecords"].forEach((id) => byId(id).addEventListener("click", openRecordDialog));
  bindFloatingButton();
  byId("analysisRecord").addEventListener("click", openRecordDialog);
  byId("addAccount").addEventListener("click", () => openAccountDialog());
  byId("exportRecords").addEventListener("click", exportRecords);
  byId("resetDemo").addEventListener("click", resetDemo);
  dom.toggleAmounts.addEventListener("click", toggleAmounts);

  dom.yearSelect.addEventListener("change", () => {
    state.settings.year = dom.yearSelect.value;
    saveState();
    render();
  });
  dom.accountFilter.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    ui.accountFilter = button.dataset.filter;
    renderAccounts();
  });
  dom.recordForm.addEventListener("submit", handleRecordSubmit);
  dom.accountForm.addEventListener("submit", handleAccountSubmit);
  dom.accountTypeSelect.addEventListener("change", syncAccountTypeFields);

  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close]");
    if (closeButton) closeDialog(byId(closeButton.dataset.close));
    const editButton = event.target.closest("[data-edit-account]");
    if (editButton) openAccountDialog(editButton.dataset.editAccount);
    const deleteButton = event.target.closest("[data-delete-account]");
    if (deleteButton) deleteAccount(deleteButton.dataset.deleteAccount);
  });
  [dom.recordDialog, dom.accountDialog].forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  }));
}

function bindFloatingButton() {
  const button = byId("recordFloat");
  let drag = null;
  let suppressClick = false;

  restoreFloatingPosition(button);
  window.addEventListener("resize", () => restoreFloatingPosition(button));

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("is-dragging");
    event.preventDefault();
  });

  button.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    const position = clampFloatingPosition(button, drag.left + dx, drag.top + dy);
    button.style.left = `${position.left}px`;
    button.style.top = `${position.top}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
  });

  const finishDrag = (event, shouldActivate) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    suppressClick = true;
    button.releasePointerCapture?.(event.pointerId);
    button.classList.remove("is-dragging");
    if (drag.moved) saveFloatingPosition(button);
    else if (shouldActivate) openRecordDialog();
    drag = null;
    setTimeout(() => { suppressClick = false; }, 0);
  };
  button.addEventListener("pointerup", (event) => finishDrag(event, true));
  button.addEventListener("pointercancel", (event) => finishDrag(event, false));
  button.addEventListener("click", () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    openRecordDialog();
  });
}

function clampFloatingPosition(button, left, top) {
  const margin = 8;
  const navSpace = 74;
  const width = button.offsetWidth || 40;
  const height = button.offsetHeight || 40;
  return {
    left: Math.min(Math.max(margin, left), window.innerWidth - width - margin),
    top: Math.min(Math.max(margin, top), window.innerHeight - height - navSpace),
  };
}

function saveFloatingPosition(button) {
  const rect = button.getBoundingClientRect();
  const maxLeft = Math.max(1, window.innerWidth - rect.width);
  const maxTop = Math.max(1, window.innerHeight - rect.height - 74);
  localStorage.setItem(FLOAT_POSITION_KEY, JSON.stringify({ x: rect.left / maxLeft, y: rect.top / maxTop }));
}

function restoreFloatingPosition(button) {
  if (!window.matchMedia?.("(max-width: 720px)").matches) return;
  try {
    const saved = JSON.parse(localStorage.getItem(FLOAT_POSITION_KEY) || "null");
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;
    const width = button.offsetWidth || 40;
    const height = button.offsetHeight || 40;
    const position = clampFloatingPosition(button, saved.x * (window.innerWidth - width), saved.y * (window.innerHeight - height - 74));
    button.style.left = `${position.left}px`;
    button.style.top = `${position.top}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
  } catch {
    localStorage.removeItem(FLOAT_POSITION_KEY);
  }
}

function render() {
  ensureYear();
  renderYearSelect();
  const year = state.settings.year;
  const summary = getYearSummary(year);
  renderWorth(year, summary);
  renderRecords();
  renderAnalysis(year, summary);
  renderAccounts();
}

function navigate(target) {
  if (!target) return;
  ui.view = target;
  dom.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === target));
  document.querySelectorAll(".nav-button[data-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.target === target));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ensureYear() {
  const years = getYears();
  if (!years.includes(state.settings.year)) state.settings.year = years[0];
}

function getYears() {
  return [...new Set([...state.snapshots.map((item) => item.date.slice(0, 4)), String(new Date().getFullYear())])].sort().reverse();
}

function renderYearSelect() {
  dom.yearSelect.innerHTML = getYears().map((year) => `<option value="${year}">${year} 年</option>`).join("");
  dom.yearSelect.value = state.settings.year;
}

function getYearSummary(year) {
  const end = `${year}-12-31`;
  const previousEnd = `${Number(year) - 1}-12-31`;
  const rows = state.accounts.map((item) => rowAt(item, end, previousEnd));
  const assets = rows.filter((row) => row.type.kind === "asset").reduce((sum, row) => sum + row.current, 0);
  const debt = rows.filter((row) => row.type.kind === "debt").reduce((sum, row) => sum + Math.abs(row.current), 0);
  const net = assets - debt;
  const previousNet = rows.reduce((sum, row) => sum + row.previous, 0);
  const change = net - previousNet;
  const rate = previousNet ? (change / Math.abs(previousNet)) * 100 : 0;
  const latestDate = state.snapshots.filter((item) => item.date <= end).map((item) => item.date).sort().at(-1) || "";
  return { rows, assets, debt, net, previousNet, change, rate, latestDate };
}

function rowAt(item, end, previousEnd) {
  const currentSnapshot = getSnapshotAt(item.id, end);
  const previousSnapshot = getSnapshotAt(item.id, previousEnd);
  const current = currentSnapshot?.balance || 0;
  const previous = previousSnapshot?.balance || 0;
  return { account: item, type: getType(item), current, previous, change: current - previous, currentDate: currentSnapshot?.date || "" };
}

function renderWorth(year, summary) {
  dom.latestDate.textContent = summary.latestDate ? `最近归档 ${formatDate(summary.latestDate, true)}` : "尚无档案";
  dom.netWorth.textContent = formatMoney(summary.net);
  setSigned(dom.yearChange, summary.change);
  dom.yearRate.textContent = `${summary.rate >= 0 ? "+" : ""}${percentFormatter.format(summary.rate)}%`;
  dom.totalAssets.textContent = formatMoney(summary.assets);
  dom.totalDebt.textContent = formatMoney(summary.debt);
  dom.assetCount.textContent = `${summary.rows.filter((row) => row.type.kind === "asset").length} 个资产账户`;
  dom.debtCount.textContent = `${summary.rows.filter((row) => row.type.kind === "debt").length} 个负债账户`;
  dom.debtRate.textContent = `${summary.assets ? percentFormatter.format((summary.debt / summary.assets) * 100) : 0}%`;
  dom.mapDate.textContent = summary.latestDate ? `截至 ${formatDate(summary.latestDate)}` : "当前余额";
  renderAssetMap(summary);
  renderYearTrend(year);
  renderLatestChanges(year);
}

function renderAnalysis(year, summary) {
  const groupData = getGroupAnalysis(summary);
  const byKey = new Map(groupData.map((item) => [item.key, item]));
  const liquidRatio = byKey.get("liquid")?.ratio || 0;
  const investmentRatio = byKey.get("investment")?.ratio || 0;
  const debtRatio = summary.assets ? (summary.debt / summary.assets) * 100 : 0;
  const largest = [...groupData].sort((a, b) => b.value - a.value)[0];

  dom.analysisDate.textContent = summary.latestDate ? `基于 ${formatDate(summary.latestDate, true)} 档案 · ${state.accounts.length} 个账户` : "尚无可研究的档案数据";
  dom.analysisTableMeta.textContent = summary.latestDate ? `截至 ${formatDate(summary.latestDate)}` : "当前档案";
  dom.analysisMetrics.innerHTML = [
    { label: "财富净值", value: formatMoney(summary.net), note: `${year} 年度口径`, color: "#e04f67", money: true },
    { label: "灵活资金占比", value: `${percentFormatter.format(liquidRatio)}%`, note: "微信、支付宝、存款与现金", color: researchColors.liquid },
    { label: "投资资产占比", value: `${percentFormatter.format(investmentRatio)}%`, note: "股票、基金、债券与数字资产", color: researchColors.investment },
    { label: "负债占比", value: `${percentFormatter.format(debtRatio)}%`, note: "负债余额 ÷ 财富总额", color: researchColors.reserve },
  ].map((item) => `<article class="analysis-metric" style="--metric-color:${item.color}"><span>${item.label}</span><strong ${item.money ? "data-money" : ""}>${item.value}</strong><small>${item.note}</small></article>`).join("");

  renderDonut(groupData, summary.assets);
  renderCategoryBars(groupData);
  renderResearchTable(groupData, summary.assets);
  renderNarrative(groupData, summary, largest, { liquidRatio, investmentRatio, debtRatio });
  renderDebtPriority(summary.rows.filter((row) => row.type.kind === "debt" && row.current < 0));
}

function getGroupAnalysis(summary) {
  return ["liquid", "investment", "longterm", "reserve", "other"].map((key) => {
    const rows = summary.rows.filter((row) => row.type.group === key);
    const value = rows.reduce((sum, row) => sum + Math.max(0, row.current), 0);
    const change = rows.reduce((sum, row) => sum + row.change, 0);
    return { key, meta: groups[key], value, change, count: rows.length, ratio: summary.assets ? (value / summary.assets) * 100 : 0 };
  });
}

function renderDonut(groupData, totalAssets) {
  const visible = groupData.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  if (!visible.length || !totalAssets) {
    dom.donutChart.innerHTML = emptyState("暂无资产数据。", "donut");
    dom.donutLegend.innerHTML = "";
    return;
  }
  const dominant = visible[0];
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progressLength = Math.min(1, dominant.ratio / 100) * circumference;
  const dominantColor = researchColors[dominant.key];
  dom.donutChart.innerHTML = `<svg viewBox="0 0 200 200" role="img" aria-label="最大资产占比圆环图" style="--ring-color:${dominantColor}"><circle class="wealth-ring-base" cx="100" cy="100" r="${radius}"/><circle class="wealth-ring-progress" cx="100" cy="100" r="${radius}" stroke-dasharray="${progressLength} ${circumference - progressLength}" transform="rotate(-90 100 100)"/><circle class="wealth-ring-center" cx="100" cy="100" r="54"/><text x="100" y="88" text-anchor="middle" class="donut-caption">${dominant.meta.name}</text><text x="100" y="112" text-anchor="middle" class="donut-value">${percentFormatter.format(dominant.ratio)}%</text><text x="100" y="128" text-anchor="middle" class="donut-subtitle">占可配置资产</text></svg>`;
  dom.donutLegend.innerHTML = visible.map((item) => `<div class="legend-row" style="--legend-color:${researchColors[item.key]}"><i></i><span class="legend-copy"><strong>${item.meta.name}</strong><small data-money>${formatMoney(item.value)}</small></span><b>${percentFormatter.format(item.ratio)}%</b></div>`).join("");
}

function renderCategoryBars(groupData) {
  dom.categoryBars.innerHTML = groupData.map((item) => {
    const width = item.value ? Number(Math.max(2, Math.min(100, item.ratio)).toFixed(1)) : 0;
    const fill = item.value ? `<span style="width:${width}%"></span>` : "";
    return `<div class="bar-row" style="--bar-color:${researchColors[item.key]}"><div class="bar-row-head"><span><i></i><strong>${item.meta.name}</strong></span><b data-money>${formatWan(item.value)}</b><em>${percentFormatter.format(item.ratio)}%</em></div><div class="bar-track">${fill}</div></div>`;
  }).join("");
}

function renderResearchTable(groupData, totalAssets) {
  const rows = groupData.map((item) => {
    const status = item.ratio >= 60 ? "集中较高" : item.ratio >= 35 ? "主要配置" : item.ratio > 0 && item.ratio < 10 ? "占比较低" : item.ratio === 0 ? "尚未配置" : "结构适中";
    const statusClass = item.ratio >= 60 ? "risk" : item.ratio < 10 ? "watch" : "normal";
    return `<div class="research-row"><span class="table-category"><i style="background:${researchColors[item.key]}"></i>${item.meta.name}</span><strong data-money>${formatMoney(item.value)}</strong><span>${percentFormatter.format(item.ratio)}%</span><span>${item.count} 个</span><span class="${signedClass(item.change)}" data-money>${formatSigned(item.change)}</span><em class="table-status ${statusClass}">${status}</em></div>`;
  }).join("");
  dom.researchTable.innerHTML = `<div class="research-row is-header"><span>资产类别</span><span>当前金额</span><span>资产占比</span><span>账户数</span><span>年度变化</span><span>结构判断</span></div>${rows}<div class="research-row is-total"><span>财富总额</span><strong data-money>${formatMoney(totalAssets)}</strong><span>100%</span><span>${groupData.reduce((sum, item) => sum + item.count, 0)} 个</span><span>—</span><span>—</span></div>`;
}

function renderNarrative(groupData, summary, largest, ratios) {
  if (!summary.assets) {
    dom.analysisNarrative.innerHTML = emptyState("添加资产并建立档案后生成解读。", "narrative");
    return;
  }
  const items = [];
  if (largest?.ratio >= 60) {
    const propertyNote = largest.key === "longterm" ? "若其中主要是自住房，不建议仅为调整比例仓促处置。" : "";
    items.push({ level: "重点", tone: "high", title: `${largest.meta.name}占比集中`, text: `${largest.meta.name}占财富总额 ${percentFormatter.format(largest.ratio)}%。新增资金可优先补充其他类别，避免集中度继续上升。${propertyNote}` });
  } else {
    items.push({ level: "结构", tone: "good", title: "大类集中度未见极端", text: `当前最大类别为${largest.meta.name}，占比 ${percentFormatter.format(largest.ratio)}%。仍需结合具体账户和风险承受能力判断。` });
  }

  if (ratios.liquidRatio < 10) {
    items.push({ level: "优先", tone: "high", title: "灵活资金偏少", text: `灵活资金占比 ${percentFormatter.format(ratios.liquidRatio)}%。因未记录家庭月支出，无法判断应急资金是否充足，建议先核对能否覆盖数月必要开支。` });
  } else if (ratios.liquidRatio > 50) {
    items.push({ level: "关注", tone: "medium", title: "灵活资金占比较高", text: `灵活资金占比 ${percentFormatter.format(ratios.liquidRatio)}%。预留应急资金后，可再评估长期储备和分散投资需求。` });
  } else {
    items.push({ level: "流动性", tone: "good", title: "灵活资金比例不极端", text: `灵活资金占比 ${percentFormatter.format(ratios.liquidRatio)}%。是否充足仍取决于家庭必要开支和收入稳定性。` });
  }

  if (ratios.investmentRatio < 10) {
    items.push({ level: "建议", tone: "medium", title: "投资资产占比较少", text: `投资资产占比 ${percentFormatter.format(ratios.investmentRatio)}%。在应急资金充足且高息负债处理后，可依据期限与风险承受能力考虑逐步增加分散配置。` });
  } else if (ratios.investmentRatio > 50) {
    items.push({ level: "风险", tone: "high", title: "投资资产波动暴露较高", text: `投资资产占比 ${percentFormatter.format(ratios.investmentRatio)}%。建议检查是否过度集中于单一市场、产品或平台。` });
  } else {
    items.push({ level: "投资", tone: "good", title: "投资资产占比处于中间区间", text: `投资资产占比 ${percentFormatter.format(ratios.investmentRatio)}%。下一步应检查投资内部是否分散，而不只看总比例。` });
  }

  if (summary.debt > 0) {
    items.push({ level: "负债", tone: ratios.debtRatio >= 50 ? "high" : "medium", title: `资产负债率为 ${percentFormatter.format(ratios.debtRatio)}%`, text: "先补充每笔负债的实际年化利率、剩余期限和提前还款条款，再按实际资金成本从高到低安排。" });
  }
  dom.analysisNarrative.innerHTML = items.map((item, index) => `<article class="narrative-item"><span class="analysis-index">${String(index + 1).padStart(2, "0")}</span><div><div class="narrative-title"><em class="${item.tone}">${item.level}</em><strong>${item.title}</strong></div><p>${item.text}</p></div></article>`).join("");
}

function renderDebtPriority(debtRows) {
  if (!debtRows.length) {
    dom.debtPriority.innerHTML = emptyState("当前没有负债账户。", "debt");
    return;
  }
  const sorted = [...debtRows].sort((a, b) => {
    const typeOrder = (row) => row.type.id === "credit" ? 0 : 1;
    return typeOrder(a) - typeOrder(b) || Math.abs(b.current) - Math.abs(a.current);
  });
  dom.debtPriority.innerHTML = `<p class="debt-rule">利率尚未记录，以下仅为核对顺序。实际偿还顺序应优先比较年化利率。</p>${sorted.map((row, index) => `<article class="debt-row"><span class="debt-rank">${index + 1}</span><div><strong>${escapeHtml(displayName(row.account, row.type))}</strong><small>${escapeHtml(row.account.institution || row.type.name)}</small></div><strong data-money>${formatMoney(Math.abs(row.current))}</strong><em>${row.type.id === "credit" ? "优先核对利率" : "随后评估条款"}</em></article>`).join("")}`;
}

function renderAssetMap(summary) {
  const order = ["liquid", "investment", "longterm", "reserve", "other"];
  const totals = new Map(order.map((key) => [key, 0]));
  summary.rows.filter((row) => row.type.kind === "asset").forEach((row) => totals.set(row.type.group, (totals.get(row.type.group) || 0) + row.current));
  const items = order.map((key) => ({ key, meta: groups[key], value: totals.get(key) || 0 })).filter((item) => item.value > 0);
  dom.assetMap.innerHTML = items.length ? items.map((item) => {
    const percent = summary.assets ? (item.value / summary.assets) * 100 : 0;
    return `<article class="map-item" data-group="${item.key}" style="--map-color:${item.meta.color};--map-soft:${item.meta.soft};--map-ink:${item.meta.color}"><div class="map-top"><span>${item.meta.name}</span><em>${percentFormatter.format(percent)}%</em></div><div class="map-bottom"><strong data-money>${formatMoney(item.value)}</strong><small>${summary.rows.filter((row) => row.type.group === item.key).length} 个账户</small></div></article>`;
  }).join("") : emptyState("添加资产账户后，这里会生成资产构成图。", "map");
  dom.debtBand.innerHTML = `<span>负债从总资产中扣除<small>${summary.rows.filter((row) => row.type.kind === "debt").length} 个负债账户</small></span><strong data-money>−${formatMoney(summary.debt)}</strong>`;
}

function renderYearTrend(year) {
  const records = getRecords().filter((record) => record.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date));
  dom.recordCount.textContent = `${records.length} 份档案`;
  if (!records.length) {
    dom.trendChart.innerHTML = emptyState(`${year} 年还没有盘点档案。`, "trend");
    dom.trendFoot.innerHTML = "";
    return;
  }
  dom.trendChart.innerHTML = trendSvg(records);
  const low = [...records].sort((a, b) => a.net - b.net)[0];
  const high = [...records].sort((a, b) => b.net - a.net)[0];
  dom.trendFoot.innerHTML = `<div class="trend-stat"><span>年度最高</span><strong data-money>${formatMoney(high.net)}</strong></div><div class="trend-stat"><span>年度最低</span><strong data-money>${formatMoney(low.net)}</strong></div>`;
}

function trendSvg(records) {
  const width = 520;
  const height = 230;
  const pad = { top: 18, right: 18, bottom: 32, left: 18 };
  const values = records.map((record) => record.net);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const coords = records.map((record, index) => ({
    ...record,
    x: records.length === 1 ? width / 2 : pad.left + (index / (records.length - 1)) * (width - pad.left - pad.right),
    y: pad.top + ((max - record.net) / (max - min)) * (height - pad.top - pad.bottom),
  }));
  const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1).x},${height - pad.bottom} L${coords[0].x},${height - pad.bottom} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="年度净值轨迹"><line class="chart-grid" x1="${pad.left}" y1="${pad.top}" x2="${width - pad.right}" y2="${pad.top}"/><line class="chart-grid" x1="${pad.left}" y1="${height / 2}" x2="${width - pad.right}" y2="${height / 2}"/><line class="chart-grid" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"/><path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${coords.map((point) => `<circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="4"/><text class="chart-label" x="${point.x}" y="${height - 9}" text-anchor="middle">${shortDate(point.date)}</text>`).join("")}</svg>`;
}

function renderLatestChanges(year) {
  const dates = getRecordDates().filter((date) => date <= `${year}-12-31`);
  const currentDate = dates.at(-1);
  const previousDate = dates.at(-2);
  if (!currentDate || !previousDate) {
    dom.changeList.innerHTML = emptyState("建立两份档案后，这里会显示账户变化。", "changes");
    return;
  }
  const changes = state.accounts.filter((item) => getType(item).kind !== "restricted").map((item) => {
    const current = getSnapshotAt(item.id, currentDate)?.balance || 0;
    const previous = getSnapshotAt(item.id, previousDate)?.balance || 0;
    return { account: item, type: getType(item), change: current - previous };
  }).filter((row) => row.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 4);
  dom.changeList.innerHTML = changes.length ? changes.map((row) => {
    const meta = groups[row.type.group];
    return `<article class="change-item" style="--item-color:${meta.color}"><span>${escapeHtml(displayName(row.account, row.type))}</span><strong class="${signedClass(row.change)}" data-money>${formatSigned(row.change)}</strong><small>${escapeHtml(row.account.institution || row.type.name)}</small></article>`;
  }).join("") : emptyState("最近两份档案的账户余额没有变化。", "changes");
}

function getRecordDates() {
  return [...new Set(state.snapshots.map((item) => item.date))].sort();
}

function getRecords() {
  const dates = getRecordDates();
  return dates.map((date, index) => {
    const balances = state.accounts.map((item) => ({ type: getType(item), balance: getSnapshotAt(item.id, date)?.balance || 0 }));
    const assets = balances.filter((item) => item.type.kind === "asset").reduce((sum, item) => sum + item.balance, 0);
    const debt = balances.filter((item) => item.type.kind === "debt").reduce((sum, item) => sum + Math.abs(item.balance), 0);
    const net = assets - debt;
    const previousDate = dates[index - 1];
    const previousNet = previousDate ? state.accounts.reduce((sum, item) => sum + (getSnapshotAt(item.id, previousDate)?.balance || 0), 0) : net;
    return { date, assets, debt, net, change: net - previousNet };
  });
}

function renderRecords() {
  const records = getRecords();
  const latest = records.at(-1);
  const first = records[0];
  const highest = records.length ? [...records].sort((a, b) => b.net - a.net)[0] : null;
  const totalChange = latest && first ? latest.net - first.net : 0;
  const statData = [
    { label: "最新净值", value: latest ? formatMoney(latest.net) : formatMoney(0), copy: latest ? formatDate(latest.date, true) : "暂无档案", color: "#a83f4b", tone: "" },
    { label: "档案变动", value: formatSigned(totalChange), copy: first && latest ? `${formatDate(first.date)} 至今` : "等待更多档案", color: "#4d7c62", tone: signedClass(totalChange) },
    { label: "历史峰值", value: highest ? formatMoney(highest.net) : formatMoney(0), copy: highest ? formatDate(highest.date, true) : "暂无档案", color: "#a5743e", tone: "" },
    { label: "档案数量", value: `${records.length} 份`, copy: `${getYears().length} 个年份`, color: "#6d5b85", tone: "" },
  ];
  dom.recordStats.innerHTML = statData.map((stat, index) => `<article class="record-stat" style="--stat-color:${stat.color}"><span>${stat.label}</span><strong class="${stat.tone}" ${index < 3 ? "data-money" : ""}>${stat.value}</strong><small>${stat.copy}</small></article>`).join("");
  dom.historyMeta.textContent = records.length ? `${records.length} 份完整档案` : "暂无档案";
  dom.recordList.innerHTML = records.length ? [...records].reverse().map(recordRowHtml).join("") : emptyState("点击“新增档案”建立第一份记录。", "records");
}

function recordRowHtml(record) {
  const total = record.assets || 1;
  const liquid = totalForGroupsAt(record.date, ["liquid"]);
  const investment = totalForGroupsAt(record.date, ["investment"]);
  const longterm = totalForGroupsAt(record.date, ["longterm"]);
  const reserve = totalForGroupsAt(record.date, ["reserve", "other"]);
  return `<article class="record-row"><div class="record-date"><strong>${Number(record.date.slice(5, 7))}/${Number(record.date.slice(8, 10))}</strong><span>${record.date.slice(0, 4)} 年</span></div><div class="record-worth"><span>财富净值</span><strong data-money>${formatMoney(record.net)}</strong></div><div class="record-bar" aria-label="财富分布"><i style="width:${liquid / total * 100}%;background:#477c79"></i><i style="width:${investment / total * 100}%;background:#4d7c62"></i><i style="width:${longterm / total * 100}%;background:#a5743e"></i><i style="width:${reserve / total * 100}%;background:#6d5b85"></i></div><strong class="record-change ${signedClass(record.change)}" data-money>${formatSigned(record.change)}</strong><svg><use href="#icon-chevron"></use></svg></article>`;
}

function totalForGroupsAt(date, groupNames) {
  return state.accounts.filter((item) => groupNames.includes(getType(item).group)).reduce((sum, item) => sum + Math.max(0, getSnapshotAt(item.id, date)?.balance || 0), 0);
}

function renderAccounts() {
  dom.accountFilter.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === ui.accountFilter));
  const accounts = state.accounts.filter((item) => {
    const type = getType(item);
    if (ui.accountFilter === "all") return true;
    if (ui.accountFilter === "receivable") return type.id === "receivable";
    if (ui.accountFilter === "longterm") return ["longterm", "reserve", "other"].includes(type.group) && type.id !== "receivable";
    return type.group === ui.accountFilter;
  });
  dom.accountGrid.innerHTML = accounts.length ? accounts.map(accountCardHtml).join("") : emptyState("这个分类下还没有账户。", "accounts");
}

function accountCardHtml(item) {
  const type = getType(item);
  const group = groups[type.group];
  const latest = getLatestSnapshot(item.id);
  const balanceNote = type.kind === "debt" ? "从财富净值扣除" : type.kind === "restricted" ? "暂不计入当前财富" : type.id === "receivable" ? "等待对方归还" : "计入财富总额";
  const kindLabel = type.kind === "debt" ? "负债" : type.id === "receivable" ? "应收款" : group.name;
  const cardClass = type.kind === "restricted" ? " is-restricted" : type.id === "receivable" ? " is-receivable" : "";
  return `<article class="account-card${cardClass}" style="--account-color:${group.color};--account-soft:${group.soft}"><div class="account-card-body"><div class="account-card-head">${accountIdentityHtml(item, type)}<span class="account-kind">${kindLabel}</span></div><strong class="account-balance" data-money>${formatMoney(latest?.balance || 0)}</strong><div class="account-meta"><span>${latest ? `更新于 ${formatDate(latest.date)}` : "尚未收录"}</span><span>${balanceNote}</span></div><div class="account-actions"><button type="button" data-edit-account="${item.id}" aria-label="编辑账户" title="编辑账户"><svg><use href="#icon-edit"></use></svg></button><button class="delete" type="button" data-delete-account="${item.id}" aria-label="删除账户" title="删除账户"><svg><use href="#icon-trash"></use></svg></button></div></div></article>`;
}

function accountIdentityHtml(item, type) {
  const group = groups[type.group];
  return `<div class="account-identity" style="--account-color:${group.color};--account-soft:${group.soft}"><span class="account-icon">${type.icon}</span><div class="account-copy"><strong>${escapeHtml(displayName(item, type))}</strong><span>${escapeHtml(item.institution || type.name)}</span></div></div>`;
}

function openRecordDialog() {
  if (!state.accounts.length) {
    openAccountDialog();
    showToast("请先添加一个资产账户");
    return;
  }
  dom.recordForm.reset();
  dom.recordForm.elements.date.value = todayIso();
  dom.recordFormList.innerHTML = state.accounts.map((item) => {
    const type = getType(item);
    const latest = getLatestSnapshot(item.id);
    return `<div class="record-form-row ${type.kind === "debt" ? "is-debt" : ""}">${accountIdentityHtml(item, type)}<label class="balance-input"><span>¥</span><input type="number" name="balance-${item.id}" value="${Math.abs(latest?.balance || 0)}" step="0.01" required aria-label="${escapeHtml(displayName(item, type))}余额" /></label></div>`;
  }).join("");
  openDialog(dom.recordDialog);
}

function handleRecordSubmit(event) {
  event.preventDefault();
  const date = dom.recordForm.elements.date.value;
  state.accounts.forEach((item) => {
    let balance = Number(dom.recordForm.elements[`balance-${item.id}`].value);
    if (!Number.isFinite(balance)) balance = 0;
    if (getType(item).kind === "debt") balance = -Math.abs(balance);
    upsertSnapshot(item.id, date, balance);
  });
  state.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  state.settings.year = date.slice(0, 4);
  saveState();
  closeDialog(dom.recordDialog);
  render();
  showToast(`已保存 ${formatDate(date, true)} 财富档案`);
}

function openAccountDialog(accountId = "") {
  dom.accountForm.reset();
  populateTypeSelect();
  dom.accountForm.elements.accountId.value = accountId;
  dom.accountForm.elements.date.value = todayIso();
  dom.accountDialogTitle.textContent = accountId ? "编辑账户" : "添加账户";
  dom.accountSubmit.textContent = accountId ? "保存修改" : "保存账户";
  if (accountId) {
    const item = state.accounts.find((accountItem) => accountItem.id === accountId);
    if (!item) return;
    const latest = getLatestSnapshot(item.id);
    dom.accountForm.elements.type.value = item.type;
    dom.accountForm.elements.customName.value = ["other", "receivable"].includes(item.type) ? item.name || "" : "";
    dom.accountForm.elements.institution.value = item.institution || "";
    dom.accountForm.elements.date.value = latest?.date || todayIso();
    dom.accountForm.elements.balance.value = Math.abs(latest?.balance || 0);
  }
  syncAccountTypeFields();
  openDialog(dom.accountDialog);
}

function populateTypeSelect() {
  const selected = dom.accountTypeSelect.value;
  const sections = [
    ["现金账户", typeCatalog.filter((type) => type.group === "liquid")],
    ["投资账户", typeCatalog.filter((type) => type.group === "investment")],
    ["长期资产", typeCatalog.filter((type) => ["longterm", "reserve", "other"].includes(type.group) && type.id !== "receivable")],
    ["应收款", typeCatalog.filter((type) => type.id === "receivable")],
    ["受限权益（不计入当前财富）", typeCatalog.filter((type) => type.group === "restricted")],
    ["负债", typeCatalog.filter((type) => type.group === "debt")],
  ];
  dom.accountTypeSelect.innerHTML = sections.map(([label, types]) => `<optgroup label="${label}">${types.map((type) => `<option value="${type.id}">${type.name}</option>`).join("")}</optgroup>`).join("");
  if (typeById.has(selected)) dom.accountTypeSelect.value = selected;
}

function syncAccountTypeFields() {
  const type = typeById.get(dom.accountTypeSelect.value) || typeCatalog[0];
  const input = dom.accountForm.elements.customName;
  const needsCustomName = ["other", "receivable"].includes(type.id);
  dom.customTypeLabel.hidden = !needsCustomName;
  dom.accountDialogHelp.textContent = type.id === "receivable" ? "每位欠款人建立一个应收账户" : "账户名称由资产类型自动生成";
  dom.customTypeText.textContent = type.id === "receivable" ? "欠款人姓名" : "自定义名称";
  dom.customNameInput.placeholder = type.id === "receivable" ? "例如 张三" : "例如 黄金、外汇、收藏品";
  input.required = needsCustomName;
  if (!needsCustomName) input.value = "";
  dom.debtTip.hidden = type.kind !== "debt";
  dom.restrictedTip.hidden = type.kind !== "restricted";
  dom.receivableTip.hidden = type.id !== "receivable";
}

function handleAccountSubmit(event) {
  event.preventDefault();
  const data = new FormData(dom.accountForm);
  const accountId = String(data.get("accountId") || "") || uid();
  const type = typeById.get(String(data.get("type"))) || typeCatalog[0];
  const next = {
    id: accountId,
    type: type.id,
    name: ["other", "receivable"].includes(type.id) ? String(data.get("customName") || "").trim() : type.short,
    institution: String(data.get("institution") || "").trim(),
    currency: "CNY",
  };
  const existing = state.accounts.find((item) => item.id === accountId);
  if (existing) Object.assign(existing, next);
  else state.accounts.push(next);
  let balance = Number(data.get("balance"));
  if (!Number.isFinite(balance)) balance = 0;
  if (type.kind === "debt") balance = -Math.abs(balance);
  const date = String(data.get("date"));
  upsertSnapshot(accountId, date, balance);
  state.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  state.settings.year = date.slice(0, 4);
  saveState();
  closeDialog(dom.accountDialog);
  render();
  showToast(existing ? "账户已更新" : "账户已添加");
}

function deleteAccount(accountId) {
  const item = state.accounts.find((accountItem) => accountItem.id === accountId);
  if (!item || !confirm(`删除“${displayName(item, getType(item))}”及全部历史余额？`)) return;
  state.accounts = state.accounts.filter((accountItem) => accountItem.id !== accountId);
  state.snapshots = state.snapshots.filter((snapshot) => snapshot.accountId !== accountId);
  saveState();
  render();
  showToast("账户已删除");
}

function resetDemo() {
  if (!confirm("恢复示例数据会覆盖当前账户名录和盘点档案，确定继续吗？")) return;
  state = createDemoState();
  saveState();
  render();
  showToast("已恢复示例数据");
}

function exportRecords() {
  const rows = [["归档日期", "财富净值", "财富总额", "负债余额", "档案变动"], ...getRecords().map((record) => [record.date, record.net, record.assets, record.debt, record.change])];
  const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "财富档案.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("财富档案已导出");
}

function toggleAmounts() {
  ui.amountsHidden = !ui.amountsHidden;
  document.body.classList.toggle("amounts-hidden", ui.amountsHidden);
  dom.toggleAmounts.innerHTML = `<svg><use href="#icon-${ui.amountsHidden ? "eye-off" : "eye"}"></use></svg>`;
  dom.toggleAmounts.title = ui.amountsHidden ? "显示金额" : "隐藏金额";
  dom.toggleAmounts.setAttribute("aria-label", dom.toggleAmounts.title);
}

function getSnapshotAt(accountId, date) {
  return state.snapshots.filter((item) => item.accountId === accountId && item.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
}

function getLatestSnapshot(accountId) {
  return state.snapshots.filter((item) => item.accountId === accountId).sort((a, b) => b.date.localeCompare(a.date))[0];
}

function upsertSnapshot(accountId, date, balance) {
  const existing = state.snapshots.find((item) => item.accountId === accountId && item.date === date);
  if (existing) existing.balance = balance;
  else state.snapshots.push({ id: uid(), accountId, date, balance });
}

function getType(item) {
  return typeById.get(item.type) || typeById.get("other");
}

function displayName(item, type = getType(item)) {
  if (type.id === "other") return item.name || "其他";
  if (type.id === "receivable") return item.name || "应收款";
  return type.short;
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function showToast(message) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 2200);
}

function setSigned(element, value) {
  element.textContent = formatSigned(value);
  element.className = signedClass(value);
}

function signedClass(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0).replace("CN¥", "¥");
}

function formatCompactMoney(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 10000) return `¥${percentFormatter.format(number / 10000)}万`;
  return formatMoney(number);
}

function formatWan(value) {
  const number = Number(value) || 0;
  return `${percentFormatter.format(number / 10000)}万`;
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : "−"}${formatMoney(Math.abs(number))}`;
}

function formatDate(date, withYear = false) {
  const [year, month, day] = date.split("-");
  return `${withYear ? `${year}年` : ""}${Number(month)}月${Number(day)}日`;
}

function shortDate(date) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function emptyState(text, kind) {
  return `<div class="empty-state" data-empty="${kind}">${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso() {
  return toIsoDate(new Date());
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
