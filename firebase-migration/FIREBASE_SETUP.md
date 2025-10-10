# Firebase Migration Setup

This document outlines the Firebase Firestore setup and migration process for the Discord Bot.

## Firebase Configuration

**Project**: solomaxstudios-246c0  
**Database**: sm-discord-bot-db  
**Console URL**: https://console.firebase.google.com/project/solomaxstudios-246c0/firestore/databases/sm-discord-bot-db/data

### Configuration Details
- **API Key**: AIzaSyDPEMw5tzQ6UpWzB1Femj04f71rIx2qETk
- **Auth Domain**: solomaxstudios-246c0.firebaseapp.com
- **Project ID**: solomaxstudios-246c0
- **Storage Bucket**: solomaxstudios-246c0.firebasestorage.app
- **Messaging Sender ID**: 636289372629
- **App ID**: 1:636289372629:web:f8c37785cb827b6ab8ed5c
- **Measurement ID**: G-WZ872HZ7N8

## File Structure

```
Discord-Bot/
├── config/
│   └── firebase.js                 # Firebase configuration and initialization
├── src/
│   ├── services/
│   │   ├── firestoreService.js     # Firestore database operations
│   │   └── migrationService.js     # Migration from JSON to Firestore
│   └── utils/
│       └── migrationCommands.js    # Migration command utilities
└── backups/                        # Created during migration
    └── backup-[timestamp].json     # Backup files
```

## Collections Structure

### users
```javascript
{
  id: "userId",
  username: "string",
  displayName: "string", 
  joinedAt: "timestamp",
  isActive: "boolean",
  preferences: "object",
  stats: "object",
  createdAt: "serverTimestamp",
  updatedAt: "serverTimestamp"
}
```

### channels
```javascript
{
  id: "channelId",
  name: "string",
  type: "string",
  isActive: "boolean", 
  settings: "object",
  stats: "object",
  createdAt: "serverTimestamp",
  updatedAt: "serverTimestamp"
}
```

### tasks
```javascript
{
  id: "taskId (auto-generated)",
  title: "string",
  description: "string",
  assignedTo: "userId",
  channelId: "channelId",
  status: "string",
  priority: "string",
  dueDate: "timestamp",
  completedAt: "timestamp",
  metadata: "object",
  createdAt: "serverTimestamp",
  updatedAt: "serverTimestamp"
}
```

### performance
```javascript
{
  id: "recordId (auto-generated)",
  userId: "string",
  type: "string", // 'user_summary', 'channel_summary', etc.
  data: "object",
  period: "string",
  channelId: "string", // optional
  timestamp: "serverTimestamp"
}
```

### settings
```javascript
{
  id: "settingKey",
  value: "any",
  updatedAt: "serverTimestamp"
}
```

## Migration Process

⚠️ **DO NOT RUN MIGRATION YET!** Files are prepared but not executed.

### Pre-Migration Checklist
- [ ] Firebase project is accessible
- [ ] Database permissions are configured
- [ ] Current JSON data is backed up
- [ ] Bot is temporarily stopped during migration

### Migration Commands

1. **Test Firebase Connection**
   ```bash
   node src/utils/migrationCommands.js test
   ```

2. **Create Backup**
   ```bash
   node src/utils/migrationCommands.js backup
   ```

3. **Run Full Migration**
   ```bash
   node src/utils/migrationCommands.js migrate
   ```

4. **Verify Migration**
   ```bash
   node src/utils/migrationCommands.js verify
   ```

### Individual Migrations (if needed)
```bash
node src/utils/migrationCommands.js users
node src/utils/migrationCommands.js channels  
node src/utils/migrationCommands.js tasks
node src/utils/migrationCommands.js performance
```

## Services Available

### FirestoreService
- Complete CRUD operations for all collections
- Real-time listeners with `subscribeToCollection()`
- Query support with filters, ordering, limits
- Server timestamps for consistency

### MigrationService  
- Automated migration from JSON storage
- Data transformation and validation
- Progress tracking and error handling
- Migration verification

## Usage After Migration

```javascript
const firestoreService = require('./src/services/firestoreService');

// Create user
await firestoreService.createUser(userId, userData);

// Get user tasks
const tasks = await firestoreService.getUserTasks(userId);

// Record performance
await firestoreService.recordPerformance(userId, performanceData);

// Real-time updates
const unsubscribe = firestoreService.subscribeToCollection('tasks', (tasks) => {
  console.log('Tasks updated:', tasks);
});
```

## Security Notes

- Firebase configuration contains public API keys (normal for client-side)
- Database security rules should be configured in Firebase Console
- Consider implementing authentication for sensitive operations
- Regular backups recommended

## Next Steps (When Ready to Migrate)

1. Test Firebase connection
2. Create backup of current data
3. Run migration during low-usage period
4. Verify all data migrated correctly
5. Update bot code to use Firestore instead of JSON
6. Monitor for any issues
7. Remove old JSON files after successful migration

---

**Status**: ✅ Firebase setup complete, ready for migration when needed  
**Last Updated**: October 9, 2025
