import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
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

let allProducts = [];
let currentCategory = 'all';

// --- 1. კურსორის და პრელოადერის ლოგიკა ---
document.addEventListener('mousemove', (e) => {
    const cursor = document.getElementById('cursor');
    if (cursor) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    }
});

const hideLoader = () => {
    const loader = document.getElementById('custom-preloader');
    if (loader) {
        loader.classList.add('loader-hidden');
        setTimeout(() => { loader.style.display = 'none'; }, 800);
    }
};

// --- 2. მთავარი სლაიდერის (Hero) მართვა ---
window.scrollSlide = (direction) => {
    const slider = document.getElementById('slider-list');
    if (slider) {
        slider.scrollBy({ left: direction, behavior: 'smooth' });
    }
};

// --- 3. პროდუქტების და კატეგორიების ჩატვირთვა ---
const loadData = () => {
    onSnapshot(collection(db, "categories"), (snap) => {
        const container = document.getElementById('category-container');
        if (!container) return;
        container.innerHTML = `<button onclick="window.setCategory('all')" class="cat-btn ${currentCategory === 'all' ? 'active' : ''}">ყველა</button>`;
        snap.forEach(doc => {
            const cat = doc.data().name;
            container.innerHTML += `<button onclick="window.setCategory('${cat}')" class="cat-btn ${currentCategory === cat ? 'active' : ''}">${cat}</button>`;
        });
    });

    onSnapshot(collection(db, "products"), (snap) => {
        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        window.renderProducts();
        hideLoader();
    });
};

// --- 4. პროდუქტების რენდერი (Hover ეფექტით) ---
window.renderProducts = () => {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    const search = document.getElementById('search-input')?.value.toLowerCase() || "";
    let filtered = allProducts.filter(p => 
        (currentCategory === 'all' || p.category === currentCategory) &&
        (p.name?.toLowerCase().includes(search))
    );

    grid.innerHTML = filtered.map(p => {
        const inStock = p.inStock !== false;
        const img = (p.images && p.images.length > 0) ? p.images[0] : (p.image || 'logo.jpg');
        return `
            <div class="product-card group flex flex-col h-full ${!inStock ? 'opacity-80' : ''}">
                <div class="relative h-64 w-full flex items-center justify-center bg-black/40 mb-4 border border-white/5 overflow-hidden">
                    <img src="${img}" class="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-700">
                    ${p.oldPrice ? `<div class="absolute top-2 right-2 bg-red-600 text-[10px] px-2 py-1 font-bold italic">SALE</div>` : ''}
                </div>
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-[13px] font-bold uppercase italic text-white leading-tight">${p.name}</h3>
                    <div class="text-right">
                        <p class="text-red-600 font-bold text-lg leading-none">${p.price}₾</p>
                        ${p.oldPrice ? `<p class="text-[10px] text-gray-600 line-through">${p.oldPrice}₾</p>` : ''}
                    </div>
                </div>
                <div class="mt-auto flex flex-col gap-2">
                    <button onclick="window.showDetails('${p.id}')" class="details-btn">დეტალები</button>
                    <button ${inStock ? `onclick="window.order('${p.id}', '${p.name}')"` : 'disabled'} class="buy-btn">
                        ${inStock ? 'შეკვეთა' : 'ამოწურულია'}
                    </button>
                </div>
            </div>`;
    }).join('');
};

// --- 5. დეტალების მოდალი (სრული სლაიდერით) ---
window.showDetails = (id) => {
    const p = allProducts.find(item => item.id === id);
    if (!p) return;

    const images = (p.images && p.images.length > 0) ? p.images : [p.image || 'logo.jpg'];
    let currentIdx = 0;

    const content = document.getElementById('details-content');
    content.innerHTML = `
        <div class="flex flex-col md:flex-row gap-8">
            <div class="relative w-full md:w-1/2 h-80 bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden">
                <img id="modal-slider-img" src="${images[currentIdx]}" class="max-h-full max-w-full object-contain transition-opacity duration-300">
                ${images.length > 1 ? `
                    <button id="prev-img" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/80 w-10 h-10 text-white hover:text-red-600">◀</button>
                    <button id="next-img" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/80 w-10 h-10 text-white hover:text-red-600">▶</button>
                ` : ''}
            </div>
            <div class="w-full md:w-1/2 text-left">
                <h2 class="text-2xl font-black italic text-red-600 uppercase mb-4 tracking-tighter">${p.name}</h2>
                <p class="text-gray-400 text-sm mb-8 leading-relaxed whitespace-pre-line">${p.desc || 'აღწერა არ არის.'}</p>
                <div class="flex gap-3">
                    <button onclick="window.closeDetails()" class="details-btn !mb-0 flex-1 text-[10px]">უკან</button>
                    <button onclick="window.order('${p.id}', '${p.name}')" class="buy-btn flex-1">შეკვეთა</button>
                </div>
            </div>
        </div>`;

    document.getElementById('details-modal-overlay').style.display = 'flex';

    if (images.length > 1) {
        const imgDisplay = document.getElementById('modal-slider-img');
        const update = (i) => {
            imgDisplay.style.opacity = '0';
            setTimeout(() => { imgDisplay.src = images[i]; imgDisplay.style.opacity = '1'; }, 200);
        };
        document.getElementById('prev-img').onclick = () => { currentIdx = (currentIdx - 1 + images.length) % images.length; update(currentIdx); };
        document.getElementById('next-img').onclick = () => { currentIdx = (currentIdx + 1) % images.length; update(currentIdx); };
    }
};

window.closeDetails = () => { document.getElementById('details-modal-overlay').style.display = 'none'; };

// --- 6. შეკვეთა და სტატუსი ---
window.order = async (id, name) => {
    const user = auth.currentUser;
    if (!user) { alert("გთხოვთ გაიაროთ ავტორიზაცია!"); return; }

    const uDoc = await getDoc(doc(db, "users", user.uid));
    const userData = uDoc.data();

    if (!userData?.phone) { alert("მიუთითეთ ნომერი პროფილში!"); return; }

    if (confirm(`შევუკვეთოთ ${name}?`)) {
        const orderData = {
            product: name, phone: userData.phone, address: userData.address || 'N/A',
            email: user.email, timestamp: Date.now(), time: new Date().toLocaleString('ka-GE')
        };
        await addDoc(collection(db, "orders"), orderData);
        
        const botToken = '8023573505:AAFRsExFNpP2d2YpQB4nGDlB-ZEFo3u7wxE';
        const chatId = '-1003731895302';
        const msg = `🚀 ახალი შეკვეთა!\n📦: ${name}\n📞: ${userData.phone}`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
        alert("შეკვეთა გაიგზავნა!");
    }
};

window.setCategory = (cat) => { currentCategory = cat; window.renderProducts(); };

onAuthStateChanged(auth, (user) => {
    const navArea = document.getElementById('nav-user-area');
    if (user && navArea) {
        navArea.innerHTML = `<button class="nav-btn">${user.email.split('@')[0].toUpperCase()}</button>
                             <button onclick="window.handleLogout()" class="text-[9px] text-red-600 ml-2 font-bold italic">LOGOUT</button>`;
        
        // ონლაინ სტატუსი
        const statusRef = ref(rtdb, '/online_users/' + user.uid);
        set(statusRef, { email: user.email, last_active: Date.now() });
        onDisconnect(statusRef).remove();
    }
});

window.handleLogout = () => signOut(auth).then(() => location.reload());

document.addEventListener('DOMContentLoaded', loadData);
