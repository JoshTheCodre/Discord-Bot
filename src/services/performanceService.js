const { readData } = require('./storage');
const { syncAllDataToSheets } = require('./googleSheetsService');

/**
 * Generate performance summary for Discord embed
 */
const generatePerformanceSummary = async (today = '2025-10-09') => {
    try {
        const data = await readData();
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


module.exports = {
    generatePerformanceSummary,
    syncAllDataToSheets
};

