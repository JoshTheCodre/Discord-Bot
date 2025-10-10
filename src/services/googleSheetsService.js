const { google } = require('googleapis');
const path = require('path');
const { readData } = require('./storage');

// Google Sheets configuration
const CREDENTIALS_PATH = path.join(__dirname, '../../config/google-credentials.json');
const SPREADSHEET_ID = '1S9XfOmIS4latiGRmYHOJGx_XSs9bSc8b_BHNNhPlEMA';

// Sheet names and their GIDs
const SHEETS = {
    USERS: {
        name: 'users',
        gid: '0'
    },
    CHANNELS: {
        name: 'channels', 
        gid: '1656319622'
    }
};

// Initialize Google Sheets API
let sheets = null;

const initializeGoogleSheets = async () => {
    try {
        // Read credentials file
        const fs = require('fs');
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const authClient = await auth.getClient();
        sheets = google.sheets({ version: 'v4', auth: authClient });
        
        console.log('✅ Google Sheets API initialized');
        return true;
    } catch (error) {
        console.error('❌ Error initializing Google Sheets:', error);
        return false;
    }
};


const syncUsersToSheet = async () => {
    try {
        if (!sheets) {
            const initialized = await initializeGoogleSheets();
            if (!initialized) return { success: false, error: 'Failed to initialize Google Sheets' };
        }

        const data = readData();
        const tasks = data.tasks || [];
        const users = data.users || [];
        const today = new Date().toISOString().split('T')[0];

        console.log('📊 Syncing user data to Google Sheets (column format)...');

        // Get user names and sort them
        const userNames = users.map(user => user.name).sort();
        
        if (userNames.length === 0) {
            // No users, create empty table
            const headers = ['No users found'];
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.USERS.name}!A:Z`
            });
            
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.USERS.name}!A1`,
                valueInputOption: 'RAW',
                resource: { values: [headers] }
            });
            
            return {
                success: true,
                usersCount: 0,
                totalSubtasks: 0,
                completedSubtasks: 0
            };
        }

        // Build user data structure with task titles
        const userData = {};
        let maxTaskCount = 0;
        let totalSubtasks = 0;
        let totalCompleted = 0;

        users.forEach(user => {
            const userId = user.id;
            const userName = user.name;
            
            userData[userName] = {
                titles: [],
                completed: 0,
                active: 0,
                overdue: 0,
                total: 0
            };
            
            // Get all subtasks for this user
            tasks.forEach(task => {
                if (task.assignedTo === userId) {
                    const dueDate = new Date(task.dueDate);
                    const isOverdue = dueDate < new Date(today);

                    task.subTasks?.forEach(subtask => {
                        userData[userName].titles.push(subtask.title);
                        userData[userName].total++;
                        
                        if (subtask.status === 'completed') {
                            userData[userName].completed++;
                        } else {
                            userData[userName].active++;
                            if (isOverdue) {
                                userData[userName].overdue++;
                            }
                        }
                    });
                }
            });
            
            // Track the maximum number of tasks for any user
            maxTaskCount = Math.max(maxTaskCount, userData[userName].titles.length);
            totalSubtasks += userData[userName].total;
            totalCompleted += userData[userName].completed;
        });

        // Create table structure: users as columns, tasks as rows
        const tableData = [];
        
        // Header row: user names (with formatting)
        const headerRow = userNames.map(name => `👤 ${name}`);
        tableData.push(headerRow);
        
        console.log('📊 Users table data structure:', {
            headerRow,
            userCount: userNames.length,
            maxTasks: maxTaskCount
        });
        
        // Task rows: fill each column with task titles
        for (let row = 0; row < maxTaskCount; row++) {
            const taskRow = userNames.map(userName => {
                const user = userData[userName];
                return row < user.titles.length ? user.titles[row] : '';
            });
            tableData.push(taskRow);
        }
        
        // Summary rows
        const totalRow = userNames.map(userName => {
            const user = userData[userName];
            return `Total: ${user.total} - Approved: ${user.completed}`;
        });
        tableData.push(totalRow);
        
        const activeRow = userNames.map(userName => {
            const user = userData[userName];
            return `Active: ${user.active} - Past Deadline: ${user.overdue}`;
        });
        tableData.push(activeRow);

        // Clear existing data completely first
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.USERS.name}!A:Z`
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.USERS.name}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: tableData
            }
        });

        // Format the table
        await formatUsersColumnSheet(userNames.length, tableData.length);

        console.log(`✅ Synced ${userNames.length} users in column format to Google Sheets`);
        return {
            success: true,
            usersCount: userNames.length,
            totalSubtasks: totalSubtasks,
            completedSubtasks: totalCompleted
        };

    } catch (error) {
        console.error('❌ Error syncing users to sheet:', error);
        return { success: false, error: error.message };
    }
};


const syncChannelsToSheet = async () => {
    try {
        if (!sheets) {
            const initialized = await initializeGoogleSheets();
            if (!initialized) return { success: false, error: 'Failed to initialize Google Sheets' };
        }

        const data = readData();
        const tasks = data.tasks || [];
        const channels = data.channels || {};

        console.log('📺 Syncing channel data to Google Sheets (table format)...');

        // Get channel names and sort them
        const channelNames = Object.keys(channels).sort();
        
        if (channelNames.length === 0) {
            // No channels, create empty table
            const headers = ['No channels found'];
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.CHANNELS.name}!A:Z`
            });
            
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.CHANNELS.name}!A1`,
                valueInputOption: 'RAW',
                resource: { values: [headers] }
            });
            
            return {
                success: true,
                channelsCount: 0,
                totalForwarded: 0,
                breakdown: []
            };
        }

        // Build channel data structure with task titles
        const channelData = {};
        let maxTaskCount = 0;

        channelNames.forEach(channelName => {
            channelData[channelName] = {
                titles: [],
                total: 0
            };
            
            const forwardedItems = channels[channelName] || [];
            
            forwardedItems.forEach(item => {
                const taskId = item.taskId; // e.g., "TMK1"
                let subtaskTitle = taskId; // fallback to raw compound ID
                
                // Parse compound ID (e.g., "TMK1" -> taskGroup: "TMK", subtaskId: 1)
                const match = taskId.match(/^([A-Za-z]+)(\d+)$/);
                if (match) {
                    const taskGroup = match[1];
                    const subtaskId = parseInt(match[2]);
                    
                    // Find the matching task and subtask
                    const task = tasks.find(t => t.taskId === taskGroup);
                    if (task) {
                        const subtask = task.subTasks?.find(st => st.subTaskID === subtaskId);
                        if (subtask) {
                            subtaskTitle = subtask.title;
                        }
                    }
                }
                
                channelData[channelName].titles.push(subtaskTitle);
                channelData[channelName].total++;
            });
            
            // Track the maximum number of tasks for any channel
            maxTaskCount = Math.max(maxTaskCount, channelData[channelName].titles.length);
        });

        // Create table structure: channels as columns, tasks as rows
        const tableData = [];
        
        // Header row: channel names
        const headerRow = channelNames.map(name => `#${name}`);
        tableData.push(headerRow);
        
        console.log('📺 Channels table data structure:', {
            headerRow,
            channelCount: channelNames.length,
            maxTasks: maxTaskCount
        });
        
        // Task rows: fill each column with task titles
        for (let row = 0; row < maxTaskCount; row++) {
            const taskRow = channelNames.map(channelName => {
                const channel = channelData[channelName];
                return row < channel.titles.length ? channel.titles[row] : '';
            });
            tableData.push(taskRow);
        }
        
        // Total row: show totals for each channel
        const totalRow = channelNames.map(channelName => {
            const total = channelData[channelName].total;
            return `Total: ${total}`;
        });
        tableData.push(totalRow);

        // Clear existing data completely first
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.CHANNELS.name}!A:Z`
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.CHANNELS.name}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: tableData
            }
        });

        // Format the table
        await formatChannelsTableSheet(channelNames.length, tableData.length);

        const totalForwarded = Object.values(channelData).reduce((sum, channel) => sum + channel.total, 0);
        
        console.log(`✅ Synced ${channelNames.length} channels in table format to Google Sheets`);
        return {
            success: true,
            channelsCount: channelNames.length,
            totalForwarded: totalForwarded,
            breakdown: Object.entries(channelData).map(([name, data]) => ({
                name: `#${name}`,
                totalForwarded: data.total
            }))
        };

    } catch (error) {
        console.error('❌ Error syncing channels to sheet:', error);
        return { success: false, error: error.message };
    }
};


