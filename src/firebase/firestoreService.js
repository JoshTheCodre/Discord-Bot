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
  runTransaction,
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
  subtasks: 'subtasks',
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

function normalizeUserData(userData = {}) {
  const normalized = { ...userData };
  if (!normalized.id && normalized.discordId) {
    normalized.id = String(normalized.discordId);
  }
  if (!normalized.discordId && normalized.id) {
    normalized.discordId = String(normalized.id);
  }
  return normalized;
}

function getCanonicalUserDocId(userData = {}) {
  const normalized = normalizeUserData(userData);
  const stableId = normalized.id || normalized.discordId || normalized.userId;
  if (stableId) {
    return sanitizeDocId(String(stableId));
  }
  return sanitizeDocId(normalized.name || normalized.discordUsername || normalized.username);
}

function normalizeTextKey(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .replace(/[*_~`]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeSubtaskForWrite(subtask = {}) {
  const normalized = { ...subtask };
  const sourceTitle = normalized.title || normalized.subTaskID || '';

  if (!normalized.title && normalized.subTaskID) {
    normalized.title = String(normalized.subTaskID);
  }

  if (!normalized.subTaskID && normalized.title) {
    normalized.subTaskID = String(normalized.title);
  }

  normalized.titleKey = normalizeTextKey(sourceTitle);

  if (normalized.posted === undefined) {
    normalized.posted = false;
  }

  if (!normalized.status) {
    normalized.status = 'pending';
  }

  return normalized;
}

function normalizeTaskForWrite(taskData = {}) {
  const normalized = { ...taskData };
  normalized.titleKey = normalizeTextKey(normalized.title || normalized.taskId || normalized.id || '');

  if (Array.isArray(normalized.subTasks)) {
    normalized.subTasks = normalized.subTasks.map((subtask) => normalizeSubtaskForWrite(subtask));
  }

  return normalized;
}

function findSubtaskIndex(subTasks = [], subtaskIdentifier) {
  const identifierKey = normalizeTextKey(subtaskIdentifier);
  if (!Array.isArray(subTasks)) {
    return -1;
  }

  return subTasks.findIndex((subtask) => {
    const titleKey = subtask.titleKey || normalizeTextKey(subtask.title || subtask.subTaskID);
    const idText = String(subtask.subTaskID || '').trim();
    const titleText = String(subtask.title || '').trim();
    const identifierText = String(subtaskIdentifier || '').trim();

    return titleKey === identifierKey || idText === identifierText || titleText === identifierText;
  });
}

function calculateTaskStatus(subTasks = []) {
  const hasSubtasks = Array.isArray(subTasks) && subTasks.length > 0;
  if (!hasSubtasks) {
    return 'pending';
  }

  const allCompleted = subTasks.every((subtask) => subtask.status === 'completed');
  return allCompleted ? 'completed' : 'pending';
}

async function getTaskDocRefByIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    return null;
  }

  const directRef = doc(db, collections.tasks, sanitizeDocId(normalizedIdentifier));
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    return directRef;
  }

  const tasksRef = collection(db, collections.tasks);

  let result = await getDocs(query(tasksRef, where('taskId', '==', normalizedIdentifier), limit(1)));
  if (!result.empty) {
    return result.docs[0].ref;
  }

  result = await getDocs(query(tasksRef, where('title', '==', normalizedIdentifier), limit(1)));
  if (!result.empty) {
    return result.docs[0].ref;
  }

  result = await getDocs(query(tasksRef, where('titleKey', '==', normalizeTextKey(normalizedIdentifier)), limit(1)));
  if (!result.empty) {
    return result.docs[0].ref;
  }

  return null;
}

function buildSubtaskDocId(taskIdentifier, subtask, duplicateIndex = 0) {
  const taskPart = sanitizeDocId(taskIdentifier || 'task') || 'task';
  const subtaskPart = sanitizeDocId(subtask?.subTaskID || subtask?.title || subtask?.titleKey || 'subtask') || 'subtask';
  return duplicateIndex > 0
    ? `${taskPart}__${subtaskPart}__${duplicateIndex}`
    : `${taskPart}__${subtaskPart}`;
}

function toSubtaskDocData(taskData = {}, subtask = {}, subtaskIndex = 0) {
  const normalizedSubtask = normalizeSubtaskForWrite(subtask);
  return {
    taskId: taskData.taskId || taskData.id,
    taskDocId: taskData.id || sanitizeDocId(taskData.title) || taskData.taskId,
    assignedTo: taskData.assignedTo || null,
    dueDate: taskData.dueDate || null,
    taskStatus: taskData.status || 'pending',
    movieName: taskData.movieName || null,
    style: taskData.style || null,
    subTaskID: normalizedSubtask.subTaskID,
    title: normalizedSubtask.title,
    titleKey: normalizedSubtask.titleKey,
    status: normalizedSubtask.status,
    posted: normalizedSubtask.posted === true,
    completedAt: normalizedSubtask.completedAt || null,
    postedBy: normalizedSubtask.postedBy || null,
    postedAt: normalizedSubtask.postedAt || null,
    copyrightIssue: normalizedSubtask.copyrightIssue === true,
    copyrightNote: normalizedSubtask.copyrightNote || null,
    copyrightReportedBy: normalizedSubtask.copyrightReportedBy || null,
    copyrightReportedAt: normalizedSubtask.copyrightReportedAt || null,
    subtaskIndex,
    updatedAt: new Date()
  };
}

async function syncTaskSubtasks(taskData = {}) {
  const taskId = taskData.taskId || taskData.id;
  if (!taskId) {
    return;
  }

  const normalizedTask = normalizeTaskForWrite(taskData);
  const nextSubtasks = Array.isArray(normalizedTask.subTasks) ? normalizedTask.subTasks : [];

  const subtasksRef = collection(db, collections.subtasks);
  const existingSnapshot = await getDocs(query(subtasksRef, where('taskId', '==', taskId)));
  const existingByDocId = new Map();
  existingSnapshot.forEach((subtaskDoc) => {
    existingByDocId.set(subtaskDoc.id, subtaskDoc.ref);
  });

  const seenDocIds = new Set();
  const duplicateCounters = new Map();

  for (let index = 0; index < nextSubtasks.length; index += 1) {
    const subtask = normalizeSubtaskForWrite(nextSubtasks[index]);
    const baseId = buildSubtaskDocId(taskId, subtask);
    const duplicateCount = duplicateCounters.get(baseId) || 0;
    duplicateCounters.set(baseId, duplicateCount + 1);

    const subtaskDocId = duplicateCount > 0
      ? buildSubtaskDocId(taskId, subtask, duplicateCount)
      : baseId;

    const subtaskRef = doc(db, collections.subtasks, subtaskDocId);
    seenDocIds.add(subtaskDocId);

    await setDoc(subtaskRef, toSubtaskDocData(normalizedTask, subtask, index), { merge: true });
  }

  for (const [existingDocId, existingRef] of existingByDocId.entries()) {
    if (!seenDocIds.has(existingDocId)) {
      await deleteDoc(existingRef);
    }
  }

  return {
    taskId,
    syncedCount: seenDocIds.size,
    removedCount: Math.max(0, existingByDocId.size - seenDocIds.size)
  };
}

async function backfillSubtasksCollection() {
  const tasks = await getAllTasks();
  let syncedTasks = 0;
  let syncedSubtasks = 0;
  let removedSubtasks = 0;

  for (const task of tasks) {
    const result = await syncTaskSubtasks(task);
    if (result) {
      syncedTasks += 1;
      syncedSubtasks += result.syncedCount || 0;
      removedSubtasks += result.removedCount || 0;
    }
  }

  return {
    totalTasks: tasks.length,
    syncedTasks,
    syncedSubtasks,
    removedSubtasks
  };
}

async function getSubtaskByTitle(title) {
  const titleKey = normalizeTextKey(title);
  if (!titleKey) {
    return null;
  }

  const subtasksRef = collection(db, collections.subtasks);
  const snapshot = await getDocs(query(subtasksRef, where('titleKey', '==', titleKey), limit(1)));
  if (snapshot.empty) {
    return null;
  }

  const subtaskDoc = snapshot.docs[0];
  return { id: subtaskDoc.id, ...subtaskDoc.data() };
}

// === TASK FUNCTIONS ===
async function createTask(taskData) {
  try {
    const normalizedTaskData = normalizeTaskForWrite(taskData);
    // Use title as document ID (sanitized)
    const docId = sanitizeDocId(normalizedTaskData.title) || normalizedTaskData.taskId;
    
    if (!docId) {
      throw new Error('Task must have a title or taskId');
    }
    
    const taskRef = doc(db, collections.tasks, docId);
    await setDoc(taskRef, {
      ...normalizedTaskData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await syncTaskSubtasks({ ...normalizedTaskData, id: docId, taskId: normalizedTaskData.taskId || docId });
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
        return normalizeTaskForWrite({ id: taskSnap.id, ...taskSnap.data() });
      }
    }
    
    // If not found, search by title field
    const tasksRef = collection(db, collections.tasks);
    let q = query(tasksRef, where('title', '==', identifier), limit(1));
    let querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return normalizeTaskForWrite({ id: docSnap.id, ...docSnap.data() });
    }
    
    // Also try searching by taskId field for backwards compatibility
    q = query(tasksRef, where('taskId', '==', identifier), limit(1));
    querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return normalizeTaskForWrite({ id: docSnap.id, ...docSnap.data() });
    }

    q = query(tasksRef, where('titleKey', '==', normalizeTextKey(identifier)), limit(1));
    querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return normalizeTaskForWrite({ id: docSnap.id, ...docSnap.data() });
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
      tasks.push(normalizeTaskForWrite({ id: doc.id, ...doc.data() }));
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
    const normalizedUpdateData = normalizeTaskForWrite(updateData);
    await updateDoc(taskRef, {
      ...normalizedUpdateData,
      updatedAt: new Date()
    });
    await syncTaskSubtasks({ ...existingTask, ...normalizedUpdateData, id: existingTask.id, taskId: existingTask.taskId || existingTask.id });
    console.log('✅ Task updated in Firestore:', existingTask.id);
    return true;
  } catch (error) {
    console.error('❌ Error updating task:', error);
    throw error;
  }
}

async function findTaskBySubtaskTitle(subtaskTitle) {
  const normalizedSubtaskKey = normalizeTextKey(subtaskTitle);
  if (!normalizedSubtaskKey) {
    return null;
  }

  const subtaskRecord = await getSubtaskByTitle(normalizedSubtaskKey);
  if (subtaskRecord) {
    const task = await getTask(subtaskRecord.taskId || subtaskRecord.taskDocId);
    if (task && Array.isArray(task.subTasks)) {
      const subtaskIndex = findSubtaskIndex(task.subTasks, normalizedSubtaskKey);
      if (subtaskIndex !== -1) {
        return {
          task,
          subtask: task.subTasks[subtaskIndex],
          subtaskIndex,
          taskGroup: task.taskId
        };
      }
    }
  }

  const tasks = await getAllTasks();

  for (const task of tasks) {
    if (!Array.isArray(task.subTasks) || task.subTasks.length === 0) {
      continue;
    }

    const subtaskIndex = findSubtaskIndex(task.subTasks, normalizedSubtaskKey);
    if (subtaskIndex === -1) {
      continue;
    }

    const subtask = task.subTasks[subtaskIndex];
    return {
      task,
      subtask,
      subtaskIndex,
      taskGroup: task.taskId
    };
  }

  return null;
}

async function patchSubtaskAtomic(taskIdentifier, subtaskIdentifier, patchData = {}) {
  try {
    const taskRef = await getTaskDocRefByIdentifier(taskIdentifier);
    if (!taskRef) {
      return { success: false, reason: 'task_not_found' };
    }

    const transactionResult = await runTransaction(db, async (transaction) => {
      const taskSnap = await transaction.get(taskRef);
      if (!taskSnap.exists()) {
        return { success: false, reason: 'task_not_found' };
      }

      const taskData = normalizeTaskForWrite({ id: taskSnap.id, ...taskSnap.data() });
      const subTasks = Array.isArray(taskData.subTasks) ? [...taskData.subTasks] : [];
      const subtaskIndex = findSubtaskIndex(subTasks, subtaskIdentifier);

      if (subtaskIndex === -1) {
        return { success: false, reason: 'subtask_not_found' };
      }

      const existingSubtask = normalizeSubtaskForWrite(subTasks[subtaskIndex]);
      const updatedSubtask = normalizeSubtaskForWrite({
        ...existingSubtask,
        ...patchData
      });

      subTasks[subtaskIndex] = updatedSubtask;

      const nextTaskStatus = calculateTaskStatus(subTasks);
      const taskIdentity = taskData.taskId || taskData.id;
      const subtaskDocRef = doc(db, collections.subtasks, buildSubtaskDocId(taskIdentity, updatedSubtask));

      transaction.update(taskRef, {
        subTasks,
        status: nextTaskStatus,
        updatedAt: new Date()
      });

      transaction.set(subtaskDocRef, toSubtaskDocData({ ...taskData, status: nextTaskStatus, taskId: taskIdentity }, updatedSubtask, subtaskIndex), { merge: true });

      return {
        success: true,
        taskId: taskIdentity,
        subtask: updatedSubtask
      };
    });

    return transactionResult;
  } catch (error) {
    console.error('❌ Error patching subtask atomically:', error);
    return { success: false, reason: 'error', error };
  }
}

async function patchSubtaskByTitleAtomic(subtaskTitle, patchData = {}) {
  const located = await findTaskBySubtaskTitle(subtaskTitle);
  if (!located) {
    return { success: false, reason: 'subtask_not_found' };
  }

  return patchSubtaskAtomic(located.task.id || located.task.taskId, subtaskTitle, patchData);
}

// === USER FUNCTIONS ===
async function createUser(userData) {
  try {
    const normalizedUserData = normalizeUserData(userData);
    const docId = getCanonicalUserDocId(normalizedUserData);
    
    if (!docId) {
      throw new Error('User must have an id/discordId or name');
    }
    
    const userRef = doc(db, collections.users, docId);
    await setDoc(userRef, {
      ...normalizedUserData,
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
    if (!identifier) {
      return null;
    }

    const normalizedIdentifier = String(identifier);

    // First try to get by sanitized name (document ID)
    const sanitizedId = sanitizeDocId(normalizedIdentifier);
    if (sanitizedId) {
      const userRef = doc(db, collections.users, sanitizedId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return normalizeUserData({ id: userSnap.id, ...userSnap.data() });
      }
    }

    // If not found, search by id field
    const usersRef = collection(db, collections.users);
    let q = query(usersRef, where('id', '==', normalizedIdentifier), limit(1));
    let querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return normalizeUserData({ id: docSnap.id, ...docSnap.data() });
    }

    // Also try searching by discordId field
    q = query(usersRef, where('discordId', '==', normalizedIdentifier), limit(1));
    querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return normalizeUserData({ id: docSnap.id, ...docSnap.data() });
    }

    // Finally search by name field for backwards compatibility
    q = query(usersRef, where('name', '==', normalizedIdentifier), limit(1));
    querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return normalizeUserData({ id: docSnap.id, ...docSnap.data() });
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
      users.push(normalizeUserData({ id: doc.id, ...doc.data() }));
    });
    
    return users;
  } catch (error) {
    console.error('❌ Error getting all users:', error);
    throw error;
  }
}

function getUserQualityScore(user) {
  const preferredFields = [
    'id',
    'discordId',
    'name',
    'birthday',
    'role',
    'dateJoined',
    'setupCompletedAt',
    'discordUsername'
  ];

  return preferredFields.reduce((score, field) => {
    if (user[field] !== undefined && user[field] !== null && user[field] !== '') {
      return score + 1;
    }
    return score;
  }, 0);
}

async function dedupeUsers() {
  try {
    const usersRef = collection(db, collections.users);
    const snapshot = await getDocs(usersRef);

    const allUsers = snapshot.docs.map((document) => {
      const data = normalizeUserData({ id: document.id, ...document.data() });
      return {
        docId: document.id,
        ...data
      };
    });

    const groups = new Map();

    allUsers.forEach((user) => {
      const stableId = (user.id || user.discordId || '').toString().trim();
      const nameKey = (user.name || '').toString().trim().toLowerCase();
      const groupKey = stableId ? `id:${stableId}` : (nameKey ? `name:${nameKey}` : `doc:${user.docId}`);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(user);
    });

    let duplicateGroups = 0;
    let removedCount = 0;
    const removedDocIds = [];

    for (const [, groupedUsers] of groups.entries()) {
      if (groupedUsers.length <= 1) {
        continue;
      }

      duplicateGroups += 1;

      groupedUsers.sort((first, second) => {
        return getUserQualityScore(second) - getUserQualityScore(first);
      });

      const primary = groupedUsers[0];
      const duplicates = groupedUsers.slice(1);

      const mergedData = { ...primary };
      delete mergedData.docId;

      duplicates.forEach((duplicate) => {
        Object.entries(duplicate).forEach(([key, value]) => {
          if (key === 'docId' || key === 'id') {
            return;
          }
          if ((mergedData[key] === undefined || mergedData[key] === null || mergedData[key] === '') && value !== undefined && value !== null && value !== '') {
            mergedData[key] = value;
          }
        });
      });

      const canonicalId = getCanonicalUserDocId(mergedData) || primary.docId;
      const canonicalRef = doc(db, collections.users, canonicalId);

      await setDoc(canonicalRef, {
        ...normalizeUserData(mergedData),
        updatedAt: new Date()
      }, { merge: true });

      if (primary.docId !== canonicalId) {
        await deleteDoc(doc(db, collections.users, primary.docId));
        removedDocIds.push(primary.docId);
        removedCount += 1;
      }

      for (const duplicate of duplicates) {
        if (duplicate.docId === canonicalId) {
          continue;
        }

        await deleteDoc(doc(db, collections.users, duplicate.docId));
        removedDocIds.push(duplicate.docId);
        removedCount += 1;
      }
    }

    return {
      totalUsers: allUsers.length,
      duplicateGroups,
      removedCount,
      removedDocIds
    };
  } catch (error) {
    console.error('❌ Error deduplicating users:', error);
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

// === LOG FUNCTIONS ===

const LOG_CATEGORIES = {
  task_assigned:    'assignment',
  task_created:     'assignment',
  task_completed:   'completion',
  subtask_completed:'completion',
  subtask_submitted:'completion',
  approval:         'completion',
  copyright_flagged:'copyright',
  copyright_resolved:'copyright',
  user_created:     'user',
  user_auto_created:'user',
  reminder_sent:    'reminder',
  dm_sent:          'system',
  dm_failed:        'system',
  error:            'system',
};

async function createLog(logData) {
  try {
    const logsRef = collection(db, 'logs');
    await addDoc(logsRef, {
      type:         logData.type     || 'system',
      category:     LOG_CATEGORIES[logData.type] || 'system',
      message:      logData.message  || '',
      taskId:       logData.taskId   || null,
      userId:       logData.userId   || null,
      username:     logData.username || null,
      subtaskTitle: logData.subtaskTitle || null,
      metadata:     logData.metadata || null,
      timestamp:    new Date()
    });
  } catch (error) {
    console.error('❌ Error writing log:', error);
  }
}

async function getLogs({ category, limitCount = 300 } = {}) {
  try {
    const logsRef = collection(db, 'logs');
    let q;
    if (category && category !== 'all') {
      q = query(logsRef, where('category', '==', category), orderBy('timestamp', 'desc'), limit(limitCount));
    } else {
      q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : (data.timestamp || null)
      };
    });
  } catch (error) {
    console.error('❌ Error getting logs:', error);
    return [];
  }
}

// === ADMIN AUTH FUNCTIONS ===

async function getAdminByEmail(email) {
  try {
    const adminRef = doc(db, 'admins', email.toLowerCase().trim());
    const snap = await getDoc(adminRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error('❌ Error getting admin:', error);
    throw error;
  }
}

async function ensureDefaultAdmin(bcrypt) {
  try {
    const email = 'admin@gmail.com';
    const adminRef = doc(db, 'admins', email);
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      const hash = await bcrypt.hash('admin', 10);
      await setDoc(adminRef, {
        email,
        passwordHash: hash,
        name: 'Admin',
        createdAt: new Date()
      });
      console.log('✅ Default admin account created');
    }
  } catch (error) {
    console.error('❌ Error ensuring default admin:', error);
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
  backfillSubtasksCollection,
  getSubtaskByTitle,
  normalizeTextKey,
  findTaskBySubtaskTitle,
  patchSubtaskAtomic,
  patchSubtaskByTitleAtomic,
  createUser,
  getUser,
  getAllUsers,
  dedupeUsers,
  createChannel,
  getChannel,
  updateChannel,
  getAllChannels,
  getAdminByEmail,
  ensureDefaultAdmin,
  createLog,
  getLogs
};
