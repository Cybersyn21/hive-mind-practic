# Synergistic Collaboration with AI Agents

## Overview

This guide explains how to achieve synergistic collaboration between humans and AI agents, where the combined output exceeds what either could achieve independently.

## Core Philosophy

> "С агентом нужно настроить симбиоз, как сработать с коллегой."
>
> "You need to establish a symbiosis with the agent, like working with a colleague."
>
> — Konstantin Dyachenko, Hive Mind creator

### The Consensus Principle

**Key Insight**: When both human and AI work from the same set of facts and events, the probability of reaching consensus is higher.

**Practical Application**:
- Share complete context
- Provide all available data
- Include logs, screenshots, examples
- Describe both expected and actual behavior

### System Consensus

**Goal**: Bring all three components into alignment:
1. Human understanding
2. AI understanding
3. Code behavior

**When all three agree**, you've achieved true consensus:
- Expectations match implementation
- No misunderstandings remain
- System behaves as intended

## Establishing the Collaboration

### 1. Set Clear Expectations

**Do**:
✅ Clearly state what you want to achieve
✅ Provide context about why it matters
✅ Define success criteria upfront
✅ Explain constraints or limitations

**Don't**:
❌ Assume the AI knows your project
❌ Skip background information
❌ Leave goals ambiguous
❌ Hide relevant constraints

### 2. Provide Complete Data

> "Достаточно AI предоставить все данные как есть. Нужно чтобы он 'увидел', 'услышал' то же самое что и ты."
>
> "It's enough to provide AI with all data as-is. It needs to 'see' and 'hear' the same thing you do."

**What to share**:
- Full error logs (not truncated)
- Screenshots showing the issue
- Relevant code sections
- Configuration files
- Environment details
- Steps that led to the problem

### 3. Digital Data Over Screenshots

> "Я ему пытался картинки ошибок отдавать, но это прям лажа. А вот когда пошли цифры ошибок реальных, то сразу AI зашевелился."
>
> "I tried giving it error screenshots, but that was really poor. But when real error data came in, the AI immediately got moving."

**Best Practice**:
- Screenshots + Digital Data = Optimal
- Digital Data Only = Good
- Screenshots Only = Less Effective

**Example**:
```
❌ Poor: [screenshot of error]

✅ Good: [screenshot] + error text:
Error: ENOENT: no such file or directory
  at Object.readFileSync (fs.js:234:15)
  at processFile (/src/processor.js:45:20)

Stack trace:
[full stack trace here]
```

## The Three-Stage Approach

### Stage 1: Deep Analysis

**Before writing any code**, perform thorough analysis:

```
Please download all logs and data related to this issue, compile them to
./docs/case-studies/issue-{id}, and perform deep case study analysis.
Reconstruct the timeline of events, identify root causes, and propose
possible solutions.
```

**Benefits**:
- Understand the problem completely
- Avoid solving symptoms instead of root causes
- Identify all affected components
- Discover related issues

**Output**:
- Timeline of events
- Root cause analysis
- Multiple solution proposals
- Risk assessment for each solution

### Stage 2: Test-Driven Development

**Define expected behavior through tests FIRST**:

```
Based on the requirements in the issue, write comprehensive unit tests that:
1. Cover all edge cases
2. Test error handling
3. Use descriptive test names
4. Include setup and teardown

Do NOT write implementation code yet - only tests.
```

**Why TDD with AI**:
- Tests serve as executable specifications
- AI understands requirements precisely
- Changes can be verified automatically
- Regression prevention built-in

### Stage 3: Implementation

**Now implement the solution**:

```
Implement the solution to make all tests pass. Follow project coding
standards, handle all edge cases identified in tests, and maintain
code quality metrics.
```

**Verification**:
- All tests pass ✅
- Code coverage meets targets ✅
- Linting passes ✅
- Behavior matches requirements ✅

## Iterative Refinement

### Patience and Persistence

> "Всё это требует терпения и упорства. Но если не сильно принимать всё близко к сердцу, просто знать, что рано или поздно оно будет исправлено."
>
> "All this requires patience and perseverance. But if you don't take everything too much to heart, just know that sooner or later it will be fixed."