const formatUsersColumnSheet = async (columnCount, rowCount) => {
    try {
        const requests = [];
        
        // Format header row (user names)
        requests.push({
            repeatCell: {
                range: {
                    sheetId: parseInt(SHEETS.USERS.gid),
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: columnCount
                },
                cell: {
                    userEnteredFormat: {
                        backgroundColor: { red: 0.2, green: 0.6, blue: 1.0 },
                        textFormat: {
                            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                            bold: true
                        },
                        horizontalAlignment: 'CENTER'
                    }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
        });
        
        // Format summary rows (last 2 rows)
        requests.push({
            repeatCell: {
                range: {
                    sheetId: parseInt(SHEETS.USERS.gid),
                    startRowIndex: rowCount - 2,
                    endRowIndex: rowCount,
                    startColumnIndex: 0,
                    endColumnIndex: columnCount
                },
                cell: {
                    userEnteredFormat: {
                        backgroundColor: { red: 1.0, green: 0.9, blue: 0.6 },
                        textFormat: {
                            bold: true
                        },
                        horizontalAlignment: 'CENTER'
                    }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
        });
        
        // Auto-resize columns
        requests.push({
            autoResizeDimensions: {
                dimensions: {
                    sheetId: parseInt(SHEETS.USERS.gid),
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: columnCount
                }
            }
        });
        
        // Set column widths to be wider for better readability
        for (let i = 0; i < columnCount; i++) {
            requests.push({
                updateDimensionProperties: {
                    range: {
                        sheetId: parseInt(SHEETS.USERS.gid),
                        dimension: 'COLUMNS',
                        startIndex: i,
                        endIndex: i + 1
                    },
                    properties: {
                        pixelSize: 200
                    },
                    fields: 'pixelSize'
                }
            });
        }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests }
        });
        
    } catch (error) {
        console.error('❌ Error formatting users column sheet:', error);
    }
};


const formatChannelsTableSheet = async (columnCount, rowCount) => {
    try {
        const requests = [];
        
        // Format header row (channel names)
        requests.push({
            repeatCell: {
                range: {
                    sheetId: parseInt(SHEETS.CHANNELS.gid),
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: columnCount
                },
                cell: {
                    userEnteredFormat: {
                        backgroundColor: { red: 0.6, green: 0.2, blue: 1.0 },
                        textFormat: {
                            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                            bold: true
                        },
                        horizontalAlignment: 'CENTER'
                    }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
        });
        
        // Format total row (last row)
        requests.push({
            repeatCell: {
                range: {
                    sheetId: parseInt(SHEETS.CHANNELS.gid),
                    startRowIndex: rowCount - 1,
                    endRowIndex: rowCount,
                    startColumnIndex: 0,
                    endColumnIndex: columnCount
                },
                cell: {
                    userEnteredFormat: {
                        backgroundColor: { red: 1.0, green: 0.9, blue: 0.6 },
                        textFormat: {
                            bold: true
                        },
                        horizontalAlignment: 'CENTER'
                    }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
        });
        
        // Auto-resize columns
        requests.push({
            autoResizeDimensions: {
                dimensions: {
                    sheetId: parseInt(SHEETS.CHANNELS.gid),
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: columnCount
                }
            }
        });
        
        // Set column widths to be wider for better readability
        for (let i = 0; i < columnCount; i++) {
            requests.push({
                updateDimensionProperties: {
                    range: {
                        sheetId: parseInt(SHEETS.CHANNELS.gid),
                        dimension: 'COLUMNS',
                        startIndex: i,
                        endIndex: i + 1
                    },
                    properties: {
                        pixelSize: 200
                    },
                    fields: 'pixelSize'
                }
            });
        }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests }
        });
        
    } catch (error) {
        console.error('❌ Error formatting channels table sheet:', error);
    }
};


const clearAllSheets = async () => {
    try {
        if (!sheets) {
            const initialized = await initializeGoogleSheets();
            if (!initialized) return { success: false, error: 'Failed to initialize Google Sheets' };
        }

        console.log('🧹 Clearing all sheet data...');

        // Clear users sheet completely
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.USERS.name}!A:Z`
        });

        // Clear channels sheet completely  
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.CHANNELS.name}!A:Z`
        });

        console.log('✅ All sheets cleared successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ Error clearing sheets:', error);
        return { success: false, error: error.message };
    }
};


const syncAllDataToSheets = async () => {
    try {
        console.log('🔄 Starting full Google Sheets sync...');
        
        // Clear all sheets first to ensure clean sync
        const clearResult = await clearAllSheets();
        if (!clearResult.success) {
            return { success: false, error: `Failed to clear sheets: ${clearResult.error}` };
        }
        
        const usersResult = await syncUsersToSheet();
        const channelsResult = await syncChannelsToSheet();

        const results = {
            success: usersResult.success && channelsResult.success,
            users: usersResult,
            channels: channelsResult,
            timestamp: new Date().toISOString()
        };

        if (results.success) {
            console.log('✅ Google Sheets sync completed successfully');
        } else {
            console.log('⚠️ Google Sheets sync completed with errors');
        }

        return results;

    } catch (error) {
        console.error('❌ Error in full sync:', error);
        return { success: false, error: error.message };
    }
};


module.exports = {
    initializeGoogleSheets,
    clearAllSheets,
    syncUsersToSheet,
    syncChannelsToSheet,
    syncAllDataToSheets,
    SPREADSHEET_ID,
    SHEETS
};
