import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getDatabase, ref, set, onDisconnect } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// --- კონფიგურაცია ---
const firebaseConfig = {
    apiKey: "AIzaSyD8enMds5C_R-uD2atgLRf7TPQ4N6u843E",
    authDomain: "evverprrime.firebaseapp.com",
    databaseURL: "https://evverprrime-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "evverprrime",
    storageBucket: "evverprrime.firebasestorage.app",
    messagingSenderId: "738169841658",
    appId: "1:738169841658:web:5de9ecdda0f0f68f4ae643"
};

// ინიციალიზაცია (Try-Catch-ით დაზღვეული)
let app, auth, db, rtdb;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    rtdb = getDatabase(app);
} catch (error) {
    console.error("Firebase init error:", error);
}

let allProducts = [];
let currentPage = 1;
let currentCategory = 'all';

// --- 1. პრელოადერის მართვა (გარანტირებული გათიშვა) ---
const hideLoader = () => {
    const loader = document.getElementById('custom-preloader');
    if (loader) {
        loader.classList.add('loader-hidden');
        setTimeout(() => { loader.style.display = 'none'; }, 800);
    }
};

// ავარიული გათიშვა 3 წამში, თუ კოდმა სადმე გაჭედა
const safetyTimeout = setTimeout(hideLoader, 3000);

document.addEventListener("DOMContentLoaded", () => {
    // კურსორის ლოგიკა
    const cursor = document.getElementById('cursor');
    document.addEventListener('mousemove', (e) => {
        if (cursor) {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        }
    });
    // თუ ყველაფერი ჩაიტვირთა, ვთიშავთ ლოდინს
    setTimeout(hideLoader, 1500);
});

// --- 2. შეტყობინებების სისტემა (Popup) ---
window.primeShow = (text, confirmMode = false, onConfirm = null) => {
    const modal = document.getElementById('prime-popup');
    const txt = document.getElementById('popup-text');
    if (!modal || !txt) return;

    txt.innerText = text;
    modal.classList.replace('hidden', 'flex');

    const confirmBtn = document.getElementById('popup-confirm');
    const closeBtn = document.getElementById('popup-close');

    if (confirmMode && confirmBtn) {
        confirmBtn.classList.remove('hidden');
        confirmBtn.onclick = () => {
            if (onConfirm) onConfirm();
            modal.classList.replace('flex', 'hidden');
        };
    } else if (confirmBtn) {
        confirmBtn.classList.add('hidden');
    }

    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.replace('flex', 'hidden');
    }
};

// --- 3. მომხმარებლის სტატუსი ---
onAuthStateChanged(auth, async (user) => {
    const navUser = document.getElementById('nav-user-area');
    const authSec = document.getElementById('auth-section');

    loadProducts();
    loadCategories();

    if (user) {
        // ონლაინ სტატუსი RTDB-ში
        const statusRef = ref(rtdb, '/online_users/' + user.uid);
        set(statusRef, { email: user.email, last_active: Date.now() });
        onDisconnect(statusRef).remove();

        if (authSec) authSec.classList.add('hidden');
        if (navUser) {
            navUser.innerHTML = `<button onclick="window.toggleProfile()" class="nav-btn">${user.email.split('@')[0].toUpperCase()}</button>`;
        }
        loadUserProfile(user.uid);
    } else {
        if (navUser) {
            navUser.innerHTML = `<button onclick="window.scrollToAuth()" class="nav-btn">შესვლა</button>`;
        }
    }
});

// --- 4. პროდუქტები და კატეგორიები ---
function loadCategories() {
    const container = document.getElementById('category-container');
    if (!container) return;

    onSnapshot(collection(db, "categories"), (snap) => {
        container.innerHTML = `<button onclick="window.setCategory('all')" class="cat-btn ${currentCategory === 'all' ? 'active' : ''}">ყველა</button>`;
        snap.forEach(doc => {
            const cat = doc.data().name;
            container.innerHTML += `<button onclick="window.setCategory('${cat}')" class="cat-btn ${currentCategory === cat ? 'active' : ''}">${cat}</button>`;
        });
    });
}

window.setCategory = (cat) => {
    currentCategory = cat;
    currentPage = 1;
    window.filterProducts();
};

function loadProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
        window.filterProducts();
    });
}

window.filterProducts = () => {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    const search = document.getElementById('search-input')?.value.toLowerCase() || "";
    const sort = document.getElementById('sort-select')?.value || "default";

    let filtered = allProducts.filter(p => {
        const nameMatch = p.name ? p.name.toLowerCase().includes(search) : false;
        const catMatch = currentCategory === 'all' || p.category === currentCategory;
        return nameMatch && catMatch;
    });

    if (sort === 'low') filtered.sort((a, b) => a.price - b.price);
    if (sort === 'high') filtered.sort((a, b) => b.price - a.price);

    const itemsPerPage = window.innerWidth < 768 ? 4 : 16;
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    grid.innerHTML = paginated.map(p => {
        const inStock = p.inStock !== false;
        const img = (p.images && p.images.length > 0) ? p.images[0] : (p.image || 'logo.jpg');
        return `
            <div class="product-card group flex flex-col h-full ${!inStock ? 'opacity-80' : ''}">
                <div class="flex-grow">
                    <div class="relative h-60 w-full flex items-center justify-center bg-black/40 mb-4 border border-white/5 overflow-hidden">
                        <span class="absolute top-2 left-2 px-2 py-1 text-[8px] font-bold uppercase z-10 ${inStock ? 'bg-green-600' : 'bg-red-600'}">
                            ${inStock ? 'მარაგშია' : 'ამოწურულია'}
                        </span>
                        <img src="${img}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500">
                    </div>
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-[12px] font-bold uppercase italic text-white">${p.name || 'პროდუქტი'}</h3>
                            <p class="text-[9px] text-gray-500 uppercase">${p.category || ''}</p>
                        </div>
                        <p class="text-red-600 font-bold text-lg">${p.price}₾</p>
                    </div>
                </div>
                <div class="mt-4 flex flex-col gap-2">
                    <button onclick="window.showDetails('${p.id}')" class="details-btn">დეტალები</button>
                    <button ${inStock ? `onclick="window.order('${p.id}', '${p.name}')"` : 'disabled'} class="buy-btn">
                        ${inStock ? 'შეკვეთა' : 'ამოწურულია'}
                    </button>
                </div>
            </div>`;
    }).join('');

    renderPagination(Math.ceil(filtered.length / itemsPerPage));
};

