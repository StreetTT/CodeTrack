try {
    const vscode = acquireVsCodeApi();
    const wv_log = (...args) => {
        vscode.postMessage({
            command: 'log',
            text: ["[Webview] ", ...args].join(' ')
        });
    };
    const wv_logError = (...args) => {
        vscode.postMessage({
            command: 'logError',
            text: ["[Webview] ", ...args].join(' ')
        });
    };

    let title;
    let properties;

    // Log when script loads
    wv_log('Script loaded');
    
    // Check if document is already complete and send ready message immediately
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        wv_log('Document already loaded, sending ready message immediately');
        vscode.postMessage({ command: 'webviewReady' });
    }

    function UpdateDropdown(elementId, propertyType, placeholder, selectedValue, noneIsSelectable = false) {
        wv_log('Updating ' + elementId + ' Dropdown' + (selectedValue ? ` with selection: ${selectedValue}` : ''));
        const select = document.getElementById(elementId);
        if (!select) {
            wv_logError('Element with ID ' + elementId + ' not found.');
            return;
        }

        select.innerHTML = '';

        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = placeholder;
        emptyOption.disabled = !noneIsSelectable;
        select.appendChild(emptyOption);

        let selectedOptionExists = false;

        // Add options from properties
        if (properties) {
            let matchingProperties = Object.entries(properties)
            if (propertyType !== null) {
                matchingProperties = matchingProperties.filter(([_, value]) => value === propertyType);
            }

            matchingProperties.forEach(([name, _]) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                
                // Check if this is the selected value
                if (selectedValue && name === selectedValue) {
                    option.selected = true;
                    selectedOptionExists = true;
                }
                
                select.appendChild(option);
            });

            // Default Selection logic (only if no selection was made)
            if (!selectedOptionExists) {
                if (matchingProperties.length === 0) {
                    emptyOption.selected = true;
                } else if (matchingProperties.length === 1) {
                    select.selectedIndex = 1;
                } else {
                    emptyOption.selected = true;
                }
            }
        }
    }

    window.addEventListener('message', event => {
        // wv_log('Received message.'); 
        const message = event.data;
        switch (message.command) {
            case 'updatePropertySettings':
                wv_log('Processing updatePropertySettings command');
                properties = message.properties;
                try {
                    UpdateDropdown(
                        'projectProperty', 
                        'relation', 
                        'Select a Project Property', 
                        message.selectedProjectProperty
                    );
                    UpdateDropdown(
                        'timeProperty', 
                        'date', 
                        'Select a Time Property', 
                        message.selectedTimeProperty
                    );
                    wv_log('Dropdowns updated successfully');
                } catch (error) {
                    wv_logError('Error updating property settings: ' + error);
                }
                break;
            case 'updateProjects':
                wv_log('Processing updateProjects command');
                properties = message.projects;
                try{
                    UpdateDropdown(
                        'project',
                        null,
                        'None',
                        message.workspaceName,
                        true
                    );
                    wv_log('Dropdown updated successfully');
                } catch (error) {
                    wv_logError('Error updating project settings: ' + error);
                }
        }
    });

    // Wait for DOM to be fully loaded before attaching click handlers
    document.addEventListener('DOMContentLoaded', () => {
        wv_log('DOM fully loaded');
        
        // Now attach event listeners to DOM elements
        const startButton = document.getElementById('startSessionBtn');
        if (startButton) {
            startButton.addEventListener('click', () => {
                wv_log('Start Session button pressed');
                title = document.getElementById('title').value;
                if (!title) {
                    title = "Coding Session - " + new Date().toLocaleString();
                }
                project = document.getElementById('project').value;
                document.getElementById('project').disabled = true;
                vscode.postMessage({ command: 'startSession', title: title, project: project });
                document.getElementById('title').placeholder = title;
            });
        }

        const endButton = document.getElementById('endSessionBtn');
        if (endButton) {
            endButton.addEventListener('click', () => {
                wv_log('End Session button pressed');
                title = document.getElementById('title').value;
                vscode.postMessage({ command: 'endSession', title: title });
                document.getElementById('title').value = '';
                document.getElementById('title').placeholder = '';
                document.getElementById('project').disabled = false;

            });
        }

        const saveButton = document.getElementById('saveSettingsBtn');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                wv_log('Save Settings button clicked');
                const projectProperty = document.getElementById('projectProperty').value;
                const timeProperty = document.getElementById('timeProperty').value;

                vscode.postMessage({
                    command: 'saveSettings',
                    projectProperty,
                    timeProperty
                });
            });
        }
        
        // Signal to extension that the webview is ready
        vscode.postMessage({ command: 'webviewReady' });
    });
} catch (error) {
    console.error('![CodeTrack] Error initializing script:', error);
    // Try to communicate the error even if vscode API failed
    try {
        acquireVsCodeApi().postMessage({
            command: 'logError',
            text: `![CodeTrack] Script initialization error: ${error}`
        });
    } catch (e) {
        // Nothing else we can do here
        console.error('![CodeTrack] Unable to report error to extension:', e);
    }
}