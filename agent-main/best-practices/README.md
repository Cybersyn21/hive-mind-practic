# Best Practices for Hive Mind

This folder contains best practices, guidelines, and recommendations for working effectively with the Hive Mind AI agent orchestration system.

## Contents

- **[AI_WORKFLOW_GUIDE_RU.md](./AI_WORKFLOW_GUIDE_RU.md)** - Comprehensive guide on working with AI agents, including Hive Mind, Agent, and Agent Commander (in Russian)
- **[HOW_TO_WRITE_GITHUB_ISSUES.md](./HOW_TO_WRITE_GITHUB_ISSUES.md)** - Multi-lingual guide (English, Russian, Spanish) on writing effective GitHub issues for AI agents
- **[PROJECT_STRUCTURE_GUIDE.md](./PROJECT_STRUCTURE_GUIDE.md)** - Guide on organizing your project structure for optimal AI agent collaboration
- **[SYNERGISTIC_COLLABORATION.md](./SYNERGISTIC_COLLABORATION.md)** - Best practices for achieving synergistic collaboration between humans and AI agents

## Quick Start for New Users

### 1. Understanding the Hive Mind Ecosystem

Hive Mind consists of three main components:

1. **Hive Mind** - The orchestrator that manages other AI agents and coordinates work
2. **Agent** - Individual AI agents that execute specific tasks
3. **Agent Commander** - Tool for managing and controlling agent processes

### 2. Preparing Your Repository for AI Collaboration

Before working with Hive Mind, prepare your repository:

#### Essential Files

- `.claude/` directory for custom commands
- `CONTRIBUTING.md` with clear contribution guidelines
- `README.md` with comprehensive project documentation
- Test infrastructure for automated validation

#### Code Organization

- Keep files under 1500 lines for optimal AI processing
- Use clear, descriptive function and variable names
- Add JSDoc/docstring comments to all public APIs
- Implement verbose/debug modes for troubleshooting

### 3. Writing Effective Issues for AI Agents

Good issues should include:

**Clear Title**: `[Action] + [Target] + [Location]`
Example: "Fix TypeError in agent.execute() when called without parameters"

**Complete Description**:
- Current behavior vs. expected behavior
- Steps to reproduce (if applicable)
- Relevant error messages or logs
- Files affected

**Success Criteria**:
- How to verify the fix works
- What tests should pass
- Performance requirements (if applicable)

### 4. Three-Stage Problem Solving Approach

#### Stage 1: Deep Analysis
Ask the AI to perform case study analysis before coding:
```
Please download all logs and data related to the issue, compile them to
./docs/case-studies/issue-{id}, and perform deep case study analysis to
reconstruct timeline, find root causes, and propose solutions.
```

#### Stage 2: Test-Driven Development
Write tests first to define expected behavior:
```
Based on the requirements, write comprehensive unit tests that cover all
edge cases, test error handling, and use descriptive test names. Do NOT
write implementation code yet - only tests.
```

#### Stage 3: Implementation
Implement the solution to pass the tests:
```
Now implement the solution to make all tests pass. Ensure code quality
follows project standards and all edge cases are handled.
```

### 5. Key Principles for AI Collaboration

#### Provide Complete Context
- Share all relevant logs, error messages, and data
- Include screenshots AND digital data (error codes, stack traces)
- Attach sample files when needed

#### Maintain Immutable History
- Never edit Git history
- Don't delete issues or PRs - close them with explanation
- Add comments instead of editing previous ones
- Keep all data for future reference and AI training

#### Enable Verbose Logging
All projects should have debug/verbose modes:
```javascript
const DEBUG = process.env.DEBUG === 'true';
function log(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}
```

#### Use Case Study Approach
For complex problems:
1. Collect all relevant data
2. Reconstruct timeline of events
3. Identify root causes
4. Propose multiple solutions
5. Document the analysis

### 6. Project Structure Best Practices

```
your-project/
├── .claude/
│   └── commands/           # Custom slash commands
├── .github/
│   └── workflows/          # CI/CD pipelines
├── docs/
│   ├── case-studies/       # Problem analysis documentation
│   ├── API.md             # API documentation
│   └── CONTRIBUTING.md    # Contribution guidelines
├── examples/              # Usage examples
├── experiments/           # Experimental code for testing
├── src/                   # Source code
├── tests/                 # Test files
└── README.md             # Project overview
```

### 7. Working with Multiple Agents

Hive Mind can orchestrate multiple specialized agents:

- Use **general** agent for research and code exploration
- Use **build** agent for compilation and dependency management
- Use **plan** agent for task planning and organization
- Create custom agents for specific project needs

### 8. Troubleshooting Common Issues

#### Agent Not Understanding Context
✅ Solution: Provide more complete background, attach relevant files, use case study approach

#### Tests Failing After Changes
✅ Solution: Enable verbose mode, check CI logs, verify all edge cases covered

#### Performance Issues
✅ Solution: Profile code, check file sizes (<1500 lines), optimize database queries, add caching

### 9. Advanced Topics

#### Custom Commands (.claude/commands/)
Create reusable prompts for common tasks:
```markdown
---
description: Review code for quality issues
---
Perform thorough code review on $ARGUMENTS, checking for:
- Code quality and style adherence
- Potential bugs and edge cases
- Security vulnerabilities
- Missing tests
```

#### CI/CD Integration
Set up automated checks:
- Linting and formatting
- Type checking
- Unit and integration tests
- Security scanning
- Coverage reporting

#### MCP (Model Context Protocol) Integration
Use MCP servers for extended capabilities:
- Database access
- External API integration
- Custom tool development

## Resources

- [Hive Mind Repository](https://github.com/deep-assistant/hive-mind)
- [Agent Repository](https://github.com/link-assistant/agent)
- [Agent Commander Repository](https://github.com/deep-assistant/agent-commander)
- [Claude Code Documentation](https://code.claude.com/docs)

## Contributing to These Guides

Found an error or have a suggestion? Please:
1. Create an issue describing the improvement
2. Follow the guidelines in HOW_TO_WRITE_GITHUB_ISSUES.md
3. Submit a pull request with your changes

## License

These guides are released under the Unlicense (Public Domain).
