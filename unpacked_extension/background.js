  // eslint-disable-next-line no-undef
  chrome.tabs.onActivated.addListener(() => {
    // eslint-disable-next-line no-undef
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // eslint-disable-next-line no-undef
      chrome.tabs.sendMessage(tabs[0].id, {action: "closeExtensionDrawer"});
    });
  })