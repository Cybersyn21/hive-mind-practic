# Project Structure Guide for AI Agent Collaboration

## Overview

This guide explains how to structure your project for optimal collaboration with AI agents like Hive Mind, Agent, and ClaudeCode.

## Core Principles

### 1. File Size Limits

**Maximum 1500 lines per code file**

Why? AI models have context windows. Keeping files under 1500 lines ensures:
- Complete file can be read in one context
- Better understanding of code structure
- Faster processing and analysis
- More accurate code modifications

**Exception**: Log files and documentation can be any size

**How to enforce**:
```bash
# Add to CI/CD pipeline
find src/ -name "*.js" -o -name "*.ts" | while read file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt 1500 ]; then
    echo "ERROR: $file has $lines lines (max 1500)"
    exit 1
  fi
done
```

### 2. SOLID Principles

Follow SOLID design principles:

- **S**ingle Responsibility - Each module/class has one purpose
- **O**pen/Closed - Open for extension, closed for modification
- **L**iskov Substitution - Subtypes must be substitutable for base types
- **I**nterface Segregation - Many specific interfaces better than one general
- **D**ependency Inversion - Depend on abstractions, not concretions

### 3. DRY (Don't Repeat Yourself)

- Extract common functionality into shared modules
- Use configuration files for repeated values
- Create utility functions for common operations
- Document reusable patterns

### 4. Self-Documenting Code

Write code that explains itself:

**Good**:
```javascript
function calculateMonthlyPayment(principal, annualRate, years) {
  const monthlyRate = annualRate / 12 / 100;
  const numberOfPayments = years * 12;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numberOfPayments));
}
```

**Bad**:
```javascript
function calc(p, r, y) {
  const m = r / 12 / 100;
  const n = y * 12;
  return (p * m) / (1 - Math.pow(1 + m, -n));
}
```

## Recommended Directory Structure

### Basic Structure

```
project-root/
├── .claude/                    # Claude Code configuration
│   ├── commands/              # Custom slash commands
│   │   ├── review.md         # Code review command
│   │   ├── test.md           # Testing command
│   │   └── deploy.md         # Deployment command
│   └── mcp.json              # MCP server configuration
│
├── .github/                   # GitHub configuration
│   ├── workflows/            # GitHub Actions
│   │   ├── ci.yml           # Continuous Integration
│   │   ├── cd.yml           # Continuous Deployment
│   │   └── security.yml     # Security scanning
│   ├── ISSUE_TEMPLATE/      # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docs/                      # Documentation
│   ├── case-studies/         # Problem analysis
│   │   └── issue-{id}/      # Per-issue documentation
│   │       ├── README.md
│   │       ├── TIMELINE.md
│   │       ├── ROOT-CAUSE.md
│   │       ├── SOLUTIONS.md
│   │       └── logs/
│   ├── API.md               # API documentation
│   ├── ARCHITECTURE.md      # Architecture overview
│   ├── CONTRIBUTING.md      # Contribution guide
│   └── DEPLOYMENT.md        # Deployment guide
│
├── examples/                  # Usage examples
│   ├── basic-usage.js
│   ├── advanced-features.js
│   └── README.md
│
├── experiments/              # Experimental code
│   ├── test-feature-x.js    # Feature experiments
│   └── README.md
│
├── src/                      # Source code
│   ├── index.js             # Entry point
│   ├── config/              # Configuration
│   ├── models/              # Data models
│   ├── controllers/         # Business logic
│   ├── services/            # Service layer
│   ├── utils/               # Utility functions
│   └── README.md
│
├── tests/                    # Tests
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   ├── e2e/                # End-to-end tests
│   └── README.md
│
├── .env.example             # Environment template
├── .eslintrc.json          # Linting configuration
├── .gitignore
├── .prettierrc             # Code formatting
├── CHANGELOG.md            # Version history
├── LICENSE
├── package.json
└── README.md
```

### For Monorepos

```
monorepo-root/
├── .claude/
├── .github/
├── docs/
├── packages/
│   ├── package-a/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   ├── package-b/
│   └── shared/
├── examples/
├── experiments/
└── README.md
```

## Essential Files

### README.md

Should include:
- Project description and purpose
- Installation instructions
- Quick start guide
- Usage examples
- Configuration options
- Contributing guidelines
- License

**Template**:
```markdown
# Project Name

Brief description of what this project does.

## Installation

\`\`\`bash
npm install package-name
\`\`\`

## Quick Start

\`\`\`javascript
const example = require('package-name');
example.doSomething();
\`\`\`

## Documentation

See [docs/API.md](docs/API.md) for full API documentation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
```

### CONTRIBUTING.md

Should include:
- How to set up development environment
- Code style guidelines
- Testing requirements
- Pull request process
- Issue reporting guidelines

### .env.example

Template for environment variables:
```bash
# API Configuration
API_KEY=your_api_key_here
API_URL=https://api.example.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp

# Feature Flags
ENABLE_DEBUG=false
ENABLE_VERBOSE=false
```

### CHANGELOG.md

