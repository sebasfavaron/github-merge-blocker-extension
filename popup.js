const MERGE_STRATEGIES = {
  merge: 'Create a merge commit',
  squash: 'Squash and merge',
  rebase: 'Rebase and merge',
};

const FIELD_OPTIONS = {
  owner: { label: 'Owner', placeholder: '' },
  repository: { label: 'Repository', placeholder: '' },
  baseBranch: { label: 'Base Branch', placeholder: '' },
  compareBranch: { label: 'Compare Branch', placeholder: '' },
  labels: { label: 'Labels', placeholder: '' },
  mergeStrategy: { label: 'Merge Strategy', placeholder: '' },
  detail: { label: 'Detail', placeholder: 'Optional note about this rule...' },
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

    // Ensure backward compatibility by adding required fields to existing rules
    rules = result.rules.map((rule) => ({
      ...rule,
      labels: rule.labels || '*',
      mergeStrategy: rule.mergeStrategy || 'merge', // Ensure all rules have a merge strategy
      detail: rule.detail || '',
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

  // Clean up event listeners from previous cards
  const existingCards = rulesList.querySelectorAll('.rule-card');
  existingCards.forEach((card) => {
    if (card._closeFieldSelector) {
      document.removeEventListener('click', card._closeFieldSelector);
    }
  });

  // Hide any open field selectors
  document.querySelectorAll('.field-selector').forEach((selector) => {
    selector.style.display = 'none';
  });

  rulesList.innerHTML = '';

  if (rules.length === 0) {
    rulesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>No rules configured yet. Click "Add Rule" to get started.</p>
      </div>
    `;
    return;
  }

  rules.forEach((rule, index) => {
    const ruleCard = createRuleCard(rule, index);
    rulesList.appendChild(ruleCard);
  });
}

// Check if a field is active (has a meaningful value)
function isFieldActive(value) {
  return value && value.trim() !== '' && value.trim() !== '*';
}

// Get active fields for a rule
function getActiveFields(rule) {
  const activeFields = [];

  Object.keys(FIELD_OPTIONS).forEach((fieldKey) => {
    if (fieldKey === 'mergeStrategy') {
      // Merge strategy is always considered active and present
      activeFields.push(fieldKey);
    } else if (isFieldActive(rule[fieldKey])) {
      activeFields.push(fieldKey);
    } else if (rule._newlyAdded && rule._newlyAdded.includes(fieldKey)) {
      // Include newly added fields even if they're empty
      activeFields.push(fieldKey);
    }
  });

  return activeFields;
}

// Get available fields that can be added to a rule
function getAvailableFields(rule) {
  const activeFields = getActiveFields(rule);
  return Object.keys(FIELD_OPTIONS).filter(
    (field) => !activeFields.includes(field) && field !== 'mergeStrategy' // Never allow adding merge strategy since it's always present
  );
}

// Create a rule card element
function createRuleCard(rule, index) {
  const card = document.createElement('div');
  card.className = 'rule-card';
  card.setAttribute('data-index', index);
  card.draggable = true;

  const activeFields = getActiveFields(rule);
  const availableFields = getAvailableFields(rule);

  // Generate field HTML (excluding merge strategy which goes in header)
  const fieldsHTML = activeFields
    .filter((fieldKey) => fieldKey !== 'mergeStrategy') // Merge strategy goes in header
    .map((fieldKey) => {
      const field = FIELD_OPTIONS[fieldKey];
      const value = rule[fieldKey] || '';
      const isDetailField = fieldKey === 'detail';

      return `
        <div class="field-group ${
          isDetailField ? 'detail-field' : ''
        }" data-field="${fieldKey}">
          <label class="field-label">${field.label}</label>
          <input type="text" class="rule-input ${
            isDetailField ? 'detail-input' : ''
          }" data-field="${fieldKey}" value="${value}" placeholder="${
        field.placeholder
      }">
          <button class="remove-field-button" data-field="${fieldKey}" title="Remove field">×</button>
        </div>
      `;
    })
    .join('');

  const mergeStrategyValue = rule.mergeStrategy || 'merge';

  card.innerHTML = `
    <div class="rule-card-header">
      <div class="priority-badge">
        <div class="priority-number">${index + 1}</div>
        <div class="drag-handle" title="Drag to reorder"></div>
      </div>
      <div class="merge-strategy-container">
        <select class="merge-strategy-select" data-field="mergeStrategy">
          <option value="merge" ${
            mergeStrategyValue === 'merge' ? 'selected' : ''
          }>${MERGE_STRATEGIES.merge}</option>
          <option value="squash" ${
            mergeStrategyValue === 'squash' ? 'selected' : ''
          }>${MERGE_STRATEGIES.squash}</option>
          <option value="rebase" ${
            mergeStrategyValue === 'rebase' ? 'selected' : ''
          }>${MERGE_STRATEGIES.rebase}</option>
        </select>
      </div>
      <div class="rule-actions">
        ${
          availableFields.length > 0
            ? `
          <button class="add-field-button" title="Add field">
            <svg viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1a1 1 0 011 1v4h4a1 1 0 110 2H8v4a1 1 0 11-2 0V8H2a1 1 0 110-2h4V2a1 1 0 011-1z"/>
            </svg>
          </button>
          <div class="field-selector" style="display: none;">
            ${availableFields
              .map((fieldKey) => {
                return `<button class="field-option" data-field="${fieldKey}">${FIELD_OPTIONS[fieldKey].label}</button>`;
              })
              .join('')}
          </div>
        `
            : ''
        }
        <button class="delete-button" title="Delete rule">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.575l.66-6.6a.75.75 0 00-1.492-.15L10.845 13.5H5.155l-.659-6.825z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="rule-fields">
      ${fieldsHTML}
    </div>
  `;

  // Add event listeners for inputs
  const inputs = card.querySelectorAll(
    '.rule-input, .rule-select, .merge-strategy-select'
  );
  inputs.forEach((input) => {
    input.addEventListener('input', (e) =>
      updateRule(index, e.target.dataset.field, e.target.value)
    );
  });

  // Add delete button listener
  const deleteButton = card.querySelector('.delete-button');
  deleteButton.addEventListener('click', () => deleteRule(index));

  // Add field removal listeners
  const removeButtons = card.querySelectorAll('.remove-field-button');
  removeButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      const fieldToRemove = e.target.dataset.field;
      removeField(index, fieldToRemove);
    });
  });

  // Add field selector listeners
  const addFieldButton = card.querySelector('.add-field-button');
  const fieldSelector = card.querySelector('.field-selector');
  const fieldOptions = card.querySelectorAll('.field-option');

  if (addFieldButton && fieldSelector) {
    addFieldButton.addEventListener('click', (e) => {
      e.stopPropagation();

      // Close any other open selectors first
      document.querySelectorAll('.field-selector').forEach((selector) => {
        if (selector !== fieldSelector) {
          selector.style.display = 'none';
        }
      });

      if (fieldSelector.style.display === 'block') {
        fieldSelector.style.display = 'none';
      } else {
        // Reset positioning to default (below button)
        fieldSelector.style.top = '100%';
        fieldSelector.style.bottom = 'auto';
        fieldSelector.style.marginTop = '4px';
        fieldSelector.style.marginBottom = '0';

        // Check if we need to position above instead
        const buttonRect = addFieldButton.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const estimatedDropdownHeight = Math.min(
          availableFields.length * 40 + 16,
          200
        );

        // If there's not enough space below, position above
        if (buttonRect.bottom + estimatedDropdownHeight > viewportHeight - 20) {
          fieldSelector.style.top = 'auto';
          fieldSelector.style.bottom = '100%';
          fieldSelector.style.marginTop = '0';
          fieldSelector.style.marginBottom = '4px';
        }

        fieldSelector.style.display = 'block';
      }
    });
  }

  fieldOptions.forEach((option, optionIndex) => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();

      const fieldToAdd = e.target.dataset.field;

      // Hide the selector
      if (fieldSelector) {
        fieldSelector.style.display = 'none';
      }

      // Add the field
      addField(index, fieldToAdd);
    });
  });

  // Store reference to close function for cleanup
  card._closeFieldSelector = (e) => {
    if (fieldSelector && fieldSelector.style.display === 'block') {
      // Close if clicking outside the field selector dropdown or the add field button
      if (
        !fieldSelector.contains(e.target) &&
        !addFieldButton.contains(e.target)
      ) {
        fieldSelector.style.display = 'none';
      }
    }
  };

  document.addEventListener('click', card._closeFieldSelector);

  // Add drag and drop event listeners
  setupDragAndDrop(card, index);

  return card;
}

// Add a field to a rule
function addField(ruleIndex, fieldKey) {
  if (rules[ruleIndex]) {
    // Set default value based on field type
    if (fieldKey === 'mergeStrategy') {
      rules[ruleIndex][fieldKey] = 'merge';
    } else {
      rules[ruleIndex][fieldKey] = '';
    }

    // Mark this field as newly added so it shows up immediately
    rules[ruleIndex]._newlyAdded = rules[ruleIndex]._newlyAdded || [];
    if (!rules[ruleIndex]._newlyAdded.includes(fieldKey)) {
      rules[ruleIndex]._newlyAdded.push(fieldKey);
    }

    renderRules();
    saveSettings();
  }
}

// Remove a field from a rule
function removeField(ruleIndex, fieldKey) {
  if (rules[ruleIndex] && fieldKey !== 'mergeStrategy') {
    // Prevent removing merge strategy
    // Reset to default/empty value
    rules[ruleIndex][fieldKey] = '*';

    // Clean up newly added tracking
    if (rules[ruleIndex]._newlyAdded) {
      const newlyAddedIndex = rules[ruleIndex]._newlyAdded.indexOf(fieldKey);
      if (newlyAddedIndex > -1) {
        rules[ruleIndex]._newlyAdded.splice(newlyAddedIndex, 1);
        if (rules[ruleIndex]._newlyAdded.length === 0) {
          delete rules[ruleIndex]._newlyAdded;
        }
      }
    }

    renderRules();
    saveSettings();
  }
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

    // If we're not over a specific rule card, handle container-level positioning
    if (
      !e.target.closest('.rule-card') ||
      e.target.closest('.rule-card').classList.contains('dragging')
    ) {
      const afterElement = getDragAfterElement(rulesList, e.clientY);

      if (afterElement == null) {
        rulesList.appendChild(draggedElement);
      } else {
        rulesList.insertBefore(draggedElement, afterElement);
      }

      // Clean up any card-specific visual feedback
      document.querySelectorAll('.rule-card').forEach((card) => {
        card.classList.remove('drag-above', 'drag-below', 'drag-over');
      });
    }
  });

  rulesList.addEventListener('drop', (e) => {
    e.preventDefault();
    // The card's dragend event will handle the final update
  });
}

// Add a new rule
function addRule() {
  const newRule = {
    mergeStrategy: 'merge', // Always include merge strategy by default
  };

  rules.push(newRule);
  renderRules();
  saveSettings();
}

// Update a rule
function updateRule(index, field, value) {
  if (rules[index]) {
    rules[index][field] = value;

    // Clean up newly added tracking if field now has a real value
    if (isFieldActive(value) && rules[index]._newlyAdded) {
      const newlyAddedIndex = rules[index]._newlyAdded.indexOf(field);
      if (newlyAddedIndex > -1) {
        rules[index]._newlyAdded.splice(newlyAddedIndex, 1);
        if (rules[index]._newlyAdded.length === 0) {
          delete rules[index]._newlyAdded;
        }
      }
    }

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
      baseBranch: 'release*',
      compareBranch: 'master*',
      mergeStrategy: 'merge',
      detail: 'Mergeback from master to release',
    },
    {
      baseBranch: 'master*',
      compareBranch: 'release*',
      mergeStrategy: 'merge',
      detail: 'Deploy from release to master',
    },
    {
      baseBranch: 'develop',
      compareBranch: 'release*',
      mergeStrategy: 'merge',
      detail: 'Mergeback from release to develop',
    },
    {
      compareBranch: '*mergeback*',
      mergeStrategy: 'merge',
      detail: 'Mergebacks in general',
    },
    {
      labels: '*fix*',
      mergeStrategy: 'squash',
      detail: 'Fixes in general',
    },
    {
      mergeStrategy: 'squash',
      detail: 'Default merge strategy',
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

// Setup drag and drop for a rule card
function setupDragAndDrop(card, index) {
  // Drag start
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());

    card.classList.add('dragging');
    window.draggedIndex = index;
    window.draggedElement = card;
  });

  // Drag end
  card.addEventListener('dragend', (e) => {
    card.classList.remove('dragging');
    cleanupDragEffects();

    // Update the order based on final DOM positions
    updateRuleOrderFromDOM();
  });

  // Drag over for individual cards
  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const draggedElement = document.querySelector('.dragging');
    if (!draggedElement || draggedElement === card) return;

    const container = document.getElementById('rules-list');
    const afterElement = getDragAfterElement(container, e.clientY);

    // Insert the dragged element in real-time
    if (afterElement == null) {
      container.appendChild(draggedElement);
    } else {
      container.insertBefore(draggedElement, afterElement);
    }

    // Add visual feedback
    updateDragVisualFeedback(card, e.clientY);
  });

  // Drag enter
  card.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!card.classList.contains('dragging')) {
      card.classList.add('drag-over');
    }
  });

  // Drag leave
  card.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // Only remove drag-over if we're actually leaving the element
    if (!card.contains(e.relatedTarget)) {
      card.classList.remove('drag-over');
    }
  });
}

// Update rule order based on current DOM positions
function updateRuleOrderFromDOM() {
  const rulesList = document.getElementById('rules-list');
  const allCards = rulesList.querySelectorAll('.rule-card');
  const newOrder = [];

  // Build new order based on current DOM order
  allCards.forEach((card) => {
    const originalIndex = parseInt(card.getAttribute('data-index'));
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
    ...container.querySelectorAll('.rule-card:not(.dragging)'),
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
function updateDragVisualFeedback(hoveredCard, mouseY) {
  // Remove previous feedback
  document.querySelectorAll('.rule-card').forEach((card) => {
    card.classList.remove('drag-over', 'drag-above', 'drag-below');
  });

  if (!hoveredCard || hoveredCard.classList.contains('dragging')) return;

  const rect = hoveredCard.getBoundingClientRect();
  const middleY = rect.top + rect.height / 2;

  if (mouseY < middleY) {
    hoveredCard.classList.add('drag-above');
  } else {
    hoveredCard.classList.add('drag-below');
  }
}

// Clean up drag effects
function cleanupDragEffects() {
  const allCards = document.querySelectorAll('.rule-card');
  allCards.forEach((card) => {
    card.classList.remove('dragging', 'drag-over', 'drag-above', 'drag-below');
  });
  window.draggedIndex = null;
  window.draggedElement = null;
}
