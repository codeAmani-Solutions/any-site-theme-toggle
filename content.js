// storage helpers
const storageLocal = {
  get: key => new Promise(r => chrome.storage.local.get([key], v => r(v[key]))),
  set: (key, val) => new Promise(r => chrome.storage.local.set({ [key]: val }, r))
};
const storageSync = {
  get: key => new Promise(r => chrome.storage.sync.get([key], v => r(v[key]))),
  set: (key, val) => new Promise(r => chrome.storage.sync.set({ [key]: val }, r))
};

// allow list helpers
async function getAllowList() {
  const list = await storageSync.get("allowList");
  return Array.isArray(list) ? list : [];
}
function hostMatches(list, host) {
  return list.some(entry => {
    entry = String(entry || "").trim();
    if (!entry) return false;
    if (entry.startsWith("*.")) {
      const base = entry.slice(2);
      return host === base || host.endsWith("." + base);
    }
    return host === entry || host.endsWith("." + entry);
  });
}

// theme logic
const hostKey = `anysite.theme.${location.host}`;

async function applyTheme(mode) {
  // prefer system when user picked system
  if (mode === "system") {
    const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("__anysite_dark", prefersDark);
    return;
  }
  document.documentElement.classList.toggle("__anysite_dark", mode === "dark");
}

function wireSystemListener() {
  const mql = matchMedia("(prefers-color-scheme: dark)");
  const onChange = async () => {
    const saved = await storageLocal.get(hostKey);
    if (!saved || saved === "system") applyTheme("system");
  };
  if (mql.addEventListener) mql.addEventListener("change", onChange);
  else if (mql.addListener) mql.addListener(onChange);
}

// floating widget
function injectUI() {
  const host = document.createElement("div");
  host.className = "anysite-host";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <link rel="stylesheet" href="${chrome.runtime.getURL("content.css")}">
    <div class="anysite-card" role="toolbar" aria-label="Theme">
      <button class="anysite-btn" id="btn-light" aria-label="Light" aria-pressed="false" title="Light">
        ${sunSVG()}
      </button>
      <button class="anysite-btn" id="btn-dark" aria-label="Dark" aria-pressed="false" title="Dark">
        ${moonSVG()}
      </button>
      <button class="anysite-btn" id="btn-system" aria-label="System" aria-pressed="false" title="System">
        ${monitorSVG()}
      </button>
    </div>
  `;
  document.documentElement.appendChild(host);

  const btnLight = shadow.getElementById("btn-light");
  const btnDark = shadow.getElementById("btn-dark");
  const btnSystem = shadow.getElementById("btn-system");

  const setPressed = mode => {
    [btnLight, btnDark, btnSystem].forEach(b => b.setAttribute("aria-pressed", "false"));
    if (mode === "light") btnLight.setAttribute("aria-pressed", "true");
    else if (mode === "dark") btnDark.setAttribute("aria-pressed", "true");
    else btnSystem.setAttribute("aria-pressed", "true");
  };

  btnLight.addEventListener("click", async () => {
    await storageLocal.set(hostKey, "light");
    setPressed("light");
    applyTheme("light");
  });
  btnDark.addEventListener("click", async () => {
    await storageLocal.set(hostKey, "dark");
    setPressed("dark");
    applyTheme("dark");
  });
  btnSystem.addEventListener("click", async () => {
    await storageLocal.set(hostKey, "system");
    setPressed("system");
    applyTheme("system");
  });

  (async () => {
    const saved = await storageLocal.get(hostKey);
    const mode = saved || "system";
    setPressed(mode);
    applyTheme(mode);
  })();
}

// hotkey Alt D to cycle
function wireHotkey() {
  window.addEventListener(
    "keydown",
    async e => {
      if (e.altKey && e.key.toLowerCase() === "d") {
        const cur = (await storageLocal.get(hostKey)) || "system";
        const next = cur === "light" ? "dark" : cur === "dark" ? "system" : "light";
        await storageLocal.set(hostKey, next);
        applyTheme(next);
      }
    },
    { passive: true }
  );
}

// inline icons
function sunSVG(){return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>`;}
function moonSVG(){return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;}
function monitorSVG(){return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M12 17v4M8 21h8"></path></svg>`;}

// boot only on allowed domains
(async () => {
  const list = await getAllowList();
  if (!hostMatches(list, location.hostname)) return;
  injectUI();
  wireSystemListener();
  wireHotkey();
})();
