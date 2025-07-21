# 🌸 Git Pluck

> Sync specific files from one Git branch to another with rich file list support

Git Pluck allows you to selectively sync files from a source branch to a target branch, perfect for cherry-picking specific changes without merging entire branches.

## ✨ Features

- 🎯 **Selective File Sync** - Sync only the files you need
- 📋 **Rich File Lists** - Support for organized file lists with sections and comments
- 🔧 **Flexible Configuration** - Customize source/target branches and file lists
- 📊 **Detailed Progress** - Section-wise progress tracking and statistics
- 🛡️ **Error Recovery** - Continue syncing even if individual files fail
- 🚀 **Zero Dependencies** - Uses only Node.js built-ins

## 🚀 Quick Start

### Using npx (Recommended)
```bash
# Sync using default settings (development → production)
npx git-pluck

# Sync with custom file list
npx git-pluck my-files.txt

# Sync between different branches
npx git-pluck -s main -t staging
```

### Global Installation
```bash
npm install -g git-pluck
git-pluck --help
```

## 📋 File List Format

Git Pluck supports rich file list formatting with sections, comments, and metadata:

```
21 July Files

Assets 
- src/assets/images/logo.png
- src/assets/images/banner.jpg

CSS Changes
- src/styles/main.css (updated colors)
- src/styles/responsive.css
- src/components/Button.svelte

# This is a comment - will be ignored
Major Changes
- src/api/auth.js
- src/components/Dashboard.svelte (complete rewrite)

New Features
- src/features/notifications.js
- src/features/analytics.js
```

### Simple Format
For basic use cases, you can also use a simple format:
```
src/file1.js
src/file2.css
src/components/Component.svelte
```

## 🎛️ CLI Options

```
USAGE:
  npx git-pluck [options] [file-list]

OPTIONS:
  -f, --file-list <path>    Path to file list (default: files-to-pick.txt)
  -s, --source <branch>     Source branch name (default: development)
  -t, --target <branch>     Target branch name (default: production)
      --dry-run            Show what would be synced without making changes
  -v, --version            Show version number
  -h, --help               Show this help message
```

## 📝 Examples

### Basic Usage
```bash
# Create your file list
echo "src/components/Button.js" > files-to-pick.txt
echo "src/styles/button.css" >> files-to-pick.txt

# Sync the files
npx git-pluck
```

### Advanced Usage
```bash
# Sync from feature branch to main
npx git-pluck -s feature/new-ui -t main -f ui-files.txt

# Preview changes without applying them
npx git-pluck --dry-run

# Sync specific files with custom list
npx git-pluck -f deployment-files.txt
```

### Workflow Example
```bash
# 1. Switch to your target branch
git checkout production

# 2. Create or update your file list
cat > files-to-pick.txt << EOF
Critical Fixes
- src/auth/login.js
- src/api/endpoints.js

UI Updates  
- src/components/Header.svelte
- src/styles/main.css
EOF

# 3. Sync the files
npx git-pluck -s development

# 4. Review and commit
git diff --staged
git commit -m "Sync critical fixes and UI updates from development"
```

## 🔧 Configuration

Default configuration:
```javascript
{
  fileListPath: 'files-to-pick.txt',
  sourceBranch: 'development',
  targetBranch: 'production'
}
```

You can override these with CLI options or by creating different file lists for different scenarios.

## 📊 Output Example

```
Starting file synchronization...
Source: development → Target: production

✓ Already on production branch
✓ Found 25 file(s) in file list
✓ Organized into 4 section(s):
  • Assets: 3 file(s)
  • CSS Changes: 8 file(s)
  • Major Changes: 12 file(s)
  • New Features: 2 file(s)

📁 Assets (3 files):
──────────────────────────────────────────────────
Syncing: [Assets] src/assets/images/logo.png
  ✓ src/assets/images/logo.png

📁 CSS Changes (8 files):
──────────────────────────────────────────────────
Syncing: [CSS Changes] src/styles/main.css
  ✓ src/styles/main.css

✓ Staged 25 file(s)

============================================================
SYNCHRONIZATION COMPLETE
============================================================
Files processed: 25
Files skipped: 0

Overall success rate: 100.0%

🎉 All files synchronized successfully!
```

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/yourusername/git-pluck.git
cd git-pluck

# Install dependencies
npm install

# Test locally
npm test

# Link for local development
npm link
git-pluck --help
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Git's cherry-pick functionality
- Built for teams who need selective file synchronization
- Perfect for managing releases and hotfixes

---

**Made with ❤️ for developers who love precise Git workflows**