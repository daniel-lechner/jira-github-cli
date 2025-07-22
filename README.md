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
# Setup and Configuration
jgh setup                          # Initial configuration setup
jgh reconfigure                    # Update missing/incomplete settings
jgh config                         # View current configuration

# Create Issues
jgh create "Fix login bug"                                    # Basic issue
jgh create "Fix login bug +bug +urgent @me"                  # With labels and assignment
jgh create "Fix login bug !high +critical @me"              # With priority, labels, assignment
jgh create "Fix login bug (in progress) !medium +backend"   # With status, priority, labels
jgh create "User registration feature !low" -d "Add user registration with email validation" -t Story

# Update Issues
jgh update PRJ-123 "+bug"                     # Add label
jgh update PRJ-123 "-old +new"               # Remove old label, add new label
jgh update PRJ-123 "@me"                     # Assign to yourself
jgh update PRJ-123 "@unassign"               # Unassign from everyone
jgh update PRJ-123 "!high"                   # Set high priority
jgh update PRJ-123 "(in progress)"           # Change status
jgh update PRJ-123 "(done)"                  # Mark as done (closes GitHub issue)
jgh update PRJ-123 "(closed)"                # Close issue
jgh update PRJ-123 "!medium +urgent @me"     # Combine: priority + label + assignment

# List Issues
jgh list                           # Show all open issues with sync status
jgh list mine                      # Show only issues assigned to you

# Time Related Commands
jgh estimate PRJ-123 3h
jgh time PRJ-123 2h "Fixed XYZ"

# Detail with all Infos
jgh details PRJ-123


# Priority Levels
!asap    # Maps to "Express" in Jira, creates "high-priority" label in GitHub
!high    # Maps to "High" in Jira, creates "high-priority" label in GitHub
!medium  # Maps to "Medium" in Jira, creates "medium-priority" label in GitHub
!low     # Maps to "Low" in Jira, creates "low-priority" label in GitHub

# Status Examples (depends on your Jira workflow)
(todo)           # Move to To Do
(in progress)    # Move to In Progress
(review)         # Move to Review
(done)           # Mark as Done (closes GitHub issue)
(closed)         # Close issue (closes GitHub issue)
(rejected)       # Reject issue (closes GitHub issue)

# Issue Icons in List View
🔄  # Synced to both Jira and GitHub (green)
🗂️  # Jira only (yellow)
💻  # GitHub only (white)

# Complex Examples
jgh create "Database migration !high +backend +migration @me (in progress)" -d "Migrate user table to new schema"
jgh update PRJ-456 "!low -urgent +maintenance (review)"
jgh create "Security vulnerability fix !asap +security +critical @me" -t Bug
```
