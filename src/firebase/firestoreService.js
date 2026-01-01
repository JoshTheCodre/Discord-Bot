// Simple Firestore Service
const { initializeApp } = require('firebase/app');
const { 
  getFirestore,
  collection, 
  doc, 
  setDoc,
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

// Helper function to sanitize title for use as document ID
function sanitizeDocId(title) {
  if (!title) return null;
  // Replace invalid characters and limit length
  return title
    .toString()
    .trim()
    .replace(/[\/.#$\[\]]/g, '_') // Replace Firestore invalid chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 100); // Limit length
}

// === TASK FUNCTIONS ===
async function createTask(taskData) {
  try {
    // Use title as document ID (sanitized)
    const docId = sanitizeDocId(taskData.title) || taskData.taskId;
    
    if (!docId) {
      throw new Error('Task must have a title or taskId');
    }
    
    const taskRef = doc(db, collections.tasks, docId);
    await setDoc(taskRef, {
      ...taskData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Task created in Firestore with ID:', docId);
    return docId;
  } catch (error) {
    console.error('❌ Error creating task:', error);
    throw error;
  }
}

async function getTask(identifier) {
  try {
    // First try to get by sanitized title (document ID)
    const sanitizedId = sanitizeDocId(identifier);
    if (sanitizedId) {
      const taskRef = doc(db, collections.tasks, sanitizedId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        return { id: taskSnap.id, ...taskSnap.data() };
      }
    }
    
    // If not found, search by title field
    const tasksRef = collection(db, collections.tasks);
    let q = query(tasksRef, where('title', '==', identifier), limit(1));
    let querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    
    // Also try searching by taskId field for backwards compatibility
    q = query(tasksRef, where('taskId', '==', identifier), limit(1));
    querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
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

async function updateTask(identifier, updateData) {
  try {
    // First try to find the task to get its actual document ID
    const existingTask = await getTask(identifier);
    
    if (!existingTask) {
      throw new Error(`Task not found: ${identifier}`);
    }
    
    const taskRef = doc(db, collections.tasks, existingTask.id);
    await updateDoc(taskRef, {
      ...updateData,
      updatedAt: new Date()
    });
    console.log('✅ Task updated in Firestore:', existingTask.id);
    return true;
  } catch (error) {
    console.error('❌ Error updating task:', error);
    throw error;
  }
}

// === USER FUNCTIONS ===
async function createUser(userData) {
  try {
    // Use name as document ID (sanitized)
    const docId = sanitizeDocId(userData.name) || userData.id;
    
    if (!docId) {
      throw new Error('User must have a name or id');
    }
    
    const userRef = doc(db, collections.users, docId);
    await setDoc(userRef, {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ User created in Firestore with ID:', docId);
    return docId;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

async function getUser(identifier) {
  try {
    // First try to get by sanitized name (document ID)
    const sanitizedId = sanitizeDocId(identifier);
    if (sanitizedId) {
      const userRef = doc(db, collections.users, sanitizedId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() };
      }
    }
    
    // If not found, search by name field
    const usersRef = collection(db, collections.users);
    let q = query(usersRef, where('name', '==', identifier), limit(1));
    let querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    
    // Also try searching by Discord user ID for backwards compatibility
    q = query(usersRef, where('id', '==', identifier), limit(1));
    querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
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
    // Use channel name as document ID (sanitized)
    const docId = sanitizeDocId(channelData.name);
    
    if (!docId) {
      throw new Error('Channel must have a name');
    }
    
    const channelRef = doc(db, collections.channels, docId);
    await setDoc(channelRef, {
      ...channelData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Channel created in Firestore with ID:', docId);
    return docId;
  } catch (error) {
    console.error('❌ Error creating channel:', error);
    throw error;
  }
}

async function getChannel(channelName) {
  try {
    // First try to get by sanitized name (document ID)
    const sanitizedId = sanitizeDocId(channelName);
    if (sanitizedId) {
      const channelRef = doc(db, collections.channels, sanitizedId);
      const channelSnap = await getDoc(channelRef);
      
      if (channelSnap.exists()) {
        return { id: channelSnap.id, ...channelSnap.data() };
      }
    }
    
    // If not found, search by name field
    const channelsRef = collection(db, collections.channels);
    const q = query(channelsRef, where('name', '==', channelName), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting channel:', error);
    throw error;
  }
}

async function updateChannel(identifier, updateData) {
  try {
    // First try to find the channel to get its actual document ID
    const existingChannel = await getChannel(identifier);
    
    if (!existingChannel) {
      throw new Error(`Channel not found: ${identifier}`);
    }
    
    const channelRef = doc(db, collections.channels, existingChannel.id);
    await updateDoc(channelRef, {
      ...updateData,
      updatedAt: new Date()
    });
    console.log('✅ Channel updated in Firestore:', existingChannel.id);
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
  sanitizeDocId,
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
