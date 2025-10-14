// Simple Firestore Service
const { initializeApp } = require('firebase/app');
const { 
  getFirestore,
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPEMw5tzQ6UpWzB1Femj04f71rIx2qETk",
  authDomain: "solomaxstudios-246c0.firebaseapp.com",
  projectId: "solomaxstudios-246c0",
  storageBucket: "solomaxstudios-246c0.firebasestorage.app",
  messagingSenderId: "636289372629",
  appId: "1:636289372629:web:f8c37785cb827b6ab8ed5c",
  measurementId: "G-WZ872HZ7N8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = {
  users: 'users',
  channels: 'channels', 
  tasks: 'tasks',
  performance: 'performance',
  settings: 'settings'
};

// === TASK FUNCTIONS ===
async function createTask(taskData) {
  try {
    const tasksRef = collection(db, collections.tasks);
    const docRef = await addDoc(tasksRef, {
      ...taskData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Task created in Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating task:', error);
    throw error;
  }
}

async function getTask(taskId) {
  try {
    // First try to get by document ID
    const taskRef = doc(db, collections.tasks, taskId);
    const taskSnap = await getDoc(taskRef);
    
    if (taskSnap.exists()) {
      return { id: taskSnap.id, ...taskSnap.data() };
    }
    
    // If not found by document ID, search by taskId field
    const tasksRef = collection(db, collections.tasks);
    const q = query(tasksRef, where('taskId', '==', taskId), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting task:', error);
    throw error;
  }
}

async function getAllTasks() {
  try {
    const tasksRef = collection(db, collections.tasks);
    const snapshot = await getDocs(tasksRef);
    const tasks = [];
    
    snapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() });
    });
    
    return tasks;
  } catch (error) {
    console.error('❌ Error getting all tasks:', error);
    throw error;
  }
}

async function updateTask(taskId, updateData) {
  try {
    const taskRef = doc(db, collections.tasks, taskId);
    await updateDoc(taskRef, {
      ...updateData,
      updatedAt: new Date()
    });
    console.log('✅ Task updated in Firestore:', taskId);
    return true;
  } catch (error) {
    console.error('❌ Error updating task:', error);
    throw error;
  }
}

// === USER FUNCTIONS ===
async function createUser(userData) {
  try {
    const usersRef = collection(db, collections.users);
    const docRef = await addDoc(usersRef, {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ User created in Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

async function getUser(userId) {
  try {
    // First try to get by document ID
    const userRef = doc(db, collections.users, userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    }
    
    // If not found by document ID, search by Discord user ID field
    const usersRef = collection(db, collections.users);
    const q = query(usersRef, where('id', '==', userId), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { firestoreId: doc.id, ...doc.data() };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting user:', error);
    throw error;
  }
}

async function getAllUsers() {
  try {
    const usersRef = collection(db, collections.users);
    const snapshot = await getDocs(usersRef);
    const users = [];
    
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    return users;
  } catch (error) {
    console.error('❌ Error getting all users:', error);
    throw error;
  }
}

// === CHANNEL FUNCTIONS ===
async function createChannel(channelData) {
  try {
    const channelsRef = collection(db, collections.channels);
    const docRef = await addDoc(channelsRef, {
      ...channelData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Channel created in Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating channel:', error);
    throw error;
  }
}

async function getChannel(channelName) {
  try {
    // Search by channel name field since channels are identified by name
    const channelsRef = collection(db, collections.channels);
    const q = query(channelsRef, where('name', '==', channelName), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { firestoreId: doc.id, ...doc.data() };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting channel:', error);
    throw error;
  }
}

async function updateChannel(channelId, updateData) {
  try {
    const channelRef = doc(db, collections.channels, channelId);
    await updateDoc(channelRef, {
      ...updateData,
      updatedAt: new Date()
    });
    console.log('✅ Channel updated in Firestore:', channelId);
    return true;
  } catch (error) {
    console.error('❌ Error updating channel:', error);
    throw error;
  }
}

async function getAllChannels() {
  try {
    const channelsRef = collection(db, collections.channels);
    const snapshot = await getDocs(channelsRef);
    const channels = [];
    
    snapshot.forEach((doc) => {
      channels.push({ id: doc.id, ...doc.data() });
    });
    
    return channels;
  } catch (error) {
    console.error('❌ Error getting all channels:', error);
    throw error;
  }
}

// Export functions
console.log('✅ FirestoreService functions loaded successfully');

module.exports = {
  createTask,
  getTask,
  getAllTasks,
  updateTask,
  createUser,
  getUser,
  getAllUsers,
  createChannel,
  getChannel,
  updateChannel,
  getAllChannels
};
