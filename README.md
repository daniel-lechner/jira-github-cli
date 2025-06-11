# Jira-GitHub CLI (jgh)

A command-line tool to create linked Jira and GitHub issues with support for assignments, labels, and status transitions.

## Features

- Create linked Jira and GitHub issues simultaneously
- Parse title for assignments (`@me`), labels (`#tag`), and status (`(Status)`)
- Support for explicit flags
- Automatic user assignment in both platforms
- GitHub label management
- Jira status transitions
- Mixed parsing and flag approach

## Installation

1. Clone or download the project
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Install globally (optional):

```bash
# install globally to use `jgh` command anywhere
npm install -g @lechnerio/jira-github-cli
```

## Setup

Configure your Jira and GitHub credentials:

```bash
jgh setup
```

You'll need:

- Jira URL (e.g., https://your-domain.atlassian.net)
- Jira email address
- Jira API token ([create one here](https://id.atlassian.com/manage-profile/security/api-tokens))
- Jira project key (e.g., PRJ)
- Default issue type

GitHub CLI Setup:

⚠️ Make sure GitHub CLI is installed and authenticated!

```bash
# Install GitHub CLI
brew install gh

# Authenticate
gh auth login
```

## Usage

### Basic Commands

```bash
# View current configuration
jgh config

# Create basic issue
jgh create "Fix login bug"

# Create with description
jgh create "Fix login bug" --description "Users cannot log in with OAuth"
```

### Title Parsing (Smart Syntax)

```bash
# Assign to yourself, add labels, set status
jgh create "Fix login bug @me #bug #urgent (In Progress)"

# Just assignment and labels
jgh create "Update documentation @me #docs #improvement"

# Just status transition
jgh create "Review code (Code Review)"
```

### Explicit Flags

Use command-line flags for precise control:

```bash
# Assign to yourself
jgh create "Fix login bug" --assign-me

# Add GitHub labels
jgh create "Fix login bug" --labels "bug,urgent,frontend"

# Set Jira status
jgh create "Fix login bug" --status "In Progress"

# Combine multiple options
jgh create "Fix login bug" --assign-me --labels "bug,urgent" --status "In Progress"
```

### Mixed Approach

Combine parsing and flags:

```bash
# Parse assignment, use flags for labels and status
jgh create "Fix login bug @me" --labels "bug,urgent" --status "In Progress"

# Parse labels, use flags for assignment and status
jgh create "Update docs #documentation" --assign-me --status "In Review"
```

### Advanced Examples

```bash
# Complex issue with all features
jgh create "Implement user authentication @me #feature #backend #security (In Progress)" \
  --description "Add OAuth2 integration with role-based access control"

# Bug report with specific issue type
jgh create "Login form validation error @me #bug" \
  --type "Bug" \
  --description "Email validation regex is too restrictive"

# Story with custom status
jgh create "User profile page redesign" \
  --assign-me \
  --labels "ui,story,design" \
  --status "Design Review" \
  --type "Story"
```

## Development

```bash
# Use -- to pass arguments through npm
npm run dev -- create "Test issue @me #test" --labels "development"

# Watch for changes
npm run watch
```

Build for production:

```bashs
npm run build
```
