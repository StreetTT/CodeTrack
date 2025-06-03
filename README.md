# CodeTrack

Track your coding sessions seamlessly with Notion integration in VS Code.

## Features

CodeTrack helps you maintain a detailed log of your coding sessions by automatically recording:

- Session start and end times
- Custom session titles
- Session status tracking
- Direct integration with Notion

![CodeTrack Sidebar](resources/sidebar.png)

> The extension provides a convenient sidebar interface for managing your coding sessions.

## Requirements

- Visual Studio Code ^1.100.0
- Notion account with integration token
- Notion database with required properties:
  - Name (title)
  - Time (date)
  - Status (select)

## Setup

1. Install the extension
2. Get your Notion integration token from [Notion Integrations](https://www.notion.so/my-integrations)
3. Create a tracking database in Notion
4. Share your database with the integration
5. Configure the extension settings

## Extension Settings

This extension contributes the following settings:

* `codetrack.notionSecret`: Your Notion integration secret token
* `codetrack.trackingDatabaseURL`: URL of your Notion tracking database
* `codetrack.autoStartOnVSCode`: Enable/disable auto-start of a session when VS Code launches

## Usage

### Sidebar Interface

1. Click the CodeTrack icon in the activity bar
2. Enter an optional session title
3. Use "Start Session" and "End Session" buttons to control tracking

### Commands

Available commands:
- `CodeTrack: Start Session`
- `CodeTrack: End Session`

## Future Updates

- Linking to Projects
- Variably effect other database columns
- Sessions end when VSCode is closed
- Sensing the start and end of a Session
- Multi Session Support
- Editing Page Info from VSCode

## Release Notes

### 0.0.1

Initial release with:
- Basic session tracking
- Notion integration
- Sidebar interface
- Auto-start functionality

## Following Extension Guidelines

This extension follows the [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines) for VS Code.

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch for changes
npm run watch

# Run tests
npm run test
```

For debugging, open Developer Tools in VS Code (Help > Toggle Developer Tools).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is released under the MIT License.

---

**Enjoy tracking your coding sessions!**