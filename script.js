const TOTAL_STUDENTS = 102;
const STORAGE_KEY = "class-thermometer-count";
const ADMIN_MODE_KEY = "class-thermometer-admin-mode";
const ADMIN_PASSWORD = "202611";
const MIN_TEMPERATURE = 12;
const MAX_TEMPERATURE = 38;

const adminPanelElement = document.querySelector("#adminPanel");
const adminToggleButton = document.querySelector("#adminToggleButton");
const fullscreenToggleButton = document.querySelector("#fullscreenToggleButton");
const adminModalElement = document.querySelector("#adminModal");
const adminModalBackdrop = document.querySelector("#adminModalBackdrop");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminPasswordInput = document.querySelector("#adminPassword");
const adminErrorElement = document.querySelector("#adminError");
const adminCancelButton = document.querySelector("#adminCancelButton");
const displayModeButton = document.querySelector("#displayModeButton");
const completedCountElement = document.querySelector("#completedCount");
const remainingCountElement = document.querySelector("#remainingCount");
const completionRateElement = document.querySelector("#completionRate");
const temperatureValueElement = document.querySelector("#temperatureValue");
const progressSummaryElement = document.querySelector("#progressSummary");
const displayProgressSummaryElement = document.querySelector("#displayProgressSummary");
const displayTemperatureValueElement = document.querySelector("#displayTemperatureValue");
const displayTitleElement = document.querySelector(".display-title");
const progressFillElement = document.querySelector("#progressFill");
const thermometerLiquidElement = document.querySelector("#thermometerLiquid");
const thermometerBulbElement = document.querySelector(".thermometer-bulb");
const thermometerPercentElement = document.querySelector("#thermometerPercent");
const messageBannerElement = document.querySelector("#messageBanner");
const goalChipElement = document.querySelector("#goalChip");
const increaseButton = document.querySelector("#increaseButton");
const decreaseButton = document.querySelector("#decreaseButton");
const resetButton = document.querySelector("#resetButton");
const manualForm = document.querySelector("#manualForm");
const manualCountInput = document.querySelector("#manualCount");
const manualApplyButton = document.querySelector("#manualApplyButton");
const DEFAULT_DISPLAY_TITLE = "학교폭력 실태조사 참여 온도계";
const FULLSCREEN_DISPLAY_TITLE = "참여 온도계";

let adminMode = window.sessionStorage.getItem(ADMIN_MODE_KEY) === "true";
let completedCount = loadSavedCount();
let previousRenderedCount = completedCount;
let countBoostTimeoutId = 0;

function clampCount(value) {
  return Math.min(TOTAL_STUDENTS, Math.max(0, value));
}

function loadSavedCount() {
  const savedValue = window.localStorage.getItem(STORAGE_KEY);
  const parsed = Number(savedValue);
  return Number.isFinite(parsed) ? clampCount(Math.round(parsed)) : 0;
}

function saveCount(count) {
  window.localStorage.setItem(STORAGE_KEY, String(count));
}

function getProgress(count) {
  return count / TOTAL_STUDENTS;
}

function getTemperature(progress) {
  return MIN_TEMPERATURE + (MAX_TEMPERATURE - MIN_TEMPERATURE) * progress;
}

function getStageMessage(progress, count) {
  if (count === 0) {
    return {
      banner: "한 명의 참여가 교실 온도를 올립니다.",
      chip: "출발 준비"
    };
  }

  if (progress < 0.25) {
    return {
      banner: "좋은 출발입니다. 참여가 쌓일수록 온도가 더 빠르게 올라갑니다.",
      chip: "따뜻해지는 중"
    };
  }

  if (progress < 0.5) {
    return {
      banner: "절반을 향해 가고 있습니다. 교실 참여 분위기가 살아나고 있어요.",
      chip: "분위기 상승"
    };
  }

  if (progress < 0.75) {
    return {
      banner: "응답이 안정적으로 모이고 있습니다. 목표 달성이 가까워졌습니다.",
      chip: "목표 가속"
    };
  }

  if (progress < 1) {
    return {
      banner: "거의 다 왔습니다. 마지막 참여까지 모이면 학급 온도계가 가득 찹니다.",
      chip: "완료 임박"
    };
  }

  return {
    banner: "102명 전원 응답 완료. 학급 온도계가 최고 온도에 도달했습니다.",
    chip: "응답 완료"
  };
}

function updateTheme(progress) {
  const coolHue = 205;
  const warmHue = 18;
  const hue = coolHue + (warmHue - coolHue) * progress;
  const warmStart = `hsl(${hue} 88% 67%)`;
  const warmEnd = `hsl(${Math.max(8, hue - 14)} 92% 57%)`;
  document.documentElement.style.setProperty("--warm-start", warmStart);
  document.documentElement.style.setProperty("--warm-end", warmEnd);
}

function updateCountBoostTheme(progress, count, delta) {
  const baseHue = 205 + (18 - 205) * progress;
  const hueOffset = Math.sin(count * 1.18) * 28;
  const burstHue = (baseHue + hueOffset + 360) % 360;
  const glowAlpha = Math.min(0.68, 0.34 + delta * 0.06);

  document.documentElement.style.setProperty("--boost-hue-shift", `${hueOffset.toFixed(1)}deg`);
  document.documentElement.style.setProperty("--boost-glow", `hsla(${burstHue.toFixed(1)}, 96%, 64%, ${glowAlpha.toFixed(2)})`);
}

function restartCountBoost(element) {
  element.classList.remove("count-boost");
  void element.offsetWidth;
  element.classList.add("count-boost");
}