**Mindset**:
- First attempts may not be perfect
- Each iteration provides more data
- Failed attempts teach the AI
- Complex problems take multiple rounds

**Process**:
1. Try the AI's solution
2. Observe what works and what doesn't
3. Provide feedback with specific details
4. Let AI refine based on new information
5. Repeat until consensus reached

### Effective Feedback Loop

**Good Feedback**:
```
The solution works for normal cases, but fails when:
- Input is empty string
- File doesn't exist
- Network timeout occurs

Error from empty string case:
[exact error message and stack trace]

Expected behavior: Should return empty array for empty input
```

**Poor Feedback**:
```
It doesn't work
```

## Enabling AI Success

### 1. Verbose Mode

> "Во всех своих проектах я теперь --verbose или --debug режим всшиваю намертво."
>
> "In all my projects now I hard-code --verbose or --debug mode."

**Implementation**:
```javascript
const DEBUG = process.env.DEBUG === 'true';
const VERBOSE = process.env.VERBOSE === 'true';

function trace(module, action, data = {}) {
  if (VERBOSE) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      module,
      action,
      ...data
    }));
  }
}
```

**Benefits**:
- Complete execution trace available
- AI can diagnose issues from logs
- No bug can hide from verbose output
- Reproducible debugging

### 2. Immutable History

> "История должна быть add only (только дополняемая) и её прошлое должно быть immutable (неизменяемое)."
>
> "History should be add-only and its past should be immutable."

**Rules**:
- Never delete issues ❌
- Never delete pull requests ❌
- Never edit git history ❌
- Never remove comments ❌

**Why**:
- Preserves learning data for AI
- Prevents confusion in distributed teams
- Maintains complete audit trail
- Helps future developers (human and AI)

**Do Instead**:
- Close issues with explanation ✅
- Add clarifying comments ✅
- Create new commits for fixes ✅
- Mark deprecated code with comments ✅

### 3. Case Study Documentation

For complex problems, document the journey:

**Structure**:
```
docs/case-studies/issue-{id}/
├── README.md              # Overview and summary
├── TIMELINE.md           # Sequence of events
├── ROOT-CAUSE.md         # Analysis of root causes
├── SOLUTIONS.md          # Proposed solutions
├── DECISION.md           # Chosen solution and why
└── logs/                 # All collected data
    ├── ci-logs/
    ├── error-traces/
    └── screenshots/
```

**Benefits**:
- Future reference for similar issues
- Training data for AI
- Knowledge base for team
- Transparent decision making

## Asking the Right Questions

### Empowering the AI

Instead of asking AI to solve directly, ask it to:

1. **Analyze First**:
   ```
   Analyze this error and identify all possible root causes, ranked by
   probability. For each cause, explain what evidence supports it.
   ```

2. **Propose Multiple Solutions**:
   ```
   Propose 3 different approaches to solve this, with pros and cons for each.
   Include complexity estimates and potential risks.
   ```

3. **Validate Approach**:
   ```
   Before implementing, review this plan and identify any potential issues,
   edge cases I haven't considered, or better alternatives.
   ```

### Effective Prompts

**General Problem Solving**:
```
I have issue #123. Please:
1. Read the full issue description
2. Examine related code in [specific files]
3. Check logs in [location]
4. Perform root cause analysis
5. Propose solutions with tradeoffs

Save analysis to docs/case-studies/issue-123/ before implementing anything.
```

**Code Review**:
```
Review [file] for:
- SOLID principle violations
- Potential bugs and edge cases
- Performance issues
- Security vulnerabilities
- Missing tests
- Documentation gaps

For each issue found, provide:
- Severity (critical/major/minor)
- Line number
- Explanation
- Suggested fix
```

**Refactoring**:
```
This [file] violates Single Responsibility Principle. Please:
1. Identify distinct responsibilities
2. Propose how to split into smaller modules
3. Show example of refactored structure
4. Explain migration path

Do NOT implement yet - wait for approval of approach.
```

## Collaboration Patterns

### Pattern 1: Question-First

**Human**: "How should I structure authentication for this API?"
**AI**: *Asks clarifying questions about requirements, constraints, existing architecture*
**Human**: *Provides detailed answers*
**AI**: *Proposes architecture based on complete understanding*

