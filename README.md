# Discord Task Management Bot

A comprehensive Discord bot for task management, user registration, performance tracking, and workflow automation with Google Sheets integration and Firebase support.

## 📁 Project Structure

```
Discord-Bot/
├── src/
│   ├── bot.js                      # Main bot application
│   ├── services/
│   │   ├── storage.js              # JSON data persistence
│   │   ├── googleSheetsService.js  # Google Sheets integration
│   │   ├── taskService.js          # Task management & reminders
│   │   ├── performanceService.js   # Performance analytics
│   │   ├── birthdayService.js      # Birthday automation
│   │   ├── finishedTaskService.js  # Task completion handling
│   │   ├── channelService.js       # Channel management
│   │   ├── setupService.js         # User registration
│   │   └── tasksViewService.js     # Task visualization
│   └── utils/
│       ├── parser.js               # Message parsing
│       ├── userUtils.js            # User utilities
│       └── registerCommands.js     # Command registration
├── firebase-migration/             # Firebase migration module
│   ├── firebase.js                 # Firebase configuration
│   ├── firestoreService.js         # Firestore operations
│   ├── migrationService.js         # Migration tools
│   ├── migrationCommands.js        # Migration CLI
│   ├── test-firebase.js            # Connection testing
│   └── *.md                        # Firebase documentation
├── config/
│   └── google-credentials.json     # Google Service Account
├── data/
│   └── storage.json                # Local data storage
├── .env                            # Environment variables
├── index.js                        # Entry point
└── package.json                    # Dependencies
```

## 🚀 Features

### Core Functionality
- ✅ **User Registration** - `/setup` command with name, birthday, and role assignment
- ✅ **Task Management** - Natural language parsing, subtask support, approval system
- ✅ **Performance Analytics** - Individual and channel performance tracking
- ✅ **Daily Automation** - Task reminders (9 AM) and birthday notifications (8 AM)
- ✅ **Role-Based Access** - Admin/user permissions with automatic assignment

### Data & Reporting
- ✅ **Google Sheets Integration** - Real-time sync with table format display
- ✅ **Firebase Migration Ready** - Cloud database prepared in separate module
- ✅ **Performance Reports** - `/performance` command with detailed analytics
- ✅ **Data Validation** - Registration requirements and duplicate prevention
- ✅ **Backup Systems** - Multiple storage options with migration tools

### Modern UX
- ✅ **Slash Commands** - Modern Discord interaction patterns
- ✅ **Ephemeral Responses** - Dismissible command responses
- ✅ **Rich Embeds** - Beautiful task and performance displays
- ✅ **Real-time Updates** - Live data synchronization
- ✅ **Error Handling** - Comprehensive validation and user feedback

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

## 🔥 Firebase Migration Module

The `firebase-migration/` folder contains a complete, self-contained Firebase Firestore migration system:

### Ready for Migration
```bash
# Test Firebase connection
node firebase-migration/test-firebase.js

# Run migration when ready
node firebase-migration/migrationCommands.js migrate
```

### Features
- ✅ **Isolated Module** - Separate from main bot functionality
- ✅ **Complete Migration Tools** - Automated data transfer
- ✅ **Backup System** - Safe migration with data protection
- ✅ **Verification Tools** - Ensure migration accuracy

**Firebase Project**: solomaxstudios-246c0  
**Database**: sm-discord-bot-db  
**Status**: Ready for migration when needed

---

**Ready to streamline your team's workflow!** 🚀
