const MERGE_STRATEGIES = {
  merge: 'Create a merge commit',
  squash: 'Squash and merge',
  rebase: 'Rebase and merge',
};

let rules = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderRules();
  setupEventListeners();
});

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get({
      rules: [],
    });

    // Ensure backward compatibility by adding labels field to existing rules
    rules = result.rules.map((rule) => ({
      ...rule,
      labels: rule.labels || '*',
    }));
  } catch (error) {
    console.error('Error loading settings:', error);
    rules = [];
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      rules: rules,
    });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Render rules in the UI
function renderRules() {
  const rulesList = document.getElementById('rules-list');
  rulesList.innerHTML = '';

  rules.forEach((rule, index) => {
    const ruleRow = createRuleRow(rule, index);
    rulesList.appendChild(ruleRow);
  });
}

// Create a rule row element
function createRuleRow(rule, index) {
  const row = document.createElement('div');
  row.className = 'rule-row';
  row.setAttribute('data-index', index);
  row.draggable = true;

  row.innerHTML = `
    <div class="drag-handle"></div>
    <input type="text" class="rule-input" data-field="owner" value="${
      rule.owner
    }" placeholder="*">
    <input type="text" class="rule-input" data-field="repository" value="${
      rule.repository
    }" placeholder="*">
    <input type="text" class="rule-input" data-field="baseBranch" value="${
      rule.baseBranch
    }" placeholder="*">
    <input type="text" class="rule-input" data-field="compareBranch" value="${
      rule.compareBranch
    }" placeholder="*">
    <input type="text" class="rule-input" data-field="labels" value="${
      rule.labels || ''
    }" placeholder="*">
    <select class="rule-select" data-field="mergeStrategy">
      <option value="merge" ${
        rule.mergeStrategy === 'merge' ? 'selected' : ''
      }>${MERGE_STRATEGIES.merge}</option>
      <option value="squash" ${
        rule.mergeStrategy === 'squash' ? 'selected' : ''
      }>${MERGE_STRATEGIES.squash}</option>
      <option value="rebase" ${
        rule.mergeStrategy === 'rebase' ? 'selected' : ''
      }>${MERGE_STRATEGIES.rebase}</option>
    </select>
    <button class="delete-button" title="Delete rule">
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.575l.66-6.6a.75.75 0 00-1.492-.15L10.845 13.5H5.155l-.659-6.825z"/>
      </svg>
    </button>
  `;

  // Add event listeners for inputs
  const inputs = row.querySelectorAll('.rule-input, .rule-select');
  inputs.forEach((input) => {
    input.addEventListener('input', (e) =>
      updateRule(index, e.target.dataset.field, e.target.value)
    );
  });

  // Add delete button listener
  const deleteButton = row.querySelector('.delete-button');
  deleteButton.addEventListener('click', () => deleteRule(index));

  // Add drag and drop event listeners
  setupDragAndDrop(row, index);

  return row;
}

// Setup event listeners
function setupEventListeners() {
  // Add rule button
  document.getElementById('add-rule').addEventListener('click', addRule);

  // Load preset button
  document
    .getElementById('load-preset')
    .addEventListener('click', loadRMRolePreset);

  // Modal buttons
  document.getElementById('replace-rules').addEventListener('click', () => {
    applyPreset('replace');
    hideModal();
  });

  document.getElementById('add-rules').addEventListener('click', () => {
    applyPreset('add');
    hideModal();
  });

  document.getElementById('cancel-preset').addEventListener('click', hideModal);

  // Close modal when clicking outside
  document
    .getElementById('confirmation-modal')
    .addEventListener('click', (e) => {
      if (e.target.id === 'confirmation-modal') {
        hideModal();
      }
    });

  // Setup drag and drop for the rules list container
  setupRulesListDragAndDrop();
}

// Setup drag and drop for the rules list container
function setupRulesListDragAndDrop() {
  const rulesList = document.getElementById('rules-list');

  rulesList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const draggedElement = document.querySelector('.dragging');
    if (!draggedElement) return;

    // If we're not over a specific rule row, handle container-level positioning
    if (
      !e.target.closest('.rule-row') ||
      e.target.closest('.rule-row').classList.contains('dragging')
    ) {
      const afterElement = getDragAfterElement(rulesList, e.clientY);

      if (afterElement == null) {
        rulesList.appendChild(draggedElement);
      } else {
        rulesList.insertBefore(draggedElement, afterElement);
      }

      // Clean up any row-specific visual feedback
      document.querySelectorAll('.rule-row').forEach((row) => {
        row.classList.remove('drag-above', 'drag-below', 'drag-over');
      });
    }
  });

  rulesList.addEventListener('drop', (e) => {
    e.preventDefault();
    // The row's dragend event will handle the final update
  });
}

