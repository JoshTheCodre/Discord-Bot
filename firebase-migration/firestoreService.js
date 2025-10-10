const { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp
} = require('firebase/firestore');
const { db } = require('./firebase');

/**
 * Firebase Firestore Service
 * Handles all Firestore database operations for the Discord bot
 * Database: sm-discord-bot-db
 */
class FirestoreService {
  constructor() {
    this.db = db;
    this.collections = {
      users: 'users',
      channels: 'channels', 
      tasks: 'tasks',
      reminders: 'reminders',
      performance: 'performance',
      settings: 'settings'
    };
  }

  // === USERS COLLECTION ===
  async createUser(userId, userData) {
    try {
      const userRef = doc(this.db, this.collections.users, userId);
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, userId };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUser(userId) {
    try {
      const userRef = doc(this.db, this.collections.users, userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async updateUser(userId, updateData) {
    try {
      const userRef = doc(this.db, this.collections.users, userId);
      await updateDoc(userRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const usersRef = collection(this.db, this.collections.users);
      const snapshot = await getDocs(usersRef);
      const users = [];
      
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      
      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  // === CHANNELS COLLECTION ===
  async createChannel(channelId, channelData) {
    try {
      const channelRef = doc(this.db, this.collections.channels, channelId);
      await setDoc(channelRef, {
        ...channelData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, channelId };
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  }

  async getChannel(channelId) {
    try {
      const channelRef = doc(this.db, this.collections.channels, channelId);
      const channelSnap = await getDoc(channelRef);
      
      if (channelSnap.exists()) {
        return { id: channelSnap.id, ...channelSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting channel:', error);
      throw error;
    }
  }

  async getAllChannels() {
    try {
      const channelsRef = collection(this.db, this.collections.channels);
      const snapshot = await getDocs(channelsRef);
      const channels = [];
      
      snapshot.forEach((doc) => {
        channels.push({ id: doc.id, ...doc.data() });
      });
      
      return channels;
    } catch (error) {
      console.error('Error getting all channels:', error);
      throw error;
    }
  }

  // === TASKS COLLECTION ===
  async createTask(taskData) {
    try {
      const tasksRef = collection(this.db, this.collections.tasks);
      const docRef = await addDoc(tasksRef, {
        ...taskData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, taskId: docRef.id };
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async getTask(taskId) {
    try {
      const taskRef = doc(this.db, this.collections.tasks, taskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        return { id: taskSnap.id, ...taskSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting task:', error);
      throw error;
    }
  }

  async getUserTasks(userId) {
    try {
      const tasksRef = collection(this.db, this.collections.tasks);
      const q = query(tasksRef, where('assignedTo', '==', userId));
      const snapshot = await getDocs(q);
      const tasks = [];
      
      snapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() });
      });
      
      return tasks;
    } catch (error) {
      console.error('Error getting user tasks:', error);
      throw error;
    }
  }

  async updateTask(taskId, updateData) {
    try {
      const taskRef = doc(this.db, this.collections.tasks, taskId);
      await updateDoc(taskRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  // === PERFORMANCE COLLECTION ===
  async recordPerformance(userId, performanceData) {
    try {
      const performanceRef = collection(this.db, this.collections.performance);
      const docRef = await addDoc(performanceRef, {
        userId,
        ...performanceData,
        timestamp: serverTimestamp()
      });
      return { success: true, recordId: docRef.id };
    } catch (error) {
      console.error('Error recording performance:', error);
      throw error;
    }
  }

  async getUserPerformance(userId, startDate = null, endDate = null) {
    try {
      const performanceRef = collection(this.db, this.collections.performance);
      let q = query(performanceRef, where('userId', '==', userId));
      
      if (startDate && endDate) {
        q = query(q, 
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          where('timestamp', '<=', Timestamp.fromDate(endDate))
        );
      }
      
      const snapshot = await getDocs(q);
      const performance = [];
      
      snapshot.forEach((doc) => {
        performance.push({ id: doc.id, ...doc.data() });
      });
      
      return performance;
    } catch (error) {
      console.error('Error getting user performance:', error);
      throw error;
    }
  }

  // === SETTINGS COLLECTION ===
  async getSetting(key) {
    try {
      const settingRef = doc(this.db, this.collections.settings, key);
      const settingSnap = await getDoc(settingRef);
      
      if (settingSnap.exists()) {
        return settingSnap.data().value;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  }

  async setSetting(key, value) {
    try {
      const settingRef = doc(this.db, this.collections.settings, key);
      await setDoc(settingRef, {
        value,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error setting value:', error);
      throw error;
    }
  }

  // === UTILITY METHODS ===
  async deleteDocument(collectionName, documentId) {
    try {
      const docRef = doc(this.db, collectionName, documentId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Real-time listener for collection changes
  subscribeToCollection(collectionName, callback, queryConstraints = []) {
    try {
      const collectionRef = collection(this.db, collectionName);
      const q = queryConstraints.length > 0 ? query(collectionRef, ...queryConstraints) : collectionRef;
      
      return onSnapshot(q, (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        callback(data);
      });
    } catch (error) {
      console.error('Error setting up real-time listener:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new FirestoreService();
