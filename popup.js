// Default rules and settings
const DEFAULT_RULES = [
  {
    owner: '*',
    repository: '*',
    baseBranch: '*',
    compareBranch: 'SQJG-3702-web-gen',
    mergeStrategy: 'merge',
  },
  {
    owner: '*',
    repository: '*',
    baseBranch: '*',
    compareBranch: '*mergeback*',
    mergeStrategy: 'merge',
  },
  {
    owner: '*',
    repository: '*',
    baseBranch: '*',
    compareBranch: '*fix*',
    mergeStrategy: 'squash',
  },
];

const DEFAULT_COLOR = '#ff8c00';

const MERGE_STRATEGIES = {
  merge: 'Create a merge commit',
  squash: 'Squash and merge',
  rebase: 'Rebase and merge',
};

let rules = [];
let mergeButtonColor = DEFAULT_COLOR;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderRules();
  setupEventListeners();
  updateExampleButton();
});

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get({
      rules: DEFAULT_RULES,
      mergeButtonColor: DEFAULT_COLOR,
    });

    rules = result.rules;
    mergeButtonColor = result.mergeButtonColor;

    document.getElementById('color-picker').value = mergeButtonColor;
  } catch (error) {
    console.error('Error loading settings:', error);
    rules = DEFAULT_RULES;
    mergeButtonColor = DEFAULT_COLOR;
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      rules: rules,
      mergeButtonColor: mergeButtonColor,
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

  return row;
}

// Setup event listeners
function setupEventListeners() {
  // Add rule button
  document.getElementById('add-rule').addEventListener('click', addRule);

  // Color picker
  document.getElementById('color-picker').addEventListener('input', (e) => {
    mergeButtonColor = e.target.value;
    updateExampleButton();
    saveSettings();
  });

  // Reset button
  document
    .getElementById('reset-defaults')
    .addEventListener('click', resetToDefaults);
}

// Add a new rule
function addRule() {
  const newRule = {
    owner: '*',
    repository: '*',
    baseBranch: '*',
    compareBranch: '*',
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

// Update example button color
function updateExampleButton() {
  const exampleButton = document.getElementById('example-button');
  exampleButton.style.backgroundColor = mergeButtonColor;
}

// Reset to defaults
async function resetToDefaults() {
  rules = [...DEFAULT_RULES];
  mergeButtonColor = DEFAULT_COLOR;

  document.getElementById('color-picker').value = mergeButtonColor;

  renderRules();
  updateExampleButton();
  await saveSettings();
}
