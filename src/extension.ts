// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { PanelProvider } from './PanelProvider';
import { NotionUrlToId, MakeRequest, QueryNotion, log, logError } from './utils';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	let config: vscode.WorkspaceConfiguration;
	let notionSecret: string = '';
	let trackingDatabaseURL: string = '';
	let autoStartOnVSCode: boolean = false;
	let trackingDatabaseID: string = '';
	let sessionInProgress = false;
	let startDate: Date| null = null;
	let endDate: Date | null = null;
	let title: string = '';
	let sessionPageID: string | false = '';
	let trackingDatabaseProperties: { [key: string]: any } | null = null;
	let trackingDatabasePropertiesMapping: { [key: string]: string } | null = null;
	let timePropertyName: string | null = context.globalState.get('timePropertyName') || null;
	let projectPropertyName: string | null = context.globalState.get('projectPropertyName') || null;
	let projects: { [key: string]: string } | null = null;
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	PanelProvider.render(context.extensionUri, projectPropertyName, timePropertyName);

	function findTitleKey(properties: { [key: string]: string }): string {
		for (const [key, value] of Object.entries(properties)) {
			if (value === "title") {
			return key;
			}
		}
		return "Name";
	}

	function FilterDatabaseProperties(properties: { [key: string]: any }): { [key: string]: string } {
		const excludedTypes = [
			'formula',
			'button',
			'last_edited_time',
			'last_edited_by',
			'rollup',
			'created_time',
			'created_by'
		];

		const mappings: { [key: string]: string } = {};

		Object.entries(properties).forEach(([key, value]: [string, any]) => {
			if (!excludedTypes.includes(value.type) && value.id) {
				mappings[key] = value.type;
			}
		});

		return mappings;
	}

	function FilterProjects(projects: any[]): { [key: string]: string } {
		const projectMap: { [key: string]: string } = {};
		projects.forEach(project => {
			const title = project.properties.Name.title[0]?.text?.content || 'Unnamed Project';
			projectMap[title] = project.id;
		});
		return projectMap;
	}

	async function UpdateConfigurationAndSettings() {
		config = vscode.workspace.getConfiguration('codetrack');
		notionSecret = config.get('notionSecret', '').trim();
		trackingDatabaseURL = config.get('trackingDatabaseURL', '').trim();
		autoStartOnVSCode = config.get('autoStartOnVSCode', false);

		// Validate Notion Database URL and Get all relevant information
		trackingDatabaseID = NotionUrlToId(trackingDatabaseURL);
		if (trackingDatabaseID) {
			trackingDatabaseProperties = await GetDatabaseProperties(trackingDatabaseID);
			if (trackingDatabaseProperties) {
				trackingDatabasePropertiesMapping = FilterDatabaseProperties(trackingDatabaseProperties);
				PanelProvider.UpdatePropertySettings(trackingDatabasePropertiesMapping);
				if (projectPropertyName) {
					projects = FilterProjects(await QueryNotion(
						`https://api.notion.com/v1/databases/${trackingDatabaseProperties[projectPropertyName].relation.database_id}/query`,
						'Get Projects',
						false,
						{},
						{
							"Authorization": `Bearer ${notionSecret}`,
							"Notion-Version": "2022-06-28",
							"Content-Type": "application/json"
						}
					));
					sidebarProvider.UpdateProjects(projects);
				} else {
					sidebarProvider.UpdateProjects({});
					vscode.window.showErrorMessage('Project property is not set or invalid. Please configure it in the settings.');
				}
			} else { vscode.window.showErrorMessage('Failed to retrieve Notion database properties. Please check your Notion secret and database ID.');}
		} else { vscode.window.showErrorMessage('Invalid Notion tracking database URL provided.');}

		log('Config:\n '+
			'Notion Secret: '+ notionSecret+ '\n '+
			'Tracking Database ID: '+ trackingDatabaseID + '\n '+
			'Auto Start on VSCode: ' + autoStartOnVSCode
		);
		log('Settings:\n '+
			'Project Property: ' + projectPropertyName + '\n '+
			'Time Property: ' + timePropertyName
		);
	}

	async function DeleteNotionPage(pageID: string): Promise<boolean> {
			// Make the DELETE request to remove a page from the Notion database
			const response = await MakeRequest({
				method: "PATCH",
				url: `https://api.notion.com/v1/pages/${pageID}`,
				message: "Delete Page",
				data: {
					in_trash: true
				},
				headers: {
					"Authorization": `Bearer ${notionSecret}`,
					"Notion-Version": "2022-06-28",
					"Content-Type": "application/json"
				}
			});

		return response !== false;
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
		logError("Failed to create Notion page: "+ response);
		return false;
	}

	async function GetDatabaseProperties(databaseId: string): Promise<object | null> {
		const response = await MakeRequest({
			method: 'GET',
			url: `https://api.notion.com/v1/databases/${databaseId}`,
			headers: {
				"Authorization": `Bearer ${notionSecret}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json"
			},
			message: 'Getting database properties'
		});

		if (response && typeof response === 'object') {
			const database = response as any;
			return database.properties;
		}
		logError("Failed to get Notion database properties: " + response);
		return null;
	}

	async function UpdateNotionProperties(sessionPageID: string, projectName: string | null, projectMatters: boolean = true): Promise<boolean> {
		// Create the properties object with date fields
		// Use the existing timePropertyName variable from the outer scope,
		// or default to 'Time' if not set

		if (!timePropertyName || timePropertyName.trim() === '') {
			vscode.window.showErrorMessage('Time property name is not set. Please configure it in the settings.');
			PanelProvider.render(context.extensionUri);
			return false;
		}

		if (!projectPropertyName) {
			vscode.window.showErrorMessage('Project property name is not set. Please configure it in the settings.');
			PanelProvider.render(context.extensionUri);
			return false;
		}

		let propertiesObj: any = {
			[findTitleKey(trackingDatabaseProperties ? trackingDatabaseProperties : {})]: {
				title: [{text: { content: title }}]
			},
			[timePropertyName]: {  
				date: {},
			}
		};

		if (projectMatters && projects) {
			propertiesObj[projectPropertyName] = {
				relation: projectName ? [{
					id: projects[projectName]
				}] : []
			};
		}

		// Add start and end dates if they exist
		if (startDate && endDate) {
			// Both dates exist
			propertiesObj[timePropertyName].date.start = startDate.toISOString();
			propertiesObj[timePropertyName].date.end = endDate.toISOString();
		} else if (startDate) {
			// Only start date exists
			propertiesObj[timePropertyName].date.start = startDate.toISOString();
		} else if (endDate) {
			// Only end date exists (invalid case)
			vscode.window.showErrorMessage('End date cannot be set without a start date.');
			return false;
		} else {
			// Neither date exists
			vscode.window.showErrorMessage('Both start and end dates are required to update the session page.');
			return false;
		}
		log('Session Dates:\n '+
			'Start Date: ' + startDate + '\n '+
			'End Date: ' + endDate
		);


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
	UpdateConfigurationAndSettings();

	// Auto-start if enabled
	if (autoStartOnVSCode) {
		vscode.commands.executeCommand('codetrack.startSession', 'Auto-Started Session');
	}

	// Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codetrack')) {
                // Reload configuration
                UpdateConfigurationAndSettings();
            }
        })
    );

	let startSession = vscode.commands.registerCommand('codetrack.startSession', async (customTitle: string, projectName: string) => {
		// Check if the Notion secret and tracking database are set
		if (!(notionSecret && trackingDatabaseID)) {
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
			const updateSuccess = await UpdateNotionProperties(sessionPageID, projectName);
			if (!updateSuccess) {
				await DeleteNotionPage(sessionPageID);
				return;
			}

			// Update sidebar placeholder with current title
			if (sidebarProvider) {
				sidebarProvider.UpdatePlaceholder(title);
			}

			// Notify the user that the session has started
			log(`Session started: ${title}`);
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
			const updateSuccess = await UpdateNotionProperties(sessionPageID, null, false);
			if (!updateSuccess) {
				vscode.window.showErrorMessage('Failed to update the session page in Notion.');
				return;
			}

			log(`Session ended: ${title}`);
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

	let openPanel = vscode.commands.registerCommand('codetrack.openPanel', () => {
		PanelProvider.render(context.extensionUri);
	});

	let saveSettings = vscode.commands.registerCommand('codetrack.saveSettings', async (projectProperty: string, timeProperty: string) => {
		log('Settings:\n '+
			'Project Property: ' + projectProperty + '\n '+
			'Time Property: ' + timeProperty);

		// Validate the properties
		if (!projectProperty || !timeProperty) {
			vscode.window.showErrorMessage('Please provide valid project and time properties.');
			return;
		}
		
		// Use withProgress API to show loading state
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Ending coding session...",
			cancellable: false
		}, async (progress) => {
			// Save to extension's global state
			await context.globalState.update('timePropertyName', timeProperty);
			await context.globalState.update('projectPropertyName', projectProperty);
			
			// Update the variables
			timePropertyName = timeProperty;
			projectPropertyName = projectProperty;
			
			// Update the sidebar provider with the new settings
			UpdateConfigurationAndSettings();

			// Notify the user that settings have been saved
			vscode.window.showInformationMessage('Settings saved successfully.');
		});
	});

	let clearSettings = vscode.commands.registerCommand('codetrack.clearSettings', async () => {
		await context.globalState.update('timePropertyName', null);
		await context.globalState.update('projectPropertyName', null);
		timePropertyName = null;
		projectPropertyName = null;
		
		vscode.window.showInformationMessage('CodeTrack settings have been cleared.');
	});

	context.subscriptions.push(startSession);
	context.subscriptions.push(endSession);
	context.subscriptions.push(openPanel);
	context.subscriptions.push(saveSettings);
	context.subscriptions.push(clearSettings);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"codetrack-view",
			sidebarProvider
		)
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
