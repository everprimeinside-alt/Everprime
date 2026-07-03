import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getDatabase, ref, set, onDisconnect } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";

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

// გლობალური ცვლადები
let allProducts = [];
let currentPage = 1;
let currentCategory = 'all';

// აპლიკაციის ინიციალიზაცია
document.addEventListener("DOMContentLoaded", () => {
    verifyReferralStatus();
    // Preloader-ის გამორთვა
    setTimeout(() => {
        const pre = document.getElementById('custom-preloader');
        if(pre) {
            pre.style.opacity = '0';
            setTimeout(() => pre.style.display = 'none', 500);
        }
    }, 1000);
});

// რეფერალური სისტემა
async function verifyReferralStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralId = urlParams.get('ref');
    if (!referralId) return;
    try {
        const refSnapshot = await getDoc(doc(db, "partners", referralId));
        if (refSnapshot.exists()) {
            localStorage.setItem('prime_referrer', referralId);
        }
    } catch (e) { console.error(e); }
}

// შეტყობინებების მოდალი
window.primeShow = (text, confirmMode = false, onConfirm = null) => {
    const modal = document.getElementById('prime-popup');
    const txt = document.getElementById('popup-text');
    const confirmBtn = document.getElementById('popup-confirm');
    if(!modal) return;
    txt.innerText = text;
    modal.classList.replace('hidden', 'flex');
    confirmBtn.classList.toggle('hidden', !confirmMode);
    confirmBtn.onclick = () => { if (onConfirm) onConfirm(); modal.classList.replace('flex', 'hidden'); };
    document.getElementById('popup-close').onclick = () => modal.classList.replace('flex', 'hidden');
};

// მომხმარებლის სტატუსის მონიტორინგი
onAuthStateChanged(auth, async (user) => {
    const navUser = document.getElementById('nav-user-area');
    loadProducts();
    loadCategories();
    if (user) {
        const userStatusRef = ref(rtdb, '/online_users/' + user.uid);
        set(userStatusRef, { email: user.email, last_active: Date.now() });
        onDisconnect(userStatusRef).remove();
        if(navUser) navUser.innerHTML = `<button onclick="window.toggleProfile()" class="nav-btn">${user.email.split('@')[0].toUpperCase()}</button>`;
        loadUserProfile(user.uid);
    } else {
        if(navUser) navUser.innerHTML = `<button onclick="window.scrollToAuth()" class="nav-btn">შესვლა</button>`;
    }
});

// პროდუქტების და კატეგორიების ჩატვირთვა
function loadProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        window.filterProducts();
    });
}

function loadCategories() {
    onSnapshot(collection(db, "categories"), (snap) => {
        const container = document.getElementById('category-container');
        if(!container) return;
        let html = `<button onclick="window.setCategory('all')" class="cat-btn ${currentCategory === 'all' ? 'active' : ''}">ყველა</button>`;
        snap.forEach(doc => {
            const cat = doc.data().name;
            html += `<button onclick="window.setCategory('${cat}')" class="cat-btn ${currentCategory === cat ? 'active' : ''}">${cat}</button>`;
        });
        container.innerHTML = html;
    });
}

// ფილტრაცია და რენდერი
window.filterProducts = () => {
    const search = document.getElementById('search-input')?.value.toLowerCase() || "";
    const sort = document.getElementById('sort-select')?.value || "default";
    const grid = document.getElementById('product-grid');
    if(!grid) return;

    let filtered = allProducts.filter(p => (currentCategory === 'all' || p.category === currentCategory) && p.name.toLowerCase().includes(search));
    if(sort === 'low') filtered.sort((a,b) => a.price - b.price);
    else if(sort === 'high') filtered.sort((a,b) => b.price - a.price);

    grid.innerHTML = filtered.map(p => `
        <div class="product-card">
            <img src="${p.images?.[0] || 'logo.jpg'}" class="w-full h-40 object-cover">
            <h3 class="font-bold">${p.name}</h3>
            <p>${p.price} ₾</p>
            <button onclick="window.order('${p.id}')" class="buy-btn">შეკვეთა</button>
        </div>
    `).join('');
};

// შეკვეთის გაგზავნა ტელეგრამზე
window.order = async (id) => {
    const user = auth.currentUser;
    if(!user) { window.primeShow("შესვლა აუცილებელია!"); window.scrollToAuth(); return; }
    
    const p = allProducts.find(item => item.id === id);
    const uDoc = await getDoc(doc(db, "users", user.uid));
    const uData = uDoc.data();

    if(!uData?.phone || !uData?.address) { window.primeShow("მიუთითეთ ნომერი და მისამართი პროფილში!"); return; }

    window.primeShow(`ადასტურებთ შეკვეთას: ${p.name}?`, true, async () => {
        const orderData = { product: p.name, phone: uData.phone, address: uData.address, timestamp: Date.now() };
        await addDoc(collection(db, "orders"), orderData);
        
        const botToken = '8033635887:AAEjRB2hZkQxlbAEv4BFarzQ0asLKBLzT9c';
        const chatId = '-1004329787412';
        const text = `🚀 ახალი შეკვეთა: ${p.name}\n📞 ${orderData.phone}\n📍 ${orderData.address}`;
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`);
        window.primeShow("შეკვეთა წარმატებით გაიგზავნა!");
    });
};

// დამხმარე ფუნქციები
window.setCategory = (cat) => { currentCategory = cat; window.filterProducts(); };
window.toggleProfile = () => document.getElementById('profile-modal').classList.toggle('hidden');
window.scrollToAuth = () => document.getElementById('auth-section').classList.remove('hidden');
window.handleLogout = () => signOut(auth).then(() => location.reload());
