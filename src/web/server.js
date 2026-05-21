const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { getAllTasks, getAllUsers, patchSubtaskAtomic, getAdminByEmail, ensureDefaultAdmin, getLogs } = require('../firebase/firestoreService');

const app = express();

// Security headers (CSP disabled — templates use inline styles/scripts)
app.use(helmet({
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'solomax-studios-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Middleware
app.use(express.static(path.join(__dirname, '../../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Auth guard — applied to all protected routes
function requireAuth(req, res, next) {
  if (req.session && req.session.adminEmail) return next();
  res.redirect('/login');
}

// Health check (public)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'discord-bot-web',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Login page
app.get('/login', (req, res) => {
  if (req.session && req.session.adminEmail) return res.redirect('/');
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('login', { error: 'Email and password are required.' });
  }
  try {
    const admin = await getAdminByEmail(email.trim().toLowerCase());
    if (!admin) {
      return res.render('login', { error: 'Invalid email or password.' });
    }
    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) {
      return res.render('login', { error: 'Invalid email or password.' });
    }
    req.session.adminEmail = admin.email;
    req.session.adminName = admin.name || 'Admin';
    res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Something went wrong. Please try again.' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Convert Firestore Timestamp / Date / string → ISO string
function serializeDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return val;
}

// Protected routes
app.get('/', requireAuth, async (req, res) => {
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
      const userTasks = tasks.filter(t => t.assignedTo === user.discordId || t.assignedTo === user.id || t.assignedTo === user.userId || t.assignedTo === user.name);
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

    res.render('index', { ...stats, users: enrichedUsers, adminName: req.session.adminName });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

app.get('/tasks', requireAuth, async (req, res) => {
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
      createdAt: serializeDate(task.createdAt),
      assignedToName: usersMap[task.assignedTo] || task.assignedTo || 'Unassigned',
      completedCount: task.subTasks?.filter(st => st.status === 'completed').length || 0,
      totalCount: task.subTasks?.length || 0,
      postedCount: task.subTasks?.filter(st => st.posted === true).length || 0
    }));

    res.render('tasks', { tasks: enrichedTasks, adminName: req.session.adminName });
  } catch (error) {
    console.error('Error loading tasks:', error);
    res.status(500).send('Error loading tasks');
  }
});

app.get('/tasks/:taskId', requireAuth, async (req, res) => {
  try {
    const tasks = await getAllTasks();
    const task = tasks.find(t => t.taskId === req.params.taskId || t.id === req.params.taskId);
    if (!task) {
      return res.status(404).render('error', { message: 'Task not found' });
    }
    res.render('task-detail', { task, adminName: req.session.adminName });
  } catch (error) {
    console.error('Error loading task:', error);
    res.status(500).send('Error loading task');
  }
});

app.get('/performance', requireAuth, async (req, res) => {
  try {
    const [users, tasks] = await Promise.all([getAllUsers(), getAllTasks()]);

    const leaderboard = users.map(user => {
      const userTasks = tasks.filter(t =>
        t.assignedTo === user.discordId || t.assignedTo === user.id || t.assignedTo === user.userId || t.assignedTo === user.name
      );
      const completedCount = userTasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.status === 'completed').length || 0), 0);
      const totalCount = userTasks.reduce((sum, t) => sum + (t.subTasks?.length || 0), 0);
      const postedCount = userTasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.posted === true).length || 0), 0);
      const copyrightCount = userTasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.copyrightIssue && !st.copyrightFixed).length || 0), 0);
      return {
        ...user,
        discordId: user.discordId || user.id || user.userId || '',
        discordUsername: user.discordUsername || user.name || user.username || 'Unknown User',
        completedCount,
        totalCount,
        postedCount,
        copyrightCount,
        totalContributions: completedCount + postedCount,
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
      };
    }).sort((a, b) => b.completedCount - a.completedCount);

    const allSubtasks = tasks.flatMap(t => t.subTasks || []);
    const reportStats = {
      totalTasks: tasks.length,
      totalUsers: users.length,
      totalSubtasks: allSubtasks.length,
      completedSubtasks: allSubtasks.filter(st => st.status === 'completed').length,
      postedSubtasks: allSubtasks.filter(st => st.posted === true).length,
      openCopyright: allSubtasks.filter(st => st.copyrightIssue && !st.copyrightFixed).length
    };

    res.render('performance', { users: leaderboard, reportStats, adminName: req.session.adminName });
  } catch (error) {
    console.error('Error loading performance:', error);
    res.status(500).send('Error loading performance');
  }
});

app.get('/flags', requireAuth, async (req, res) => {
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

    res.render('flags', { tasks: copyrightTasks, totalIssues, fixedIssues, adminName: req.session.adminName });
  } catch (error) {
    console.error('Error loading flags page:', error);
    res.status(500).render('error', { statusCode: 500, message: error.message });
  }
});

app.post('/api/flags/toggle', requireAuth, async (req, res) => {
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

app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const [tasks, users] = await Promise.all([getAllTasks(), getAllUsers()]);
    const stats = {
      totalTasks: tasks.length,
      totalUsers: users.length,
      completedTasks: tasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.status === 'completed').length || 0), 0),
      totalSubtasks: tasks.reduce((sum, t) => sum + (t.subTasks?.length || 0), 0),
      postedTasks: tasks.reduce((sum, t) => sum + (t.subTasks?.filter(st => st.posted === true).length || 0), 0)
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/logs', requireAuth, async (req, res) => {
  try {
    const category = req.query.category || 'all';
    const logs = await getLogs({ category: category === 'all' ? null : category });
    res.render('logs', { logs, activeCategory: category, adminName: req.session.adminName });
  } catch (error) {
    console.error('Error loading logs:', error);
    res.status(500).send('Error loading logs');
  }
});

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    statusCode: 404,
    message: 'Page not found',
    details: `The requested URL ${req.originalUrl} does not exist.`
  });
});

// Error handler
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
app.listen(PORT, async () => {
  console.log(`📊 Web dashboard running on http://localhost:${PORT}`);
  const bcryptForSetup = require('bcryptjs');
  const { ensureDefaultAdmin } = require('../firebase/firestoreService');
  await ensureDefaultAdmin(bcryptForSetup);
});

module.exports = app;
