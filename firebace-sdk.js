import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

window.FB = {
  initializeApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, query, orderBy, limit
};
