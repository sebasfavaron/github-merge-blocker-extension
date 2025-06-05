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
      });
      settings = result;
    } catch (error) {
      console.error('GitHub Merge Guardian: Error loading settings:', error);
      settings = { rules: [] };
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
      labels: extractLabels(),
    };

    return currentPageInfo;
  }

  // Extract branch information from the page
  function getBranchInfo() {
    const branchInfo = { base: '', compare: '' };

    try {
      // Get base branch from the base-ref class
      const baseBranchElement = document.querySelector(
        '.base-ref .css-truncate-target'
      );
      if (baseBranchElement) {
        branchInfo.base = baseBranchElement.textContent.trim();
      }

      // Get compare branch from the head-ref class
      const compareBranchElement = document.querySelector(
        '.head-ref .css-truncate-target'
      );
      if (compareBranchElement) {
        branchInfo.compare = compareBranchElement.textContent.trim();
      }

      // Fallback: try the commit-ref approach with better selectors
      if (!branchInfo.base || !branchInfo.compare) {
        const commitRefs = document.querySelectorAll(
          '.commit-ref .css-truncate-target'
        );
        if (commitRefs.length >= 2) {
          branchInfo.base = commitRefs[0].textContent.trim();
          branchInfo.compare = commitRefs[1].textContent.trim();
        }
      }

      // Another fallback: extract from merge text
      if (!branchInfo.base || !branchInfo.compare) {
        const metaText = document.querySelector('.gh-header-meta');
        if (metaText) {
          const text = metaText.textContent;
          const intoMatch = text.match(/into\s+([^\s]+)/);
          const fromMatch = text.match(/from\s+([^\s]+)/);

          if (intoMatch) branchInfo.base = intoMatch[1];
          if (fromMatch) branchInfo.compare = fromMatch[1];
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

  // Extract labels from the PR page
  function extractLabels() {
    const labels = [];

    try {
      // Look for labels in the issue labels container
      const labelElements = document.querySelectorAll(
        '.js-issue-labels .IssueLabel'
      );

      labelElements.forEach((labelElement) => {
        // Try to get label name from data-name attribute
        const labelName = labelElement.getAttribute('data-name');
        if (labelName) {
          labels.push(labelName);
        } else {
          // Fallback: get text content from the span inside
          const textElement = labelElement.querySelector(
            '.css-truncate-target'
          );
          if (textElement) {
            labels.push(textElement.textContent.trim());
          }
        }
      });

      // Fallback: also look for other possible label selectors
      if (labels.length === 0) {
        const altLabelElements = document.querySelectorAll('[data-name]');
        altLabelElements.forEach((element) => {
          if (
            element.getAttribute('data-name') &&
            element.classList.contains('IssueLabel')
          ) {
            labels.push(element.getAttribute('data-name'));
          }
        });
      }
    } catch (error) {
      console.error('GitHub Merge Guardian: Error extracting labels:', error);
    }

    return labels;
  }

  // Apply merge rules to disable inappropriate merge options
  function applyMergeRules() {
    if (!settings || !settings.rules || !currentPageInfo) {
      return;
    }

    const matchingRule = findMatchingRule();

    if (matchingRule) {
      disableUnwantedMergeOptions(matchingRule.mergeStrategy);
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
      wildcardMatch(rule.compareBranch, pageInfo.compareBranch) &&
      labelMatches(rule.labels, pageInfo.labels)
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

  // Check if a label pattern matches the PR labels
  function labelMatches(labelPattern, prLabels) {
    // If pattern is * or empty, match all
    if (!labelPattern || labelPattern === '*') return true;

    // If no labels on PR, only match if pattern is * or empty
    if (!prLabels || prLabels.length === 0) {
      return labelPattern === '*' || labelPattern === '';
    }

    // Split pattern by comma to handle multiple label patterns
    const patterns = labelPattern
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // If no valid patterns, treat as wildcard
    if (patterns.length === 0) return true;

    // Check if any pattern matches any of the PR labels
    return patterns.some((pattern) => {
      // Check if this pattern matches any of the PR labels
      return prLabels.some((label) => wildcardMatch(pattern, label));
    });
  }

  // Disable unwanted merge options
  function disableUnwantedMergeOptions(allowedStrategy) {
    let buttonsFound = 0;
    let buttonsDisabled = 0;

    // Strategy mapping for the new GitHub interface
    const strategyMap = {
      merge: ['create a merge commit', 'merge commit'],
      squash: ['squash and merge', 'squash'],
      rebase: ['rebase and merge', 'rebase'],
    };

    // Find currently selected strategy from dropdown (if available) or other indicators
    let currentlySelected = null;

    // Method 1: Check dropdown items if dropdown is open
    const dropdownItems = document.querySelectorAll('[role="menuitemradio"]');

    dropdownItems.forEach((item) => {
      const isSelected = item.getAttribute('aria-checked') === 'true';
      const labelElement = item.querySelector(
        '.prc-ActionList-ItemLabel-TmBhn'
      );
      const labelText = labelElement
        ? labelElement.textContent.toLowerCase()
        : '';

      if (isSelected) {
        // Determine which strategy this corresponds to
        Object.keys(strategyMap).forEach((strategy) => {
          const keywords = strategyMap[strategy];
          if (keywords.some((keyword) => labelText.includes(keyword))) {
            currentlySelected = strategy;
          }
        });
      }
    });

    // Method 2: If dropdown not available, try alternative detection methods
    if (!currentlySelected) {
      // Check if there's any text indicator near the merge button
      const mergeButtonContainer = document.querySelector(
        '.prc-ButtonGroup-ButtonGroup-vcMeG'
      );
      if (mergeButtonContainer) {
        const containerText = mergeButtonContainer.textContent.toLowerCase();

        // Check for strategy indicators in surrounding text
        Object.keys(strategyMap).forEach((strategy) => {
          const keywords = strategyMap[strategy];
          if (keywords.some((keyword) => containerText.includes(keyword))) {
            currentlySelected = strategy;
          }
        });
      }

      // Method 3: Check for any other indicators (form inputs, data attributes, etc.)
      if (!currentlySelected) {
        // Look for hidden form inputs or data attributes that might indicate current strategy
        const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
        hiddenInputs.forEach((input) => {
          const value = (input.value || '').toLowerCase();
          const name = (input.name || '').toLowerCase();
          if (
            name.includes('merge') ||
            value.includes('merge') ||
            value.includes('squash') ||
            value.includes('rebase')
          ) {
            Object.keys(strategyMap).forEach((strategy) => {
              const keywords = strategyMap[strategy];
              if (keywords.some((keyword) => value.includes(keyword))) {
                currentlySelected = strategy;
              }
            });
          }
        });
      }

      // Method 4: Default assumption - GitHub typically defaults to merge commit
      if (!currentlySelected) {
        currentlySelected = 'merge'; // GitHub's default is usually merge commit
      }
    }

    // 1. Target the main merge button and disable it if wrong strategy is selected
    const mainMergeButtons = document.querySelectorAll(
      'button[data-variant="primary"]'
    );
    mainMergeButtons.forEach((button) => {
      const buttonText = (button.textContent || '').toLowerCase();

      // Check if this is a confirmation button (starts with "confirm")
      const isConfirmButton = buttonText.includes('confirm');

      if (
        buttonText.includes('merge pull request') ||
        buttonText.includes('merge') ||
        isConfirmButton
      ) {
        buttonsFound++;

        // Don't disable confirmation buttons - they should always be enabled once visible
        if (isConfirmButton) {
          // Always ensure confirmation buttons are enabled
          if (button.classList.contains('github-merge-guardian-disabled')) {
            button.disabled = false;
            button.style.opacity = '';
            button.style.cursor = '';
            button.title = '';
            button.classList.remove('github-merge-guardian-disabled');
          }
          return; // Skip further processing for confirmation buttons
        }

        // Disable main button if currently selected strategy doesn't match allowed
        if (currentlySelected && currentlySelected !== allowedStrategy) {
          button.disabled = true;
          button.style.opacity = '0.5';
          button.style.cursor = 'not-allowed';
          button.title = `GitHub Merge Guardian: Change merge method to "${allowedStrategy}" to enable this button`;
          button.classList.add('github-merge-guardian-disabled');
          buttonsDisabled++;
        } else {
          // Re-enable if it was previously disabled and now correct strategy is selected
          if (button.classList.contains('github-merge-guardian-disabled')) {
            button.disabled = false;
            button.style.opacity = '';
            button.style.cursor = '';
            button.title = '';
            button.classList.remove('github-merge-guardian-disabled');
          }
        }
      }
    });

    // 2. Target dropdown menu items in the overlay (when dropdown is open)
    dropdownItems.forEach((item) => {
      buttonsFound++;

      // Get the label text
      const labelElement = item.querySelector(
        '.prc-ActionList-ItemLabel-TmBhn'
      );
      const labelText = labelElement
        ? labelElement.textContent.toLowerCase()
        : '';

      // Check if this item should be disabled
      let shouldDisable = false;

      Object.keys(strategyMap).forEach((strategy) => {
        if (strategy !== allowedStrategy) {
          const keywords = strategyMap[strategy];
          if (keywords.some((keyword) => labelText.includes(keyword))) {
            shouldDisable = true;
          }
        }
      });

      if (shouldDisable) {
        // Disable the dropdown item
        item.setAttribute('aria-disabled', 'true');
        item.style.opacity = '0.5';
        item.style.cursor = 'not-allowed';
        item.style.pointerEvents = 'none';
        item.classList.add('github-merge-guardian-disabled');

        // Also disable click events
        item.addEventListener(
          'click',
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          true
        );

        buttonsDisabled++;
      } else {
        // Re-enable if it was previously disabled and is now the allowed strategy
        if (item.classList.contains('github-merge-guardian-disabled')) {
          item.removeAttribute('aria-disabled');
          item.style.opacity = '';
          item.style.cursor = '';
          item.style.pointerEvents = '';
          item.classList.remove('github-merge-guardian-disabled');
        }
      }
    });

    // 3. Also check for any other merge-related buttons
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach((button) => {
      const buttonText = (button.textContent || '').toLowerCase();
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const allText = `${buttonText} ${ariaLabel}`;

      // Skip if already processed or not merge-related
      if (
        !allText.includes('merge') &&
        !allText.includes('squash') &&
        !allText.includes('rebase') &&
        !allText.includes('confirm')
      ) {
        return;
      }

      // Skip main merge button and dropdown trigger (we handle these separately)
      if (
        allText.includes('merge pull request') ||
        allText.includes('select merge method')
      ) {
        return;
      }

      // Never disable confirmation buttons - they should always work once visible
      if (allText.includes('confirm')) {
        // Always ensure confirmation buttons are enabled
        if (button.classList.contains('github-merge-guardian-disabled')) {
          button.disabled = false;
          button.style.opacity = '';
          button.style.cursor = '';
          button.style.pointerEvents = '';
          button.title = '';
          button.classList.remove('github-merge-guardian-disabled');
        }
        return;
      }

      Object.keys(strategyMap).forEach((strategy) => {
        if (strategy !== allowedStrategy) {
          const keywords = strategyMap[strategy];
          if (keywords.some((keyword) => allText.includes(keyword))) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.style.pointerEvents = 'none';
            button.title = `Disabled by GitHub Merge Guardian rule - Only ${allowedStrategy} allowed`;
            button.classList.add('github-merge-guardian-disabled');
            buttonsDisabled++;
          }
        }
      });
    });
  }

  // Observe page changes for dynamic content
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReapply = false;

      mutations.forEach((mutation) => {
        // Check for added nodes
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                node.querySelector &&
                (node.querySelector('.merge-pr') ||
                  node.querySelector('[data-testid*="merge"]') ||
                  node.querySelector('.js-merge-commit-button') ||
                  node.querySelector('.js-merge-squash-button') ||
                  node.querySelector('.js-merge-rebase-button') ||
                  node.querySelector('[role="menuitemradio"]') ||
                  node.querySelector('.prc-ActionList-ItemLabel-TmBhn') ||
                  node.querySelector('button[data-variant="primary"]') ||
                  node.querySelector('.js-issue-labels') ||
                  node.querySelector('.IssueLabel') ||
                  node.classList.contains('merge-pr') ||
                  node.classList.contains('merge-status-list') ||
                  node.classList.contains('prc-Overlay-Overlay-dVyJl') ||
                  node.classList.contains('prc-ActionList-ActionList-X4RiC') ||
                  node.classList.contains('js-issue-labels') ||
                  node.classList.contains('IssueLabel'))
              ) {
                shouldReapply = true;
              }
            }
          });
        }

        // Check for text content changes (when buttons change text like "Merge" -> "Confirm merge")
        if (
          mutation.type === 'childList' ||
          mutation.type === 'characterData'
        ) {
          const target = mutation.target;
          if (target && target.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a button or contains buttons
            if (target.tagName === 'BUTTON' || target.querySelector('button')) {
              const text = target.textContent
                ? target.textContent.toLowerCase()
                : '';
              if (
                text.includes('merge') ||
                text.includes('confirm') ||
                text.includes('squash') ||
                text.includes('rebase')
              ) {
                shouldReapply = true;
              }
            }
          }
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
      characterData: true,
    });

    // Also try to reapply rules periodically for dynamic content
    setInterval(() => {
      applyMergeRules();
    }, 2000);
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
