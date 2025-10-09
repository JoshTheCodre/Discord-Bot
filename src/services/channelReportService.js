/**
 * Channel Report Service - Dedicated Excel Report Generator
 * Generates Channel Titles & Total Excel sheet as per Prompt 2 specifications
 */

const ExcelJS = require('exceljs');
const { readData } = require('./storage');
const path = require('path');

/**
 * Generate Channels — Titles & Total Excel sheet
 * 
 * Creates an Excel sheet with:
 * - Each channel as one column (header = channel name)
 * - Forwarded subtask titles listed vertically in each column
 * - Final cell in each column shows "Total: X" where X = number of forwarded items
 * - Handles compound IDs (e.g., "TMK1" → task "TMK", subtask 1)
 * - Resolves compound IDs to actual subtask titles
 * - Shows raw compound ID as fallback if task/subtask not found
 */
const generateChannelTitlesTotalsSheet = async () => {
    try {
        console.log('🔄 Starting Channel Titles & Total sheet generation...');
        
        // Read data from storage
        const data = readData();
        const tasks = data.tasks || [];
        const channels = data.channels || {};
        
        console.log(`📊 Found ${Object.keys(channels).length} channels in data`);
        
        // Create new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Channels — Titles & Total');
        
        // Get channel names sorted alphabetically
        const channelNames = Object.keys(channels).sort();
        
        if (channelNames.length === 0) {
            console.log('⚠️ No channels found in data');
            // Create empty sheet with message
            worksheet.getCell(1, 1).value = 'No channels found';
            worksheet.getCell(1, 1).font = { italic: true };
            worksheet.getColumn(1).width = 20;
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `Channels_Titles_Total_${timestamp}.xlsx`;
            const filepath = path.join(process.cwd(), 'reports', filename);
            
            // Ensure reports directory exists
            const fs = require('fs');
            const reportsDir = path.join(process.cwd(), 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
            
            await workbook.xlsx.writeFile(filepath);
            
            return {
                success: true,
                filepath,
                filename,
                stats: {
                    totalChannels: 0,
                    totalForwardedItems: 0,
                    channelBreakdown: {}
                }
            };
        }
        
        // Process each channel to build data structure
        const channelData = {};
        let totalForwardedItems = 0;
        
        channelNames.forEach(channelName => {
            console.log(`🔍 Processing channel: ${channelName}`);
            
            const forwardedItems = channels[channelName] || [];
            const channelTitles = [];
            
            forwardedItems.forEach(item => {
                const compoundId = item.taskId; // e.g., "TMK1"
                let subtaskTitle = compoundId; // Default fallback to raw compound ID
                
                console.log(`  📋 Processing forwarded item: ${compoundId}`);
                
                // Parse compound ID (e.g., "TMK1" → taskGroup: "TMK", subtaskId: 1)
                const match = compoundId.match(/^([A-Za-z]+)(\d+)$/);
                if (match) {
                    const taskGroup = match[1];    // "TMK"
                    const subtaskId = parseInt(match[2]); // 1
                    
                    // Find matching task in tasks array
                    const task = tasks.find(t => t.taskId === taskGroup);
                    if (task) {
                        // Find matching subtask within the task
                        const subtask = task.subTasks?.find(st => st.subTaskID === subtaskId);
                        if (subtask) {
                            subtaskTitle = subtask.title;
                            console.log(`    ✅ Resolved to title: "${subtaskTitle}"`);
                        } else {
                            console.log(`    ⚠️ Subtask ${subtaskId} not found in task ${taskGroup}, using fallback: ${compoundId}`);
                        }
                    } else {
                        console.log(`    ⚠️ Task ${taskGroup} not found, using fallback: ${compoundId}`);
                    }
                } else {
                    console.log(`    ⚠️ Could not parse compound ID ${compoundId}, using as-is`);
                }
                
                channelTitles.push(subtaskTitle);
                totalForwardedItems++;
            });
            
            channelData[channelName] = {
                titles: channelTitles,
                total: channelTitles.length
            };
            
            console.log(`  📊 Channel ${channelName}: ${channelTitles.length} items`);
        });
        
        // Find maximum number of rows needed (max titles + 1 for summary)
        const maxTitles = Math.max(...channelNames.map(name => channelData[name].titles.length), 0);
        const totalRows = maxTitles + 1; // +1 for summary row
        
        console.log(`📏 Maximum rows needed: ${totalRows} (${maxTitles} titles + 1 summary)`);
        
        // Create column headers (channel names) in row 1
        const headerRow = worksheet.getRow(1);
        channelNames.forEach((channelName, colIndex) => {
            const col = colIndex + 1;
            headerRow.getCell(col).value = channelName;
            headerRow.getCell(col).font = { bold: true, size: 12 };
            headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.getCell(col).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' } // Light blue header background
            };
        });
        
        // Fill in data for each channel
        channelNames.forEach((channelName, colIndex) => {
            const col = colIndex + 1;
            const channel = channelData[channelName];
            
            // Add subtask titles (starting from row 2)
            channel.titles.forEach((title, titleIndex) => {
                const row = titleIndex + 2; // +2 because row 1 is header
                const cell = worksheet.getCell(row, col);
                cell.value = title;
                cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            
            // Add summary row at the bottom
            const summaryRowNum = channel.titles.length + 2; // +2 because row 1 is header
            const summaryCell = worksheet.getCell(summaryRowNum, col);
            summaryCell.value = `Total: ${channel.total}`;
            summaryCell.font = { bold: true, size: 11 };
            summaryCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
            summaryCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF3E0' } // Light orange summary background
            };
            summaryCell.border = {
                top: { style: 'medium' },
                left: { style: 'thin' },
                bottom: { style: 'medium' },
                right: { style: 'thin' }
            };
        });
        
        // Set column widths (40-60 range as specified)
        channelNames.forEach((_, colIndex) => {
            const col = colIndex + 1;
            worksheet.getColumn(col).width = 50; // Middle of 40-60 range
        });
        
        // Set row heights for better readability
        headerRow.height = 25; // Header row
        for (let row = 2; row <= totalRows + 1; row++) {
            worksheet.getRow(row).height = 30; // Content rows
        }
        
        // Add borders to header row
        channelNames.forEach((_, colIndex) => {
            const col = colIndex + 1;
            headerRow.getCell(col).border = {
                top: { style: 'medium' },
                left: { style: 'medium' },
                bottom: { style: 'medium' },
                right: { style: 'medium' }
            };
        });
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Channels_Titles_Total_${timestamp}.xlsx`;
        const filepath = path.join(process.cwd(), 'reports', filename);
        
        // Ensure reports directory exists
        const fs = require('fs');
        const reportsDir = path.join(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        // Save the workbook
        await workbook.xlsx.writeFile(filepath);
        
        console.log(`✅ Channel Titles & Total sheet generated successfully: ${filepath}`);
        
        // Prepare channel breakdown for stats
        const channelBreakdown = {};
        channelNames.forEach(name => {
            channelBreakdown[name] = channelData[name].total;
        });
        
        return {
            success: true,
            filepath,
            filename,
            stats: {
                totalChannels: channelNames.length,
                totalForwardedItems,
                channelBreakdown,
                maxTitlesInChannel: maxTitles,
                channelsWithItems: channelNames.filter(name => channelData[name].total > 0).length,
                emptyChannels: channelNames.filter(name => channelData[name].total === 0).length
            }
        };
        
    } catch (error) {
        console.error('❌ Error generating Channel Titles & Total sheet:', error);
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
};

/**
 * Get channel performance summary (for Discord embeds)
 */
const getChannelPerformanceSummary = () => {
    try {
        const data = readData();
        const channels = data.channels || {};
        
        const summary = {
            totalChannels: Object.keys(channels).length,
            activeChannels: 0,
            totalForwardedItems: 0,
            channelBreakdown: {}
        };
        
        Object.entries(channels).forEach(([channelName, items]) => {
            const itemCount = items.length;
            summary.channelBreakdown[channelName] = itemCount;
            summary.totalForwardedItems += itemCount;
            if (itemCount > 0) {
                summary.activeChannels++;
            }
        });
        
        return {
            success: true,
            summary
        };
    } catch (error) {
        console.error('❌ Error getting channel performance summary:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    generateChannelTitlesTotalsSheet,
    getChannelPerformanceSummary
};
