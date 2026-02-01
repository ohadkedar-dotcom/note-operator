# Daily Notes Brief Generator

A macOS background service that extracts Apple Notes modified in the last 24 hours, uses an LLM to generate a daily brief with executive summary and prioritized action items, and saves the output as a Markdown file (and optionally as a new Apple Note).

## Features

- **Automated Daily Processing**: Runs automatically at 6:00 PM daily
- **Apple Notes Integration**: Extracts notes using AppleScript
- **LLM-Powered Analysis**: Uses Anthropic Claude 3.5 Sonnet to generate summaries
- **Smart Filtering**: Only processes notes modified in the last 24 hours
- **Prioritized Action Items**: Extracts and prioritizes tasks (High/Medium/Low)
- **Multiple Output Formats**: Saves to Markdown file and optionally creates Apple Note

## Prerequisites

- macOS (for Apple Notes and AppleScript)
- Node.js 18+ 
- Anthropic API key

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:
   ```bash
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

4. Configure `config.json`:
   ```json
   {
     "llmProvider": "anthropic",
     "outputDirectory": "~/Documents/DailyBriefs",
     "createAppleNote": false,
     "timezone": "America/New_York",
     "slackWebhookUrl": null
   }
   ```

## Configuration

### config.json

- `llmProvider`: Must be `"anthropic"` (Claude 3.5 Sonnet)
- `outputDirectory`: Where to save the daily brief Markdown files (supports `~` for home directory)
- `createAppleNote`: Set to `true` to also create a new Apple Note with the brief
- `timezone`: Timezone for the cron scheduler (default: `"America/New_York"`)
- `slackWebhookUrl`: Optional - Slack webhook URL to post daily briefs to a channel (set to `null` to disable)

### Environment Variables

- `ANTHROPIC_API_KEY`: Required - Your Anthropic API key

## Slack Integration

The service can automatically post daily briefs to a Slack channel using Slack's Incoming Webhooks.

### Setting Up Slack Webhook

1. **Create a Slack App** (if you don't have one):
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Name your app (e.g., "Daily Brief Bot") and select your workspace
   - Click "Create App"

2. **Enable Incoming Webhooks**:
   - In your app settings, go to "Incoming Webhooks"
   - Toggle "Activate Incoming Webhooks" to ON
   - Click "Add New Webhook to Workspace"
   - Select the channel where you want daily briefs posted
   - Click "Allow"
   - Copy the webhook URL (it will look like: `https://hooks.slack.com/services/XXXXX/XXXXX/XXXXXXXXXXXX`)

3. **Configure the Service**:
   - Open `config.json`
   - Set `slackWebhookUrl` to your webhook URL:
     ```json
     {
       "slackWebhookUrl": "https://hooks.slack.com/services/XXXXX/XXXXX/XXXXXXXXXXXX"
     }
     ```
   - Save the file

4. **Test the Integration**:
   - Run `npm start -- --now` to test immediately
   - Check your Slack channel for the daily brief

### Security Note

- Webhook URLs are channel-specific and should be kept private
- Anyone with the webhook URL can post messages to the channel
- If your webhook URL is compromised, you can revoke it in Slack and create a new one
- Consider not committing `config.json` with your webhook URL to version control

## Usage

### Build the Project

```bash
npm run build
```

### Run the Service

Start the service (runs in background, executes daily at 6 PM):

```bash
npm start
```

### Test Immediately

Run the daily brief generation immediately without waiting for the scheduled time:

```bash
npm run dev -- --now
# or
npm start -- --now
```

### Development Mode

Run with TypeScript directly (useful for development):

```bash
npm run dev
```

## How It Works

1. **Note Extraction**: Uses AppleScript to query Apple Notes and extract all notes with their names, bodies, and modification dates
2. **Filtering**: Compares modification dates against the last run timestamp (defaults to 24 hours ago on first run)
3. **Content Aggregation**: Combines all filtered notes into a single text dump
4. **LLM Processing**: Sends the aggregated content to the configured LLM with a prompt to generate:
   - Executive Summary (3-5 sentences)
   - Action Items with priorities (High/Medium/Low)
5. **Output Generation**: 
   - Saves a Markdown file: `Daily_Summary_YYYY-MM-DD.md`
   - Optionally posts to Slack channel (if configured)
   - Optionally creates a new Apple Note titled "Daily Brief: YYYY-MM-DD"

## Output Format

The generated Markdown file includes:

- **Executive Summary**: High-level overview of the day's themes
- **Action Items**: Organized by priority (High, Medium, Low)
- **Metadata**: Generation timestamp and date

