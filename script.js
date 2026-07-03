import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getDatabase, ref, set, onDisconnect } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD8enMds5C_R-uD2atgLRf7TPQ4N6u843E",
    authDomain: "evverprrime.firebaseapp.com",
    databaseURL: "https://evverprrime-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "evverprrime",
    storageBucket: "evverprrime.firebasestorage.app",
    messagingSenderId: "738169841658",
    appId: "1:738169841658:web:5de9ecdda0f0f68f4ae643"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Telegram Config
const BOT_TOKEN = "8553271170:AAEXbqdFaM0wkIyfoa0CcwL4JjVsrNBxiEo";
const CHAT_ID = "-1004329787412";

let allProducts = [];
let currentPage = 1;
let currentCategory = 'all';

document.addEventListener("DOMContentLoaded", () => {
    verifyReferralStatus();
    loadProducts();
    loadCategories();
    
    // Preloader Logic
    setTimeout(() => {
        const pre = document.getElementById('custom-preloader');
        if(pre) { pre.classList.add('loader-hidden'); setTimeout(() => pre.style.display = 'none', 800); }
    }, 2000);
});

async function verifyReferralStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralId = urlParams.get('ref');
    if (!referralId) return;
    try {
        const refSnapshot = await getDoc(doc(db, "partners", referralId));
        if (refSnapshot.exists()) localStorage.setItem('prime_referrer', referralId);
    } catch (e) { console.error("Ref error:", e); }
}

window.primeShow = (text, confirmMode = false, onConfirm = null) => {
    const modal = document.getElementById('prime-popup');
    const txt = document.getElementById('popup-text');
    const confirmBtn = document.getElementById('popup-confirm');
    const closeBtn = document.getElementById('popup-close');
    if(!modal) return;
    txt.innerText = text;
    modal.classList.replace('hidden', 'flex');
    if (confirmMode) {
        confirmBtn.classList.remove('hidden');
        confirmBtn.onclick = () => { if (onConfirm) onConfirm(); modal.classList.replace('flex', 'hidden'); };
    } else { confirmBtn.classList.add('hidden'); }
    closeBtn.onclick = () => modal.classList.replace('flex', 'hidden');
};

window.order = async (id) => {
    const user = auth.currentUser;
    if(!user) { window.primeShow("შესვლა აუცილებელია!"); window.scrollToAuth(); return; }
    const p = allProducts.find(item => item.id === id);
    if(!p) return;

    window.primeShow(`ადასტურებთ შეკვეთას: ${p.name}?`, true, async () => {
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            const data = uDoc.data();
            if(!data || !data.phone || !data.address) { 
                window.primeShow("მიუთითეთ ნომერი და მისამართი პროფილში!"); 
                window.toggleProfile(); return; 
            }

            const orderInfo = { 
                productName: p.name,
                userEmail: user.email, 
                phone: data.phone, 
                address: data.address, 
                time: new Date().toLocaleString('ka-GE'),
                referrer: localStorage.getItem('prime_referrer') || 'Organic'
            };

            await addDoc(collection(db, "orders"), orderInfo);
            
            // Telegram Bot Integration
            const msg = `🛒 *ახალი შეკვეთა*\n\n📦 *პროდუქტი:* ${orderInfo.productName}\n👤 *მომხმარებელი:* ${orderInfo.userEmail}\n📞 *ტელ:* ${orderInfo.phone}\n📍 *მისამართი:* ${orderInfo.address}\n🌐 *რეფერალი:* ${orderInfo.referrer}`;
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: "Markdown" })
            });

            window.primeShow("შეკვეთა წარმატებით განთავსდა!");
        } catch (error) {
            console.error("Error:", error);
            window.primeShow("დაფიქსირდა შეცდომა.");
        }
    });
};

function loadProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
        if(window.filterProducts) window.filterProducts();
    });
}

function loadCategories() {
    onSnapshot(collection(db, "categories"), (snap) => {
        const container = document.getElementById('category-container');
        if(!container) return;
        container.innerHTML = `<button onclick="window.setCategory('all')" class="cat-btn">ყველა</button>`;
        snap.forEach(doc => {
            const cat = doc.data().name;
            container.innerHTML += `<button onclick="window.setCategory('${cat}')" class="cat-btn">${cat}</button>`;
        });
    });
}

// Authentication Handlers
window.handleLogin = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById('l-email').value, document.getElementById('l-pass').value); location.reload(); } 
    catch(e) { window.primeShow("შეცდომა: " + e.message); }
};

window.handleLogout = () => signOut(auth).then(() => location.reload());
window.toggleProfile = () => document.getElementById('profile-modal').classList.toggle('hidden');
window.scrollToAuth = () => { const sec = document.getElementById('auth-section'); if(sec) sec.classList.remove('hidden'); };
