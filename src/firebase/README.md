# Firebase Integration

This folder contains all Firebase-related functionality for the Discord Bot.

## Files:

### `firestoreService.js`
- **Purpose**: Core Firebase Firestore operations
- **Functions**: 
  - `createTask(taskData)` - Create new task in Firestore
  - `getTask(taskId)` - Get task by ID
  - `getAllTasks()` - Get all tasks
  - `updateTask(taskId, data)` - Update existing task
  - `createUser(userData)` - Create new user
  - `getUser(userId)` - Get user by ID
  - `getAllUsers()` - Get all users
  - `createChannel(channelData)` - Create new channel
  - `getChannel(channelId)` - Get channel by ID
  - `updateChannel(channelId, data)` - Update existing channel
  - `getAllChannels()` - Get all channels

### `firebase.js`
- **Purpose**: Firebase configuration and initialization
- **Exports**: Firebase app, Firestore database, Auth
- **Status**: Currently unused (configuration moved inline to firestoreService)

## Usage:

```javascript
const { createTask, getTask } = require('./src/firebase/firestoreService');

// Create a task
const taskId = await createTask({
  taskId: 'ABC123',
  movieName: 'Example Movie',
  assignedTo: 'userId'
});

// Get a task
const task = await getTask(taskId);
```

## Integration:

- **Primary Integration**: `src/services/storage.js` imports and uses these functions
- **Auto-Sync**: New tasks/users/channels are automatically synced to Firestore
- **Fallback**: If Firebase is unavailable, bot continues with JSON storage only
