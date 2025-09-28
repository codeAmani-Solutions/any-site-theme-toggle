chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["allowList"], v => {
    if (!Array.isArray(v.allowList)) {
      chrome.storage.sync.set({ allowList: ["portal2.thompsoncs.net"] });
    }
  });
});