function triggerCountBoost(count, previousCount, progress) {
  const delta = count - previousCount;

  if (delta <= 0) {
    return;
  }

  updateCountBoostTheme(progress, count, delta);
  restartCountBoost(thermometerLiquidElement);
  restartCountBoost(thermometerBulbElement);

  window.clearTimeout(countBoostTimeoutId);
  countBoostTimeoutId = window.setTimeout(() => {
    thermometerLiquidElement.classList.remove("count-boost");
    thermometerBulbElement.classList.remove("count-boost");
  }, 960);
}

function syncAdminControls(count) {
  const locked = !adminMode;
  adminPanelElement.hidden = locked;
  increaseButton.disabled = locked || count >= TOTAL_STUDENTS;
  decreaseButton.disabled = locked || count <= 0;
  resetButton.disabled = locked || count === 0;
  manualCountInput.disabled = locked;
  manualApplyButton.disabled = locked;
}

function setAdminMode(enabled) {
  adminMode = enabled;
  window.sessionStorage.setItem(ADMIN_MODE_KEY, String(enabled));
  document.body.classList.toggle("admin-mode", enabled);
  adminToggleButton.textContent = enabled ? "디스플레이 잠금" : "관리자 모드";
  syncAdminControls(completedCount);
}

function openAdminModal() {
  adminModalElement.hidden = false;
  document.body.classList.add("modal-open");
  adminPasswordInput.value = "";
  adminErrorElement.hidden = true;
  window.setTimeout(() => adminPasswordInput.focus(), 0);
}

function closeAdminModal() {
  adminModalElement.hidden = true;
  document.body.classList.remove("modal-open");
  adminErrorElement.hidden = true;
}

function canUseFullscreen() {
  return typeof document.fullscreenEnabled === "boolean"
    ? document.fullscreenEnabled
    : typeof document.documentElement.requestFullscreen === "function";
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function syncFullscreenButton() {
  if (!fullscreenToggleButton) {
    return;
  }

  const supported = canUseFullscreen();
  const active = supported && isFullscreenActive();

  fullscreenToggleButton.hidden = !supported;
  document.body.classList.toggle("is-fullscreen", active);
  fullscreenToggleButton.setAttribute("aria-pressed", active ? "true" : "false");
  fullscreenToggleButton.textContent = active ? "전체화면 해제" : "전체화면";

  if (displayTitleElement) {
    displayTitleElement.textContent = active ? FULLSCREEN_DISPLAY_TITLE : DEFAULT_DISPLAY_TITLE;
  }
}

async function toggleFullscreen() {
  if (!canUseFullscreen()) {
    return;
  }

  try {
    if (isFullscreenActive()) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.error("Failed to toggle fullscreen:", error);
  } finally {
    syncFullscreenButton();
  }
}

function render(count) {
  const previousCount = previousRenderedCount;
  const progress = getProgress(count);
  const percent = Math.round(progress * 100);
  const remaining = TOTAL_STUDENTS - count;
  const temperature = getTemperature(progress);
  const stageMessage = getStageMessage(progress, count);
  const liquidHeight = Math.max(10, progress * 100);

  completedCountElement.textContent = `${count}명`;
  remainingCountElement.textContent = `${remaining}명`;
  completionRateElement.textContent = `${percent}%`;
  temperatureValueElement.textContent = `${temperature.toFixed(1)}°C`;
  progressSummaryElement.textContent = `${count} / ${TOTAL_STUDENTS}`;
  displayProgressSummaryElement.textContent = `${count} / ${TOTAL_STUDENTS}`;
  displayTemperatureValueElement.textContent = `${temperature.toFixed(1)}°C`;
  progressFillElement.style.width = `${progress * 100}%`;
  thermometerLiquidElement.style.height = `${liquidHeight}%`;
  thermometerPercentElement.textContent = `${percent}%`;
  messageBannerElement.textContent = stageMessage.banner;
  goalChipElement.textContent = stageMessage.chip;
  manualCountInput.value = count === 0 ? "" : String(count);

  updateTheme(progress);
  triggerCountBoost(count, previousCount, progress);
  previousRenderedCount = count;
  saveCount(count);
  syncAdminControls(count);
}

setAdminMode(adminMode);
render(completedCount);
syncFullscreenButton();

adminToggleButton.addEventListener("click", () => {
  if (adminMode) {
    setAdminMode(false);
    return;
  }

  openAdminModal();
});

if (fullscreenToggleButton) {
  fullscreenToggleButton.addEventListener("click", () => {
    toggleFullscreen();
  });
}

if (displayModeButton) {
  displayModeButton.addEventListener("click", () => {
    setAdminMode(false);
  });
}

adminModalBackdrop.addEventListener("click", closeAdminModal);
adminCancelButton.addEventListener("click", closeAdminModal);

adminLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (adminPasswordInput.value === ADMIN_PASSWORD) {
    closeAdminModal();
    setAdminMode(true);
    return;
  }

  adminErrorElement.hidden = false;
  adminPasswordInput.select();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !adminModalElement.hidden) {
    closeAdminModal();
  }
});

document.addEventListener("fullscreenchange", syncFullscreenButton);

increaseButton.addEventListener("click", () => {
  if (!adminMode) {
    return;
  }

  completedCount = clampCount(completedCount + 1);
  render(completedCount);
});

decreaseButton.addEventListener("click", () => {
  if (!adminMode) {
    return;
  }

  completedCount = clampCount(completedCount - 1);
  render(completedCount);
});

resetButton.addEventListener("click", () => {
  if (!adminMode) {
    return;
  }

  completedCount = 0;
  render(completedCount);
});

manualForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!adminMode) {
    return;
  }

  const inputValue = Number(manualCountInput.value);
  completedCount = Number.isFinite(inputValue) ? clampCount(Math.round(inputValue)) : completedCount;
  render(completedCount);
});
