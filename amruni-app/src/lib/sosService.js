import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from './firebase';

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Emergency Contacts
export async function addContact(contact, userId) {
  const path = 'contacts';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...contact,
      userId,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, 'write', path);
  }
}

export async function getContacts(userId) {
  const path = 'contacts';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    handleFirestoreError(e, 'list', path);
  }
}

export async function deleteContact(contactId) {
  const path = 'contacts';
  try {
    await deleteDoc(doc(db, path, contactId));
  } catch (e) {
    handleFirestoreError(e, 'delete', path);
  }
}

// Alerts History
export async function saveAlert(alert, userId) {
  const path = 'alerts';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...alert,
      userId,
      timestamp: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, 'write', path);
  }
}

export async function getAlerts(userId) {
  const path = 'alerts';
  try {
    const q = query(collection(db, path), where('userId', '==', userId), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    handleFirestoreError(e, 'list', path);
  }
}
