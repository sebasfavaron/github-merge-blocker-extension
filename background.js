// Background service worker for GitHub Merge Guardian

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    const defaultSettings = {
      rules: [],
    };

    try {
      await chrome.storage.sync.set(defaultSettings);
    } catch (error) {
      console.error(
        'GitHub Merge Guardian: Error setting default settings:',
        error
      );
    }
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(null, (result) => {
      sendResponse(result);
    });
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle browser action click (optional - opens popup by default)
chrome.action.onClicked.addListener((tab) => {
  // This is only called if no popup is set in manifest
  // Since we have a popup, this won't be triggered normally
});