## Storage

The service stores the last run timestamp in `~/.note-operator/last-run.json` to track when notes were last processed.

## Troubleshooting

### Apple Notes Access

The service requires permission to access Apple Notes. On first run, macOS may prompt for accessibility permissions. Grant access in System Settings > Privacy & Security > Accessibility.

### API Key Errors

Ensure your `.env` file contains the correct API key for your chosen provider and that the key is valid.

### No Notes Found

If no notes are found, check:
- That you have notes in Apple Notes
- That some notes were modified in the last 24 hours
- That the AppleScript execution is working (check console logs)

## Cloud Deployment (GitHub Actions)

The service can be configured to run in the cloud using GitHub Actions, ensuring daily briefs are sent even when your laptop is off.

### Architecture

1. **API Server** (runs on your Mac when it's on): Extracts notes and stores them in GitHub Gist
2. **GitHub Actions** (runs daily at 6 PM): Reads stored notes, processes with LLM, posts to Slack

### Setup Instructions

#### 1. Install Dependencies

```bash
npm install
```

This will install `express` and `@octokit/rest` for the API server and cloud storage.

#### 2. Create GitHub Account and Repository

1. Create a free GitHub account at https://github.com
2. Create a new repository for this project
3. Push your code to the repository

#### 3. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Note Operator")
4. Select scopes: `gist` (for Gist storage) or `repo` (for repository storage)
5. Generate and copy the token

#### 4. Create GitHub Gist (for storage)

1. Go to https://gist.github.com
2. Create a new private Gist (or use the API to create one automatically)
3. Copy the Gist ID from the URL (e.g., `abc123def456` from `https://gist.github.com/username/abc123def456`)

#### 5. Configure GitHub Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions, and add:

- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `SLACK_WEBHOOK_URL`: Your Slack webhook URL
- `GITHUB_TOKEN`: Your GitHub Personal Access Token
- `GIST_ID`: Your GitHub Gist ID (for storing notes)

#### 6. Configure Local API Server

Update `config.json`:

```json
{
  "llmProvider": "anthropic",
  "apiPort": 3000,
  "apiKey": "your-secret-api-key-here",
  "cloudStorageType": "gist",
  "githubToken": "your-github-token-here",
  "gistId": "your-gist-id-here"
}
```

Or set environment variables:
- `API_KEY`: Secret key for API authentication
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `GIST_ID`: GitHub Gist ID

#### 7. Start API Server

Run the API server on your Mac (when it's on):

```bash
npm run dev -- --api
# or
npm start -- --api
```

The server will run on port 3000 (or your configured port).

#### 8. Extract Notes to Cloud

When your laptop is on, call the API to extract and store notes:

```bash
curl -X POST http://localhost:3000/api/extract-notes \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-secret-api-key-here"}'
```

Or use a local cron job to call this automatically:

```bash
# Add to crontab (runs every hour when laptop is on)
0 * * * * curl -X POST http://localhost:3000/api/extract-notes -H "Content-Type: application/json" -d '{"apiKey":"your-api-key"}'
```

#### 9. Verify GitHub Actions Workflow

1. Push your code to GitHub (including `.github/workflows/daily-brief.yml`)
2. Go to your repository → Actions tab
3. The workflow should appear and run daily at 6 PM
4. You can manually trigger it using "Run workflow"

### Workflow

1. **When laptop is on**: API server extracts notes and stores them in GitHub Gist
2. **Daily at 6 PM**: GitHub Actions workflow:
   - Reads notes from Gist
   - Processes with LLM
   - Posts to Slack
   - Updates timestamp in Gist

### Testing

1. **Test API server locally**:
   ```bash
   npm run dev -- --api
   curl http://localhost:3000/api/health
   ```

2. **Test note extraction**:
   ```bash
   curl -X POST http://localhost:3000/api/extract-notes \
     -H "Content-Type: application/json" \
     -d '{"apiKey":"your-api-key"}'
   ```

3. **Test GitHub Actions workflow**: Use "Run workflow" button in GitHub Actions tab

### Troubleshooting

- **API server won't start**: Check that the port isn't already in use
- **GitHub Actions fails**: Check that all secrets are set correctly
- **No notes found**: Make sure you've called the API to extract notes first
- **Gist not found**: Verify GIST_ID secret is correct

## Security

- API keys are stored in `.env` (never commit this file)
- The `.env` file is gitignored
- All file operations use secure, parameterized methods
- API server requires authentication via API key
- GitHub tokens should be stored as GitHub Secrets (never in code)

## License

MIT