Keep a changelog following [Keep a Changelog](https://keepachangelog.com):
```markdown
# Changelog

## [Unreleased]

## [1.0.0] - 2024-12-11
### Added
- Initial release
- Feature X

### Fixed
- Bug in feature Y
```

## Code Organization

### Source Code Structure

Organize by feature, not by type:

**Good** (Feature-based):
```
src/
├── authentication/
│   ├── login.js
│   ├── register.js
│   ├── passwordReset.js
│   └── index.js
├── users/
│   ├── userModel.js
│   ├── userController.js
│   ├── userService.js
│   └── index.js
```

**Acceptable** (Type-based, for smaller projects):
```
src/
├── models/
│   ├── User.js
│   └── Product.js
├── controllers/
│   ├── userController.js
│   └── productController.js
```

### Test Organization

Mirror your source structure:
```
src/authentication/login.js
tests/unit/authentication/login.test.js
```

Or group by test type:
```
tests/
├── unit/
│   └── authentication/
│       └── login.test.js
├── integration/
│   └── authentication/
│       └── authFlow.test.js
```

## Documentation Organization

### Case Studies Folder

For complex problems, create case study documentation:

```
docs/case-studies/issue-123/
├── README.md              # Overview
├── TIMELINE.md           # Event sequence
├── ROOT-CAUSE.md         # Analysis
├── SOLUTIONS.md          # Proposed fixes
├── IMPLEMENTATION.md     # Chosen solution
└── logs/                 # Collected logs
    ├── error.log
    └── ci-run.log
```

**README.md template**:
```markdown
# Issue #123: Authentication Timeout

## Summary
Brief description of the problem.

## Timeline
See [TIMELINE.md](TIMELINE.md)

## Root Cause Analysis
See [ROOT-CAUSE.md](ROOT-CAUSE.md)

## Proposed Solutions
See [SOLUTIONS.md](SOLUTIONS.md)

## Implementation
See [IMPLEMENTATION.md](IMPLEMENTATION.md)

## Outcome
- What was fixed
- Metrics before/after
- Lessons learned
```

### API Documentation

Structure API docs by resource:

```
docs/
├── API.md                 # Overview
├── api/
│   ├── authentication.md
│   ├── users.md
│   ├── products.md
│   └── openapi.yaml      # OpenAPI spec
```

## Configuration Files

### ESLint (.eslintrc.json)

```json
{
  "extends": ["eslint:recommended"],
  "rules": {
    "max-lines": ["error", 1500],
    "complexity": ["error", 10],
    "max-depth": ["error", 4]
  }
}
```

### Prettier (.prettierrc)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  file-size-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check file sizes
        run: |
          find src -name "*.js" -o -name "*.ts" | while read file; do
            lines=$(wc -l < "$file")
            if [ "$lines" -gt 1500 ]; then
              echo "::error file=$file::File has $lines lines (max 1500)"
              exit 1
            fi
          done
```

## Debug and Verbose Modes

### Configuration

```javascript
// config/debug.js
export const DEBUG = process.env.DEBUG === 'true';
export const VERBOSE = process.env.VERBOSE === 'true';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export function trace(module, message, data = {}) {
  if (VERBOSE) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'trace',
      module,
      message,
      ...data
    }));
  }
}

export function debug(module, message, data = {}) {
  if (DEBUG || VERBOSE) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'debug',
      module,
      message,
      ...data
    }));
  }
}
```

### Usage

```javascript
import { trace, debug } from './config/debug.js';

export async function processFile(path) {
  trace('processFile', 'Starting', { path });

  try {
    const data = await readFile(path);
    debug('processFile', 'File read', { path, size: data.length });

    const result = await transform(data);
    trace('processFile', 'Completed', { path, resultSize: result.length });

    return result;
  } catch (error) {
    debug('processFile', 'Error', { path, error: error.message, stack: error.stack });
    throw error;
  }
}
```

## Experiments Folder

Use `experiments/` for:
- Testing new features
- Reproducing bugs
- Performance benchmarking
- Proof of concepts

**Structure**:
```
experiments/
├── test-new-feature.js
├── reproduce-issue-123.js
├── benchmark-algorithm.js
└── README.md
```

Keep useful experiments for:
- Future reference
- Documentation examples
- Integration tests

## Examples Folder

Use `examples/` for:
- User-facing code examples
- Tutorial code
- Real-world use cases

**Structure**:
```
examples/
├── basic-usage.js
├── advanced-features.js
├── integration-example.js
└── README.md
```

## Summary Checklist

✅ Files under 1500 lines
✅ Clear directory structure
✅ Comprehensive README.md
✅ CONTRIBUTING.md with guidelines
✅ Case studies folder for complex issues
✅ Examples and experiments separated
✅ Debug/verbose modes implemented
✅ CI/CD pipeline configured
✅ Code follows SOLID principles
✅ Tests mirror source structure
✅ Documentation is up-to-date

## Resources

- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [Keep a Changelog](https://keepachangelog.com)
- [Conventional Commits](https://www.conventionalcommits.org)
