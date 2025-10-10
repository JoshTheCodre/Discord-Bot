# Firebase Migration Module 🔥

This folder contains all Firebase Firestore migration tools and services, separated from the main bot functionality.

## 📁 Contents

- `firebase.js` - Firebase configuration and initialization
- `firestoreService.js` - Complete Firestore database operations
- `migrationService.js` - Migration logic from JSON to Firestore
- `migrationCommands.js` - Command-line migration tools
- `test-firebase.js` - Firebase connection testing
- `FIREBASE_SETUP.md` - Detailed setup documentation
- `FIREBASE_READY.md` - Quick migration reference

## 🚀 Usage

### Test Firebase Connection
```bash
cd firebase-migration
node test-firebase.js
```

### Run Migration Commands
```bash
# From project root
node firebase-migration/migrationCommands.js test
node firebase-migration/migrationCommands.js backup
node firebase-migration/migrationCommands.js migrate
node firebase-migration/migrationCommands.js verify
```

### Individual Migrations
```bash
node firebase-migration/migrationCommands.js users
node firebase-migration/migrationCommands.js channels
node firebase-migration/migrationCommands.js tasks
node firebase-migration/migrationCommands.js performance
```

## 🔗 Firebase Configuration

**Project**: solomaxstudios-246c0  
**Database**: sm-discord-bot-db  
**Console**: https://console.firebase.google.com/project/solomaxstudios-246c0/firestore/databases/sm-discord-bot-db/data

## ⚠️ Important Notes

- This module is **separate** from the main bot functionality
- The main bot continues to use Google Sheets and JSON storage
- Migration is **prepared but not executed**
- All files are self-contained within this folder
- Backups will be created in `../backups/` directory

## 📦 Dependencies

Firebase migration requires the `firebase` package which is already installed in the main project.

---

**Status**: Ready for migration when needed. Main bot functionality unaffected.
