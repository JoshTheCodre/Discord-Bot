# Discord Task Bot

A modern Discord bot for managing task assignments, user registration, and workflow automation in your server.

## 📁 Project Structure

```
Discord-Bot/
├── src/
│   ├── bot.js                 # Main bot file
│   ├── services/
│   │   ├── storage.js         # Data persistence
│   │   ├── taskService.js     # Daily reminders
│   │   ├── finishedTaskService.js # Task forwarding
│   │   ├── channelService.js  # Channel management
│   │   └── setupService.js    # User setup handling
│   └── utils/
│       ├── parser.js          # Message parsing
│       ├── userUtils.js       # User management & validation
│       └── registerCommands.js # Command registration
├── data/
│   └── storage.json           # Task & user data
├── .env                       # Bot token & client ID
├── index.js                   # Entry point
└── package.json
```

## 🚀 Features

- ✅ **User Registration** - `/setup` command with name, birthday, and role assignment
- ✅ **Registration Validation** - Users must register before task assignment
- ✅ **Birthday Reminders** - Automatic birthday DMs and channel announcements at 8 AM
- ✅ **Natural Language Task Parsing** - Create tasks from simple messages
- ✅ **Role-Based Access** - Admin/user roles with automatic assignment
- ✅ **Daily Reminders** - Send DM reminders at 9 AM for overdue/due tasks
- ✅ **Subtask Support** - Handle numbered subtasks with completion tracking
- ✅ **Task Forwarding** - Forward completed tasks with rich embeds
- ✅ **Duplicate Prevention** - Prevent duplicate replies and assignments
- ✅ **Approval System** - Task approval via `@approved` in threads

## 📝 Usage Guide

### 1. **User Registration** (`/setup` command)

**First-time users must register:**
```
/setup
```
- Fill modal with name and birthday (MM/DD format)
- Role automatically assigned (admin/user based on ID list)
- One-time setup per user

**Success Response:**
```
🎉 Profile Setup Complete!
Welcome to the team, John!

👤 Name: John
🎂 Birthday: 03/15
🏷️ Role: 👤 User
```

### 2. **Task Assignment** (`#task-assignments` channel)

**Format:**
```
FOR @user

Deadline: 13th Sept
Movie: The Bad Guys 2
Style: Jane Recaps Style

1. Cairo Heist to Confetti Escape Recap
2. Wrestling Mayhem to Fans Chase Recap
```

- Only registered users can be assigned tasks
- Bot replies: `✅ Task TGI created for Username`
- User receives congratulatory DM

### 3. **Task Completion** (`#finished-tasks` channel)

**Reply to task message with:**
```
@danny for #alpha-recaps
```

**Features:**
- ✅ Creates rich embed with task details
- ✅ Forwards to target channel with attachments
- ✅ Warns if receiver is unregistered
- ✅ Tracks forwarding in database

### 4. **Task Approval** (in task threads)

**Approve completed subtasks:**
```
@approved
```
- Marks subtask as completed in database
- Prevents duplicate approvals
- Shows completion timestamp

### 5. **Birthday System** (Automatic)

**Automatic Features:**
- ✅ Daily birthday checks at 8:00 AM
- ✅ Custom birthday DMs to users on their birthday
- ✅ Announcements in `#general-chat` and `#announcements` channels
- ✅ Rich embeds with personalized messages
- ✅ No commands needed - fully automated!

## 🔧 Setup & Configuration

### 1. **Discord Bot Setup**
- Enable **Message Content Intent** in Discord Developer Portal
- Enable **Server Members Intent** (recommended)
- Copy Bot Token and Client ID

### 2. **Environment Variables**
```bash
# .env file
DISCORD_BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

### 3. **Admin Configuration**
Edit `src/services/setupService.js` to add admin user IDs:
```javascript
const ADMIN_IDS = [
    '1384014266822033459', // Joshua (example)
    'your_admin_id_here',
    // Add more admin IDs here
];
```

### 4. **Install & Run**
```bash
npm install
npm start
```

### 5. **Required Channels**
- `#task-assignments` - For creating tasks
- `#finished-tasks` - For task completion and forwarding

## �️ Registration & Validation System

### **Registration Requirements**
- Users must complete `/setup` before task assignment
- Registered users have: `name`, `birthday`, and `role`
- Unregistered users cannot receive tasks or reminders

### **Validation Messages**
```
❌ User must complete /setup before task assignment.
Please run `/setup` first to register your profile with name and birthday.
```

### **User States**
- **Registered**: Completed `/setup` with birthday field
- **Unregistered**: Legacy users without birthday field

## 💾 Data Structure

### **Registered User**
```json
{
  "id": "1234567890",
  "name": "User Name",
  "birthday": "03/15",
  "role": "user",
  "dateJoined": "2025-10-08T12:00:00.000Z",
  "setupCompletedAt": "2025-10-08T12:00:00.000Z"
}
```

### **Task with Subtasks**
```json
{
  "taskId": "TGI",
  "movieName": "The Bad Guys 2",
  "assignedTo": "1234567890",
  "dueDate": "2025-09-13",
  "status": "pending",
  "subTasks": [
    {
      "subTaskID": 1,
      "title": "Cairo Heist to Confetti Escape Recap",
      "status": "completed",
      "completedAt": "2025-10-08T08:01:00.736Z"
    }
  ]
}
```

### **Channel Tracking**
```json
{
  "channels": {
    "alpha-recaps": [
      {
        "taskId": "TGI1",
        "channelId": "1234567890",
        "forwardedBy": "1234567890",
        "forwardedTo": "1234567890",
        "forwardedAt": "2025-10-08T08:15:51.475Z",
        "status": "forwarded"
      }
    ]
  }
}
```

## ⏰ Automated Features

### **Daily Task Reminders (9:00 AM)**
- Target: Registered users with overdue/due tasks
- Method: Direct Messages
- Content: Task details with status

### **Birthday Reminders (8:00 AM)**
- Target: Users with birthdays today
- Personal DM: Custom birthday message with celebratory embed
- Channel Announcements: `#general-chat` and `#announcements`
- Features: Random messages, rich embeds, @everyone mentions

### **Approval System**
- Use `@approved` in task threads
- Prevents duplicate approvals
- Shows completion timestamps

### **Task Forwarding**
- Rich embeds with task details
- Automatic attachment handling
- Channel tracking and analytics

## 🎯 Key Benefits

- **Data Quality**: All users have complete profiles
- **Error Prevention**: Clear validation and error messages
- **User Experience**: Modern slash commands and rich embeds
- **Workflow Management**: Complete task lifecycle tracking
- **Role-Based Access**: Admin/user permissions
- **Automation**: Daily reminders and task tracking

## 🚨 Migration Notes

- Existing users need to run `/setup` to become "registered"
- Legacy task assignments will show warnings until users register
- All new features require user registration

---

**Ready to streamline your team's workflow!** 🚀
