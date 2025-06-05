// Content script for GitHub PR pages
(function () {
  'use strict';

  let settings = null;
  let currentPageInfo = null;

  // Initialize the extension
  async function init() {
    try {
      await loadSettings();
      extractPageInfo();

      if (currentPageInfo) {
        applyMergeRules();
      }

      // Watch for dynamic changes to the page
      observePageChanges();
    } catch (error) {
      console.error('GitHub Merge Guardian: Error initializing:', error);
    }
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        rules: [],
        mergeButtonColor: '#ff8c00',
      });
      settings = result;
    } catch (error) {
      console.error('GitHub Merge Guardian: Error loading settings:', error);
      settings = { rules: [], mergeButtonColor: '#ff8c00' };
    }
  }

  // Extract information from the current GitHub PR page
  function extractPageInfo() {
    const url = window.location.href;
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);

    if (!match) return null;

    const [, owner, repository] = match;

    // Get base and compare branch information
    const branchInfo = getBranchInfo();

    currentPageInfo = {
      owner,
      repository,
      baseBranch: branchInfo.base || '',
      compareBranch: branchInfo.compare || '',
    };

    return currentPageInfo;
  }

  // Extract branch information from the page
  function getBranchInfo() {
    const branchInfo = { base: '', compare: '' };

    try {
      // Try to get from the branch selector area
      const branchSelectors = document.querySelectorAll(
        '[data-testid="branch-name"], .commit-ref'
      );

      if (branchSelectors.length >= 2) {
        branchInfo.base = branchSelectors[0].textContent.trim();
        branchInfo.compare = branchSelectors[1].textContent.trim();
      }

      // Fallback: try to extract from page title or other elements
      if (!branchInfo.base || !branchInfo.compare) {
        const titleElement = document.querySelector(
          '.gh-header-title .js-issue-title'
        );
        if (titleElement) {
          const titleText = titleElement.textContent;
          // This is a fallback - the actual implementation might need refinement
          // based on GitHub's current DOM structure
        }
      }

      // Another approach: look for merge branch information
      const mergeInfo = document.querySelector(
        '.merge-pr-more-info, .merge-message'
      );
      if (mergeInfo && !branchInfo.base) {
        const text = mergeInfo.textContent;
        const branchMatch = text.match(/into\s+([^\s]+)|from\s+([^\s]+)/g);
        if (branchMatch) {
          // Extract branch names from merge information
        }
      }
    } catch (error) {
      console.error(
        'GitHub Merge Guardian: Error extracting branch info:',
        error
      );
    }

    return branchInfo;
  }

  // Apply merge rules to disable inappropriate merge options
  function applyMergeRules() {
    if (!settings || !settings.rules || !currentPageInfo) return;

    const matchingRule = findMatchingRule();

    if (matchingRule) {
      disableUnwantedMergeOptions(matchingRule.mergeStrategy);
      customizeMergeButtonColor();
    }
  }

  // Find the first matching rule for the current PR
  function findMatchingRule() {
    for (const rule of settings.rules) {
      if (ruleMatches(rule, currentPageInfo)) {
        return rule;
      }
    }
    return null;
  }

  // Check if a rule matches the current page info
  function ruleMatches(rule, pageInfo) {
    return (
      wildcardMatch(rule.owner, pageInfo.owner) &&
      wildcardMatch(rule.repository, pageInfo.repository) &&
      wildcardMatch(rule.baseBranch, pageInfo.baseBranch) &&
      wildcardMatch(rule.compareBranch, pageInfo.compareBranch)
    );
  }

  // Check if a pattern matches a value (supporting wildcards)
  function wildcardMatch(pattern, value) {
    if (pattern === '*') return true;
    if (!pattern || !value) return pattern === value;

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\\\*/g, '.*'); // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`, 'i'); // Case insensitive
    return regex.test(value);
  }

  // Disable unwanted merge options
  function disableUnwantedMergeOptions(allowedStrategy) {
    const mergeOptionsMap = {
      merge: ['merge-commit', 'btn-group-merge'],
      squash: ['btn-group-squash', 'squash-and-merge'],
      rebase: ['btn-group-rebase', 'rebase-and-merge'],
    };

    // Find merge buttons/options
    const mergeButtonContainer = document.querySelector(
      '.merge-pr, .merge-status-list, [data-testid="merge-pull-request"]'
    );

    if (mergeButtonContainer) {
      // Disable buttons that don't match the allowed strategy
      Object.keys(mergeOptionsMap).forEach((strategy) => {
        if (strategy !== allowedStrategy) {
          const selectors = mergeOptionsMap[strategy];
          selectors.forEach((selector) => {
            const buttons = document.querySelectorAll(
              `.${selector}, [data-testid*="${selector}"], [aria-label*="${strategy}"]`
            );
            buttons.forEach((button) => {
              button.disabled = true;
              button.style.opacity = '0.5';
              button.style.cursor = 'not-allowed';
              button.title = `Disabled by GitHub Merge Guardian rule`;
            });
          });
        }
      });
    }

    // Also look for dropdown options in merge strategy selector
    const mergeStrategyDropdown = document.querySelector(
      '.merge-pr-more-info select, .merge-strategy-select'
    );
    if (mergeStrategyDropdown) {
      const options = mergeStrategyDropdown.querySelectorAll('option');
      options.forEach((option) => {
        const value = option.value.toLowerCase();
        if (
          (allowedStrategy === 'merge' && !value.includes('merge')) ||
          (allowedStrategy === 'squash' && !value.includes('squash')) ||
          (allowedStrategy === 'rebase' && !value.includes('rebase'))
        ) {
          option.disabled = true;
        }
      });
    }
  }

  // Customize merge button color
  function customizeMergeButtonColor() {
    if (!settings.mergeButtonColor) return;

    const mergeButtons = document.querySelectorAll(
      '.btn-primary[data-testid*="merge"], ' +
        '.merge-pr .btn-primary, ' +
        '[data-testid="merge-pull-request"] button, ' +
        '.merge-commit-button'
    );

    mergeButtons.forEach((button) => {
      if (
        button.type === 'submit' ||
        button.textContent.toLowerCase().includes('merge')
      ) {
        button.style.backgroundColor = settings.mergeButtonColor;
        button.style.borderColor = settings.mergeButtonColor;
      }
    });
  }

  // Observe page changes for dynamic content
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReapply = false;

      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                node.querySelector &&
                (node.querySelector('.merge-pr') ||
                  node.querySelector('[data-testid*="merge"]') ||
                  node.classList.contains('merge-pr'))
              ) {
                shouldReapply = true;
              }
            }
          });
        }
      });

      if (shouldReapply) {
        setTimeout(() => {
          extractPageInfo();
          applyMergeRules();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      loadSettings().then(() => {
        applyMergeRules();
      });
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
