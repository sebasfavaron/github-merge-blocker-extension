# GitHub Merge Guardian

A Chrome extension that controls GitHub pull request merge options based on configurable rules.

## Features

- **Rule-based Merge Control**: Set rules based on repository owner, repository name, base branch, and compare branch
- **Wildcard Support**: Use `*` as a wildcard to match any value
- **Priority System**: Higher rules in the list take precedence over lower ones
- **Merge Strategy Enforcement**: Allow only specific merge strategies (merge commit, squash and merge, or rebase and merge)
- **Custom Button Colors**: Customize the merge button color for better visibility
- **Auto-save**: Rules and settings are automatically saved as you type

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this extension directory
4. The GitHub Merge Guardian icon should appear in your extensions toolbar

## Usage

1. Click the GitHub Merge Guardian extension icon to open the settings popup
2. Configure your rules in the Rulesets section:
   - **Owner**: GitHub username or organization
   - **Repository**: Repository name
   - **Base branch**: The branch being merged into
   - **Compare branch**: The branch being merged from
   - **Merge strategy**: Which merge option to allow
3. Use `*` as a wildcard for any field
4. Rules are applied in order - the first matching rule determines the allowed merge strategy
5. Customize the merge button color in the Color section
6. Visit any GitHub pull request page to see the extension in action

## Default Rules

The extension comes with these default rules:

- Branches matching `SQJG-3702-web-gen` → Create a merge commit
- Branches matching `*mergeback*` → Create a merge commit
- Branches matching `*fix*` → Squash and merge

## Rule Examples

- Allow only squash merge for feature branches: `*/*, */*, main, feature/*, squash`
- Enforce merge commits for release branches: `myorg/*, myorg/*, main, release/*, merge`
- Block all merges to main except from develop: `*/*, */*, main, develop, merge` (and disable other rules)

## Permissions

- `storage`: To save your rules and settings
- `activeTab`: To modify GitHub pages
- `https://github.com/*`: To run on GitHub pull request pages

## Development

To modify or extend the extension:

1. Edit the relevant files (`popup.js`, `content.js`, etc.)
2. Reload the extension in `chrome://extensions/`
3. Test on GitHub pull request pages

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html/css/js` - Settings interface
- `content.js/css` - GitHub page modification logic
- `background.js` - Service worker for storage and messaging
- `icons/` - Extension icons

## License

This project is open source and available under the MIT License.