// Add a new rule
function addRule() {
  const newRule = {
    owner: '*',
    repository: '*',
    baseBranch: '*',
    compareBranch: '*',
    labels: '*',
    mergeStrategy: 'merge',
  };

  rules.push(newRule);
  renderRules();
  saveSettings();
}

// Update a rule
function updateRule(index, field, value) {
  if (rules[index]) {
    rules[index][field] = value;
    saveSettings();
  }
}

// Delete a rule
function deleteRule(index) {
  rules.splice(index, 1);
  renderRules();
  saveSettings();
}

// Load RM Role preset
function loadRMRolePreset() {
  if (rules.length > 0) {
    // Show custom modal for existing rules
    showModal();
  } else {
    // No existing rules, just apply the preset
    applyPreset('replace');
  }
}

// Show confirmation modal
function showModal() {
  document.getElementById('confirmation-modal').style.display = 'block';
}

// Hide confirmation modal
function hideModal() {
  document.getElementById('confirmation-modal').style.display = 'none';
}

// Apply the preset rules
function applyPreset(action) {
  // Define the RM Role preset rules
  const presetRules = [
    {
      owner: '*',
      repository: '*',
      baseBranch: '*',
      compareBranch: '*mergeback*',
      labels: '*',
      mergeStrategy: 'merge',
    },
    {
      owner: '*',
      repository: '*',
      baseBranch: 'master',
      compareBranch: '*',
      labels: '*',
      mergeStrategy: 'squash',
    },
    {
      owner: '*',
      repository: '*',
      baseBranch: 'develop',
      compareBranch: '*',
      labels: '*',
      mergeStrategy: 'squash',
    },
    {
      owner: '*',
      repository: '*',
      baseBranch: '*',
      compareBranch: 'fix/*',
      labels: '*',
      mergeStrategy: 'squash',
    },
  ];

  if (action === 'replace') {
    // Replace all rules
    rules = presetRules;
  } else if (action === 'add') {
    // Add preset rules to the beginning (higher precedence)
    rules = [...presetRules, ...rules];
  }

  renderRules();
  saveSettings();
}

// Setup drag and drop for a rule row
function setupDragAndDrop(row, index) {
  // Drag start
  row.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());

    row.classList.add('dragging');
    window.draggedIndex = index;
    window.draggedElement = row;
  });

  // Drag end
  row.addEventListener('dragend', (e) => {
    row.classList.remove('dragging');
    cleanupDragEffects();

    // Update the order based on final DOM positions
    updateRuleOrderFromDOM();
  });

  // Drag over for individual rows
  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const draggedElement = document.querySelector('.dragging');
    if (!draggedElement || draggedElement === row) return;

    const container = document.getElementById('rules-list');
    const afterElement = getDragAfterElement(container, e.clientY);

    // Insert the dragged element in real-time
    if (afterElement == null) {
      container.appendChild(draggedElement);
    } else {
      container.insertBefore(draggedElement, afterElement);
    }

    // Add visual feedback
    updateDragVisualFeedback(row, e.clientY);
  });

  // Drag enter
  row.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!row.classList.contains('dragging')) {
      row.classList.add('drag-over');
    }
  });

  // Drag leave
  row.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // Only remove drag-over if we're actually leaving the element
    if (!row.contains(e.relatedTarget)) {
      row.classList.remove('drag-over');
    }
  });
}

// Update rule order based on current DOM positions
function updateRuleOrderFromDOM() {
  const rulesList = document.getElementById('rules-list');
  const allRows = rulesList.querySelectorAll('.rule-row');
  const newOrder = [];

  // Build new order based on current DOM order
  allRows.forEach((row) => {
    const originalIndex = parseInt(row.getAttribute('data-index'));
    if (!isNaN(originalIndex) && rules[originalIndex]) {
      newOrder.push(rules[originalIndex]);
    }
  });

  // Only update if we have a valid new order
  if (newOrder.length === rules.length) {
    rules = newOrder;
    renderRules();
    saveSettings();
  }
}

// Get the element after which the dragged element should be inserted
function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll('.rule-row:not(.dragging)'),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

// Update visual feedback during drag
function updateDragVisualFeedback(hoveredRow, mouseY) {
  // Remove previous feedback
  document.querySelectorAll('.rule-row').forEach((row) => {
    row.classList.remove('drag-over', 'drag-above', 'drag-below');
  });

  if (!hoveredRow || hoveredRow.classList.contains('dragging')) return;

  const rect = hoveredRow.getBoundingClientRect();
  const middleY = rect.top + rect.height / 2;

  if (mouseY < middleY) {
    hoveredRow.classList.add('drag-above');
  } else {
    hoveredRow.classList.add('drag-below');
  }
}

// Clean up drag effects
function cleanupDragEffects() {
  const allRows = document.querySelectorAll('.rule-row');
  allRows.forEach((row) => {
    row.classList.remove('dragging', 'drag-over', 'drag-above', 'drag-below');
  });
  window.draggedIndex = null;
  window.draggedElement = null;
}
