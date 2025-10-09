/**
 * Performance Service
 * Generates Excel reports for user performance tracking
 */

const ExcelJS = require('exceljs');
const { readData } = require('./storage');
const path = require('path');

/**
 * Generate Users — Titles & Totals Excel sheet
 */
const generateUsersTitlesSheet = async (today = '2025-10-09') => {
    try {
        const data = readData();
        const tasks = data.tasks || [];
        const users = data.users || [];
        
        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users — Titles & Totals');
        
        // Parse today's date for deadline comparison
        const todayDate = new Date(today);
        
        // Build user data structure
        const userData = {};
        
        // Initialize all users (even those with no tasks)
        users.forEach(user => {
            userData[user.id] = {
                name: user.name,
                subtasks: [],
                stats: {
                    total: 0,
                    approved: 0,
                    active: 0,
                    pastDeadline: 0
                }
            };
        });
        
        // Process all tasks and subtasks
        tasks.forEach(task => {
            const assignedUserId = task.assignedTo;
            const dueDate = new Date(task.dueDate);
            
            // Ensure user exists in userData
            if (!userData[assignedUserId]) {
                userData[assignedUserId] = {
                    name: `Unknown User (${assignedUserId})`,
                    subtasks: [],
                    stats: { total: 0, approved: 0, active: 0, pastDeadline: 0 }
                };
            }
            
            task.subTasks?.forEach(subtask => {
                const isCompleted = subtask.status === 'completed';
                const isPastDeadline = dueDate < todayDate && !isCompleted;
                
                // Add subtask to user's list
                userData[assignedUserId].subtasks.push({
                    taskId: task.taskId,
                    subTaskId: subtask.subTaskID,
                    title: subtask.title,
                    status: subtask.status,
                    dueDate: task.dueDate,
                    isCompleted,
                    isPastDeadline
                });
                
                // Update statistics
                userData[assignedUserId].stats.total++;
                if (isCompleted) {
                    userData[assignedUserId].stats.approved++;
                } else {
                    userData[assignedUserId].stats.active++;
                    if (isPastDeadline) {
                        userData[assignedUserId].stats.pastDeadline++;
                    }
                }
            });
        });
        
        // Sort subtasks by taskId, then subTaskId
        Object.values(userData).forEach(user => {
            user.subtasks.sort((a, b) => {
                if (a.taskId !== b.taskId) {
                    return a.taskId.localeCompare(b.taskId);
                }
                return a.subTaskId - b.subTaskId;
            });
        });
        
        // Get all users sorted by name
        const sortedUsers = Object.entries(userData).sort((a, b) => 
            a[1].name.localeCompare(b[1].name)
        );
        
        // Find the maximum number of rows needed (subtasks + 1 summary row)
        const maxRows = Math.max(...sortedUsers.map(([_, user]) => user.subtasks.length + 1), 1);
        
        // Create headers (user names)
        const headerRow = worksheet.getRow(1);
        sortedUsers.forEach(([userId, user], colIndex) => {
            const col = colIndex + 1;
            headerRow.getCell(col).value = user.name;
            headerRow.getCell(col).font = { bold: true };
            headerRow.getCell(col).alignment = { horizontal: 'center' };
        });
        
        // Fill in subtask titles and summary for each user
        sortedUsers.forEach(([userId, user], colIndex) => {
            const col = colIndex + 1;
            
            // Add subtask titles
            user.subtasks.forEach((subtask, rowIndex) => {
                const row = rowIndex + 2; // +2 because row 1 is header
                worksheet.getCell(row, col).value = subtask.title;
                worksheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
            });
            
            // Add summary row
            const summaryRow = user.subtasks.length + 2; // +2 because row 1 is header
            const summaryText = `Total: ${user.stats.total} | Approved: ${user.stats.approved} | Active: ${user.stats.active} | Past Deadline: ${user.stats.pastDeadline}`;
            worksheet.getCell(summaryRow, col).value = summaryText;
            worksheet.getCell(summaryRow, col).font = { bold: true };
            worksheet.getCell(summaryRow, col).alignment = { wrapText: true, vertical: 'top' };
            worksheet.getCell(summaryRow, col).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6F3FF' } // Light blue background
            };
        });
        
        // Set column widths
        sortedUsers.forEach((_, colIndex) => {
            const col = colIndex + 1;
            worksheet.getColumn(col).width = 50; // Width between 40-60 as requested
        });
        
        // Set row heights for better readability
        for (let row = 1; row <= maxRows + 1; row++) {
            worksheet.getRow(row).height = 30;
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Users_Titles_Totals_${timestamp}.xlsx`;
        const filepath = path.join(process.cwd(), 'reports', filename);
        
        // Create reports directory if it doesn't exist
        const fs = require('fs');
        const reportsDir = path.join(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        // Save the workbook
        await workbook.xlsx.writeFile(filepath);
        
        console.log(`✅ Excel report generated: ${filepath}`);
        
        return {
            success: true,
            filepath,
            filename,
            stats: {
                totalUsers: sortedUsers.length,
                usersWithTasks: sortedUsers.filter(([_, user]) => user.stats.total > 0).length,
                totalSubtasks: Object.values(userData).reduce((sum, user) => sum + user.stats.total, 0),
                totalApproved: Object.values(userData).reduce((sum, user) => sum + user.stats.approved, 0),
                totalActive: Object.values(userData).reduce((sum, user) => sum + user.stats.active, 0),
                totalPastDeadline: Object.values(userData).reduce((sum, user) => sum + user.stats.pastDeadline, 0)
            }
        };
        
    } catch (error) {
        console.error('❌ Error generating Excel report:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate performance summary for Discord embed
 */
const generatePerformanceSummary = (today = '2025-10-09') => {
    try {
        const data = readData();
        const tasks = data.tasks || [];
        const users = data.users || [];
        
        const todayDate = new Date(today);
        const userStats = {};
        
        // Initialize user stats
        users.forEach(user => {
            userStats[user.id] = {
                name: user.name,
                total: 0,
                approved: 0,
                active: 0,
                pastDeadline: 0,
                completionRate: 0,
                role: user.role || 'user'
            };
        });
        
        // Calculate stats
        tasks.forEach(task => {
            const assignedUserId = task.assignedTo;
            const dueDate = new Date(task.dueDate);
            
            if (userStats[assignedUserId]) {
                task.subTasks?.forEach(subtask => {
                    const isCompleted = subtask.status === 'completed';
                    const isPastDeadline = dueDate < todayDate && !isCompleted;
                    
                    userStats[assignedUserId].total++;
                    if (isCompleted) {
                        userStats[assignedUserId].approved++;
                    } else {
                        userStats[assignedUserId].active++;
                        if (isPastDeadline) {
                            userStats[assignedUserId].pastDeadline++;
                        }
                    }
                });
            }
        });
        
        // Calculate completion rates
        Object.values(userStats).forEach(user => {
            user.completionRate = user.total > 0 ? Math.round((user.approved / user.total) * 100) : 0;
        });
        
        return {
            success: true,
            userStats,
            summary: {
                totalUsers: users.length,
                totalSubtasks: Object.values(userStats).reduce((sum, user) => sum + user.total, 0),
                totalApproved: Object.values(userStats).reduce((sum, user) => sum + user.approved, 0),
                totalActive: Object.values(userStats).reduce((sum, user) => sum + user.active, 0),
                totalPastDeadline: Object.values(userStats).reduce((sum, user) => sum + user.pastDeadline, 0),
                averageCompletionRate: Math.round(
                    Object.values(userStats).reduce((sum, user) => sum + user.completionRate, 0) / users.length
                )
            }
        };
    } catch (error) {
        console.error('❌ Error generating performance summary:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Generate Channels — Titles & Total Excel sheet
 */
const generateChannelTitlesSheet = async () => {
    try {
        const data = readData();
        const tasks = data.tasks || [];
        const channels = data.channels || {};
        
        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Channels — Titles & Total');
        
        // Get all channel names
        const channelNames = Object.keys(channels).sort();
        
        if (channelNames.length === 0) {
            // No channels found, create empty sheet with message
            worksheet.getCell(1, 1).value = 'No channels found';
            const filepath = path.join(process.cwd(), 'reports', `Channels_Titles_Total_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`);
            
            const fs = require('fs');
            const reportsDir = path.join(process.cwd(), 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
            
            await workbook.xlsx.writeFile(filepath);
            return {
                success: true,
                filepath,
                stats: { totalChannels: 0, totalForwarded: 0 }
            };
        }
        
        // Build channel data structure
        const channelData = {};
        
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
        });
        
        // Find the maximum number of rows needed (titles + 1 summary row)
        const maxRows = Math.max(...channelNames.map(name => channelData[name].titles.length + 1), 1);
        
        // Create headers (channel names)
        const headerRow = worksheet.getRow(1);
        channelNames.forEach((channelName, colIndex) => {
            const col = colIndex + 1;
            headerRow.getCell(col).value = channelName;
            headerRow.getCell(col).font = { bold: true };
            headerRow.getCell(col).alignment = { horizontal: 'center' };
        });
        
        // Fill in titles and summary for each channel
        channelNames.forEach((channelName, colIndex) => {
            const col = colIndex + 1;
            const channel = channelData[channelName];
            
            // Add titles
            channel.titles.forEach((title, rowIndex) => {
                const row = rowIndex + 2; // +2 because row 1 is header
                worksheet.getCell(row, col).value = title;
                worksheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
            });
            
            // Add summary row
            const summaryRow = channel.titles.length + 2; // +2 because row 1 is header
            const summaryText = `Total: ${channel.total}`;
            worksheet.getCell(summaryRow, col).value = summaryText;
            worksheet.getCell(summaryRow, col).font = { bold: true };
            worksheet.getCell(summaryRow, col).alignment = { wrapText: true, vertical: 'top' };
            worksheet.getCell(summaryRow, col).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFEAA7' } // Light orange background
            };
        });
        
        // Set column widths
        channelNames.forEach((_, colIndex) => {
            const col = colIndex + 1;
            worksheet.getColumn(col).width = 50; // Width between 40-60 as requested
        });
        
        // Set row heights for better readability
        for (let row = 1; row <= maxRows + 1; row++) {
            worksheet.getRow(row).height = 30;
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Channels_Titles_Total_${timestamp}.xlsx`;
        const filepath = path.join(process.cwd(), 'reports', filename);
        
        // Create reports directory if it doesn't exist
        const fs = require('fs');
        const reportsDir = path.join(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        // Save the workbook
        await workbook.xlsx.writeFile(filepath);
        
        console.log(`✅ Channel Excel report generated: ${filepath}`);
        
        const totalForwarded = Object.values(channelData).reduce((sum, channel) => sum + channel.total, 0);
        
        return {
            success: true,
            filepath,
            filename,
            stats: {
                totalChannels: channelNames.length,
                totalForwarded,
                channelBreakdown: Object.fromEntries(
                    channelNames.map(name => [name, channelData[name].total])
                )
            }
        };
        
    } catch (error) {
        console.error('❌ Error generating channel Excel report:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    generateUsersTitlesSheet,
    generateChannelTitlesSheet,
    generatePerformanceSummary
};
