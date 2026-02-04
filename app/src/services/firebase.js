// Firebase configuration for LOOPIA
// Note: Replace these values with your actual Firebase project config
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration
// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'your-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abc123',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

// Upload video to Firebase Storage
export async function uploadVideo(file, onProgress) {
  const timestamp = Date.now();
  const filename = `uploads/${timestamp}_${file.name}`;
  const storageRef = ref(storage, filename);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(progress);
        }
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url: downloadURL,
            path: filename,
            filename: file.name,
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

// Delete video from Firebase Storage
export async function deleteVideo(path) {
  const storageRef = ref(storage, path);
  try {
    await deleteObject(storageRef);
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

// Log usage data (minimal analytics)
export async function logUsage(data) {
  try {
    await addDoc(collection(db, 'usage'), {
      ...data,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Log error:', error);
  }
}

// Download URL for completed video
export async function getVideoDownloadURL(path) {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

export { storage, db };
