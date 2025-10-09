/**
 * Parse task message content - supports both command and natural formats
 */
function parseTaskMessage(content) {
    const lines = content.trim().split('\n');
    
    // Command format: movie:X style:Y due:YYYY-MM-DD @user
    const cmdMatch = lines[0].match(/^\s*movie:(.+?)\s+style:(.+?)\s+due:(\d{4}-\d{2}-\d{2})\s+(?:<@(\d+)>|@(\S+))\s*$/);
    if (cmdMatch && cmdMatch[1].trim() && cmdMatch[2].trim()) {
        return {
            isValid: true,
            data: {
                movieName: cmdMatch[1].trim(),
                style: cmdMatch[2].trim(),
                dueDate: cmdMatch[3],
                assignedTo: cmdMatch[4] || cmdMatch[5],
                subTasks: parseSubTasks(lines.slice(1))
            }
        };
    }
    
    // Natural format: FOR @user, Movie: X, Style: Y, Deadline: Z
    const userMatch = lines[0].match(/FOR\s+(?:<@(\d+)>|@(\S+))/i);
    if (!userMatch) return { isValid: false };
    
    let movie, style, deadline;
    for (const line of lines) {
        const t = line.trim();
        if (/^\d+\./.test(t)) continue;
        if (!movie) movie = t.match(/Movie:\s*(.+)/i)?.[1]?.trim();
        if (!style) style = t.match(/Style:\s*(.+)/i)?.[1]?.trim();
        if (!deadline) deadline = t.match(/Deadline:\s*(.+)/i)?.[1]?.trim();
    }
    
    if (!movie || !style || !deadline) return { isValid: false };
    
    return {
        isValid: true,
        data: {
            movieName: movie,
            style: style,
            dueDate: parseDeadline(deadline),
            assignedTo: userMatch[1] || userMatch[2],
            subTasks: parseSubTasks(lines)
        }
    };
}

function parseDeadline(str) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    
    const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', sept:'09', oct:'10', nov:'11', dec:'12' };
    const match = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)/i);
    
    return match && months[match[2].toLowerCase().substring(0, 3)] 
        ? `${new Date().getFullYear()}-${months[match[2].toLowerCase().substring(0, 3)]}-${match[1].padStart(2, '0')}`
        : null;
}

function parseSubTasks(lines) {
    const tasks = lines.map(line => {
        const match = line.trim().match(/^\s*(\d+)\.\s+(.+?)\s*$/);
        return match ? { subTaskID: parseInt(match[1]), title: match[2].trim(), status: 'pending', completedAt: null } : null;
    }).filter(Boolean);
    
    return tasks.length > 0 ? tasks : undefined;
}

module.exports = { parseTaskMessage };
