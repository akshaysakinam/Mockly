// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBl6O7BPchbebogJgYElrkOwUUpdvxWEdQ",
  authDomain: "mockly-a4b1f.firebaseapp.com",
  projectId: "mockly-a4b1f",
  storageBucket: "mockly-a4b1f.firebasestorage.app",
  messagingSenderId: "218308586943",
  appId: "1:218308586943:web:ec77e13926dedb7d2d450a",
  measurementId: "G-P9DV1ET06E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
