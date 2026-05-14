const express = require('express');
const path = require('path');
const helmet = require('helmet');
const { readData } = require('../services/storage');
const { getAllTasks, getAllUsers, patchSubtaskAtomic } = require('../firebase/firestoreService');

const app = express();

// Security headers (CSP disabled — templates use inline styles/scripts)
app.use(helmet({
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Middleware
app.use(express.static(path.join(__dirname, '../../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../views'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'discord-bot-web',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.get('/', async (req, res) => {
  try {
    const [tasks, users] = await Promise.all([getAllTasks(), getAllUsers()]);

    const stats = {
      totalTasks: tasks.length,
      totalUsers: users.length,
      completedTasks: tasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.status === 'completed').length || 0), 0),
      totalSubtasks: tasks.reduce((sum, t) => sum + (t.subTasks?.length || 0), 0),
      postedTasks: tasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.posted === true).length || 0), 0)
    };

    const enrichedUsers = users.map(user => {
      const userTasks = tasks.filter(t => t.assignedTo === user.id || t.assignedTo === user.name);
      const completedCount = userTasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.status === 'completed').length || 0), 0);
      const totalCount = userTasks.reduce((sum, t) => sum + (t.subTasks?.length || 0), 0);
      const postedCount = userTasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.posted === true).length || 0), 0);
      return {
        ...user,
        discordId: user.discordId || user.id || user.userId || '',
        discordUsername: user.discordUsername || user.name || user.username || 'Unknown',
        completedCount,
        postedCount,
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
      };
    });

    res.render('index', { ...stats, users: enrichedUsers });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Tasks page
app.get('/tasks', async (req, res) => {
  try {
    const [tasks, users] = await Promise.all([getAllTasks(), getAllUsers()]);

    const usersMap = {};
    users.forEach(u => {
      const name = u.discordUsername || u.name || u.username || '';
      if (u.id) usersMap[u.id] = name;
      if (u.discordId) usersMap[u.discordId] = name;
      if (u.userId) usersMap[u.userId] = name;
      if (name) usersMap[name] = name;
    });

    const enrichedTasks = tasks.map(task => ({
      ...task,
      assignedToName: usersMap[task.assignedTo] || task.assignedTo || 'Unassigned',
      completedCount: task.subTasks?.filter(st => st.status === 'completed').length || 0,
      totalCount: task.subTasks?.length || 0,
      postedCount: task.subTasks?.filter(st => st.posted === true).length || 0
    }));

    res.render('tasks', { tasks: enrichedTasks });
  } catch (error) {
    console.error('Error loading tasks:', error);
    res.status(500).send('Error loading tasks');
  }
});

// Task details
app.get('/tasks/:taskId', async (req, res) => {
  try {
    const tasks = await getAllTasks();
    const task = tasks.find(t => t.taskId === req.params.taskId || t.id === req.params.taskId);
    
    if (!task) {
      return res.status(404).render('error', { message: 'Task not found' });
    }
    
    res.render('task-detail', { task });
  } catch (error) {
    console.error('Error loading task:', error);
    res.status(500).send('Error loading task');
  }
});

// Performance
app.get('/performance', async (req, res) => {
  try {
    const users = await getAllUsers();
    const tasks = await getAllTasks();
    
    const leaderboard = users.map(user => {
      const userTasks = tasks.filter(t => 
        t.assignedTo === user.id || t.assignedTo === user.name
      );
      
      const completedCount = userTasks.reduce((sum, t) => 
        sum + (t.subTasks?.filter(st => st.status === 'completed').length || 0), 0
      );
      
      const totalCount = userTasks.reduce((sum, t) => 
        sum + (t.subTasks?.length || 0), 0
      );
      
      const postedCount = userTasks.reduce((sum, t) => 
        sum + (t.subTasks?.filter(st => st.posted === true).length || 0), 0
      );

      const discordId = user.discordId || user.id || user.userId || '';
      const discordUsername = user.discordUsername || user.name || user.username || 'Unknown User';
      
      return {
        ...user,
        discordId,
        discordUsername,
        completedCount,
        totalCount,
        postedCount,
        totalContributions: completedCount + postedCount,
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
      };
    }).sort((a, b) => b.completedCount - a.completedCount);
    
    res.render('performance', { users: leaderboard });
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    res.status(500).send('Error loading leaderboard');
  }
});

// Flagged content page
app.get('/flags', async (req, res) => {
  try {
    const [tasks, users] = await Promise.all([getAllTasks(), getAllUsers()]);

    const usersMap = {};
    users.forEach(u => {
      const name = u.discordUsername || u.name || u.username || '';
      if (u.id) usersMap[u.id] = name;
      if (u.discordId) usersMap[u.discordId] = name;
      if (u.userId) usersMap[u.userId] = name;
      if (name) usersMap[name] = name;
    });

    const copyrightTasks = tasks
      .map(task => ({
        ...task,
        assignedToName: usersMap[task.assignedTo] || task.assignedTo || 'Unassigned',
        copyrightSubtasks: (task.subTasks || []).filter(st => st.copyrightIssue === true)
      }))
      .filter(task => task.copyrightSubtasks.length > 0);

    const totalIssues = copyrightTasks.reduce((n, t) => n + t.copyrightSubtasks.length, 0);
    const fixedIssues = copyrightTasks.reduce((n, t) => n + t.copyrightSubtasks.filter(st => st.copyrightFixed).length, 0);

    res.render('flags', { tasks: copyrightTasks, totalIssues, fixedIssues });
  } catch (error) {
    console.error('Error loading copyright page:', error);
    res.status(500).render('error', { statusCode: 500, message: error.message });
  }
});

// Toggle flagged content fixed status
app.post('/api/flags/toggle', async (req, res) => {
  try {
    const { taskId, subtaskTitle, fixed } = req.body;
    if (!taskId || !subtaskTitle) {
      return res.status(400).json({ success: false, reason: 'missing_fields' });
    }
    const result = await patchSubtaskAtomic(taskId, subtaskTitle, { copyrightFixed: !!fixed });
    res.json(result);
  } catch (error) {
    console.error('Error toggling copyright:', error);
    res.status(500).json({ success: false, reason: 'error', error: error.message });
  }
});

// API endpoints
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const tasks = await getAllTasks();
    const users = await getAllUsers();
    
    const stats = {
      totalTasks: tasks.length,
      totalUsers: users.length,
      completedTasks: tasks.reduce((sum, t) => {
        const completed = t.subTasks?.filter(st => st.status === 'completed').length || 0;
        return sum + completed;
      }, 0),
      totalSubtasks: tasks.reduce((sum, t) => sum + (t.subTasks?.length || 0), 0),
      postedTasks: tasks.reduce((sum, t) => {
        const posted = t.subTasks?.filter(st => st.posted === true).length || 0;
        return sum + posted;
      }, 0)
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 Error Handler
app.use((req, res) => {
  res.status(404).render('error', {
    statusCode: 404,
    message: 'Page not found',
    details: `The requested URL ${req.originalUrl} does not exist.`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(err.status || 500).render('error', {
    statusCode: err.status || 500,
    message: err.message || 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? err.stack : null
  });
});

// Start server
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
  console.log(`📊 Web dashboard running on http://localhost:${PORT}`);
});

module.exports = app;
