// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { NotionUrlToId, MakeRequest } from './utils';

let sessionInProgress = false;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	let config: vscode.WorkspaceConfiguration;
	let notionSecret: string = '';
	let trackingDatabaseURL: string = '';
	let autoStartOnVSCode: boolean = false;
	let trackingDatabaseID: string = '';

	let startDate: Date| null = null;
	let endDate: Date | null = null;
	let title: string = '';
	let sessionPageID: string | false = '';

	function UpdateConfiguration() {
		config = vscode.workspace.getConfiguration('codetrack');
		notionSecret = config.get('notionSecret', '').trim();
		trackingDatabaseURL = config.get('trackingDatabaseURL', '').trim();
		autoStartOnVSCode = config.get('autoStartOnVSCode', false);

		// Validate Notion Database URL and convert it to ID
		trackingDatabaseID = NotionUrlToId(trackingDatabaseURL);
		if (!trackingDatabaseID) {
			console.log('[CodeTrack] Notion tracking database:', trackingDatabaseURL);
			vscode.window.showErrorMessage('Invalid Notion tracking database URL provided.');
			return;
		}

	}

	async function CreateNotionPage(title: string, databaseID: string): Promise<string | false> {
			// Make the POST request to create a new page in the Notion database
			const response = await MakeRequest({
				method: "POST",
				url: "https://api.notion.com/v1/pages",
				message: "New Session Page",
				data: {
					parent: { database_id: databaseID },
					properties: {
						Name: {title: [{text: { content: title }}]}
					}
				},
				headers: {
					"Authorization": `Bearer ${notionSecret}`,
					"Notion-Version": "2022-06-28",
					"Content-Type": "application/json"
				}
			});

		// Check if response is a valid object and has an id property
		if (response && typeof response === 'object' && 'id' in response) {
			return (response as { id: string }).id;
		}
		console.error("Failed to create Notion page:", response);
		return false;
	}

	async function UpdateNotionProperties(sessionPageID: string): Promise<boolean> {
		// Create the properties object with date fields
		let propertiesObj: any = {
			Name: {
				title: [{text: { content: title }}]
			},
			Time: {
				date: {},
			},
			Status: {
				select: {
					name: !sessionInProgress ? "Started" : "Ended"
				}
			}
		};

		// Add start and end dates if they exist
		if (startDate && endDate) {
			// Both dates exist
			propertiesObj.Time.date.start = startDate.toISOString();
			propertiesObj.Time.date.end = endDate.toISOString();
		} else if (startDate) {
			// Only start date exists
			propertiesObj.Time.date.start = startDate.toISOString();
		} else if (endDate) {
			// Only end date exists (invalid case)
			console.log(`End Date = ${endDate}\nStart Date = ${startDate}`);
			vscode.window.showErrorMessage('End date cannot be set without a start date.');
			return false;
		} else {
			// Neither date exists
			vscode.window.showErrorMessage('Both start and end dates are required to update the session page.');
			return false;
		}
		console.log(`[CodeTrack] End Date = ${endDate}\nStart Date = ${startDate}`);


		// Make the PATCH request to update the Notion page properties
		const response = await MakeRequest({
			method: "PATCH",
			url: `https://api.notion.com/v1/pages/${sessionPageID}`,
			message: "Update Session Page properties",
			data: {
				properties: propertiesObj
			},
			headers: {
				"Authorization": `Bearer ${notionSecret}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json"
			}
		});

		return response !== false;
	}

	// Initialize configuration
	UpdateConfiguration();

	// Auto-start if enabled
	if (autoStartOnVSCode) {
		vscode.commands.executeCommand('codetrack.startSession');
	}

	// Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codetrack')) {
                // Reload configuration
                UpdateConfiguration();
            }
        })
    );

	let startSession = vscode.commands.registerCommand('codetrack.startSession', async (customTitle: string) => {
		// Check if the Notion secret and tracking database are set
		if (!notionSecret || !trackingDatabaseID) {
			vscode.window.showErrorMessage('Please set your Notion secret and tracking database in the settings.');
			return;
		}

		// Check if a session is already in progress
		if (sessionInProgress) {
			vscode.window.showWarningMessage('A coding session is already in progress.');
			return;
		}

		// Use withProgress API to show loading state
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Starting coding session...",
			cancellable: false
		}, async (progress) => {
			// Create a new Notion page for the session
			title = customTitle ;
			startDate = new Date();
			endDate = null;
			sessionPageID = await CreateNotionPage(title, trackingDatabaseID)
			if (!sessionPageID) {
				vscode.window.showErrorMessage('Failed to create a new session in Notion.');
				return;
			}

			// Update the session page with the start date
			const updateSuccess = await UpdateNotionProperties(sessionPageID);
			if (!updateSuccess) {
				vscode.window.showErrorMessage('Failed to update the session page in Notion.');
				return;
			}

			// Update sidebar placeholder with current title
			if (sidebarProvider) {
				sidebarProvider.updatePlaceholder(title);
			}

			// Notify the user that the session has started
			console.log(`[CodeTrack] Session started: ${title}`);
			sessionInProgress = true;
			vscode.window.showInformationMessage(
				'Started tracking your coding session', 
				'View session in Notion'
			).then(selection => {
				if (selection === 'View session in Notion' && typeof sessionPageID === 'string') {
					const pageUrl = `https://notion.so/${sessionPageID.replace(/-/g, '')}`;
					vscode.env.openExternal(vscode.Uri.parse(pageUrl));
				}
			});
		});
	});

	let endSession = vscode.commands.registerCommand('codetrack.endSession', async (customTitle: string) => {
		// Check if the Notion secret and tracking database are set
		if (!notionSecret || !trackingDatabaseID) {
			vscode.window.showErrorMessage('Please set your Notion secret and tracking database in the settings.');
			return;
		}

		if (!sessionInProgress) {
			vscode.window.showWarningMessage('No coding session is currently in progress.');
			return;
		}

		// Use withProgress API to show loading state
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Ending coding session...",
			cancellable: false
		}, async (progress) => {
			// Update the session page with the end date
			endDate = new Date();

			if (!sessionPageID) {
				vscode.window.showErrorMessage('Session page ID is not set. Please start a session first.');
				return;
			}
			title = customTitle;
			const updateSuccess = await UpdateNotionProperties(sessionPageID);
			if (!updateSuccess) {
				vscode.window.showErrorMessage('Failed to update the session page in Notion.');
				return;
			}

			sessionInProgress = false;
			vscode.window.showInformationMessage(
				'Ended tracking your coding session', 
				'View session in Notion'
			).then(selection => {
				if (selection === 'View session in Notion' && typeof sessionPageID === 'string') {
					const pageUrl = `https://notion.so/${sessionPageID.replace(/-/g, '')}`;
					vscode.env.openExternal(vscode.Uri.parse(pageUrl));
				}
			});
		});
	});

	context.subscriptions.push(startSession);
	context.subscriptions.push(endSession);

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"codetrack-view",
			sidebarProvider
		)
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