// --- 5. ინტერფეისის ფუნქციები ---
function renderPagination(total) {
    const container = document.getElementById('pagination-bottom');
    if (!container) return;
    if (total <= 1) { container.innerHTML = ''; return; }
    
    let html = '';
    for (let i = 1; i <= total; i++) {
        const activeClass = i === currentPage ? 'bg-red-600 text-white' : 'text-gray-500 border-white/10';
        html += `<button onclick="window.goToPage(${i})" class="w-10 h-10 border font-bold transition-all ${activeClass}">${i}</button>`;
    }
    container.innerHTML = html;
}

window.goToPage = (p) => { 
    currentPage = p; 
    window.filterProducts(); 
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }); 
};

window.showDetails = (id) => {
    const p = allProducts.find(item => item.id === id);
    if (!p) return;
    const content = document.getElementById('details-content');
    if (!content) return;

    content.innerHTML = `
        <div class="text-left">
            <h2 class="text-2xl font-black italic text-red-600 uppercase mb-4">${p.name}</h2>
            <p class="text-gray-400 text-sm mb-6 whitespace-pre-line">${p.desc || 'აღწერა არ არის.'}</p>
            <button onclick="window.closeDetails()" class="buy-btn">დახურვა</button>
        </div>`;
    document.getElementById('details-modal-overlay').style.display = 'flex';
};

window.closeDetails = () => { 
    const modal = document.getElementById('details-modal-overlay');
    if (modal) modal.style.display = 'none'; 
};

// --- 6. შეკვეთა და პროფილი ---
window.order = async (id, name) => {
    const user = auth.currentUser;
    if (!user) { window.primeShow("შესვლა აუცილებელია!"); window.scrollToAuth(); return; }

    const uDoc = await getDoc(doc(db, "users", user.uid));
    const data = uDoc.data();
    if (!data?.phone) { window.primeShow("მიუთითეთ ნომერი პროფილში!"); window.toggleProfile(); return; }

    window.primeShow(`ადასტურებთ შეკვეთას: ${name}?`, true, async () => {
        const orderInfo = {
            product: name, email: user.email, phone: data.phone,
            address: data.address || 'მისამართი არ არის', time: new Date().toLocaleString()
        };
        await addDoc(collection(db, "orders"), orderInfo);
        
        // ტელეგრამის შეტყობინება
        const botToken = '8023573505:AAFRsExFNpP2d2YpQB4nGDlB-ZEFo3u7wxE';
        const chatId = '-1003731895302';
        const msg = `🚀 ახალი შეკვეთა!\n📦: ${name}\n📞: ${data.phone}\n📍: ${data.address || 'N/A'}`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);

        window.primeShow("შეკვეთა გაიგზავნა!");
    });
};

async function loadUserProfile(uid) {
    const d = await getDoc(doc(db, "users", uid));
    if (d.exists()) {
        const phoneInput = document.getElementById('u-phone-upd');
        const addrInput = document.getElementById('u-address-upd');
        if (phoneInput) phoneInput.value = d.data().phone || '';
        if (addrInput) addrInput.value = d.data().address || '';
    }
}

// --- 7. ავტორიზაციის მართვა ---
window.handleLogin = async () => {
    const e = document.getElementById('l-email')?.value;
    const p = document.getElementById('l-pass')?.value;
    try { await signInWithEmailAndPassword(auth, e, p); } catch(err) { window.primeShow("შეცდომა!"); }
};

window.handleRegister = async () => {
    const e = document.getElementById('r-email')?.value;
    const p = document.getElementById('r-pass')?.value;
    const ph = document.getElementById('r-phone')?.value;
    try {
        const res = await createUserWithEmailAndPassword(auth, e, p);
        await setDoc(doc(db, "users", res.user.uid), { email: e, phone: ph, role: "user" });
    } catch(err) { window.primeShow("რეგისტრაციის შეცდომა!"); }
};

window.handleLogout = () => signOut(auth).then(() => location.reload());
window.toggleProfile = () => document.getElementById('profile-modal')?.classList.toggle('hidden');
window.toggleAuth = () => {
    document.getElementById('login-form')?.classList.toggle('hidden');
    document.getElementById('register-form')?.classList.toggle('hidden');
};
window.scrollToAuth = () => document.getElementById('auth-section')?.classList.remove('hidden');
window.scrollSlide = (d) => document.getElementById('slider-list')?.scrollBy({ left: d, behavior: 'smooth' });