### Pattern 2: Iterative Refinement

**Human**: "Implement user search"
**AI**: *Implements basic version*
**Human**: "Works, but needs to handle partial matches"
**AI**: *Adds fuzzy matching*
**Human**: "Good, now add pagination"
**AI**: *Adds pagination while preserving fuzzy matching*

### Pattern 3: Pair Programming

**Human**: "Let's solve issue #45 together"
**AI**: "I've analyzed the issue. The root cause appears to be X. Should we verify this hypothesis first?"
**Human**: "Yes, how can we verify?"
**AI**: "We can add logging to these 3 points..."
*[Collaborative debugging session]*

## Red Flags - When Collaboration Breaks Down

### Signs of Poor Collaboration

❌ AI keeps making the same mistake repeatedly
❌ Solutions don't address the actual problem
❌ AI asks for information already provided
❌ Implementation conflicts with requirements
❌ No progress after multiple iterations

### How to Reset

1. **Step Back**: "Let's start over. I'll provide complete context."

2. **Simplify**: Break complex problem into smaller pieces

3. **Be Explicit**: State assumptions, constraints, and goals clearly

4. **Verify Understanding**: "Before proceeding, explain your understanding of the problem"

5. **Change Approach**: Try different stage (analysis instead of coding, or vice versa)

## Success Metrics

### How to Know Collaboration is Working

✅ AI asks clarifying questions when ambiguous
✅ Solutions address root causes, not symptoms
✅ Code quality meets or exceeds standards
✅ Tests catch edge cases you didn't think of
✅ Documentation is comprehensive and accurate
✅ Iterations move progressively toward solution
✅ Both human and AI learn from the process

## Advanced Techniques

### Custom Sub-Prompts

Create reusable prompts for your workflow:

**.claude/commands/analyze.md**:
```markdown
---
description: Deep analysis before implementation
---
Before writing any code for $ARGUMENTS, perform deep analysis:

1. Read all related issues and PRs
2. Examine affected code
3. Check for similar past issues
4. Identify root causes
5. Propose multiple solutions

Document findings in docs/case-studies/[issue-id]/
Ask clarifying questions if anything is ambiguous.
```

### Fact-Checking Protocol

> "Фактчекинг проводится так: 1) Из текста выделяется список утверждений. 2) Каждое утверждение проверяется. 3) Если это факт о коде, должна быть цитата или ссылка на код."
>
> "Fact-checking is done like this: 1) Extract list of claims from text. 2) Verify each claim. 3) If it's a fact about code, there must be a quote or reference to code."

**Implementation**:
```
Please fact-check your analysis:
1. List all claims made
2. For each claim about code: provide exact file path and line number
3. For each claim about behavior: provide test case or log evidence
4. Mark any unverified claims as "needs verification"
```

### Data-Driven Decisions

Collect metrics to optimize collaboration:

**Track**:
- Issues solved on first attempt vs. iterations needed
- Time from issue creation to resolution
- Test coverage improvements
- Bug recurrence rates
- Code quality scores over time

**Adjust Based On**:
- If many iterations needed → Provide more upfront context
- If tests miss bugs → Improve test requirements in prompts
- If quality decreases → Add code review step
- If bugs recur → Implement case study for complex issues

## Summary: The Symbiotic Workflow

1. **Prepare Context**: Gather all data, logs, and relevant information
2. **Deep Analysis**: Let AI analyze before coding
3. **Define Behavior**: Write tests first (TDD)
4. **Implement Solution**: AI codes to pass tests
5. **Iterate with Feedback**: Refine based on results
6. **Document Journey**: Case study for complex issues
7. **Preserve History**: Keep all data for future reference

**Remember**:
- Patience and persistence required
- Each failure teaches the AI
- Complete data leads to consensus
- Immutable history builds knowledge
- Symbiosis creates synergy

## Resources

- [AI Workflow Guide](./AI_WORKFLOW_GUIDE_RU.md)
- [How to Write GitHub Issues](./HOW_TO_WRITE_GITHUB_ISSUES.md)
- [Project Structure Guide](./PROJECT_STRUCTURE_GUIDE.md)
