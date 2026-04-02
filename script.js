import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
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
let currentPage = 1;
let currentCategory = 'all';

// --- შეტყობინებების ფანჯარა ---
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

// --- ავტორიზაციის კონტროლი ---
onAuthStateChanged(auth, async (user) => {
    const authSec = document.getElementById('auth-section');
    const navUser = document.getElementById('nav-user-area');
    
    loadProducts();
    loadCategories();

    if (user) {
        const userStatusRef = ref(rtdb, '/online_users/' + user.uid);
        set(userStatusRef, { email: user.email, last_active: Date.now() });
        onDisconnect(userStatusRef).remove();
        
        if(authSec) authSec.classList.add('hidden');
        navUser.innerHTML = `
            <button onclick="window.toggleProfile()" class="nav-btn">${user.email.split('@')[0].toUpperCase()}</button>
        `;
        loadUserProfile(user.uid);
    } else {
        if(authSec) authSec.classList.remove('hidden');
        navUser.innerHTML = `<button onclick="window.scrollToAuth()" class="nav-btn">შესვლა</button>`;
    }
});

// --- კატეგორიების მართვა ---
function loadCategories() {
    onSnapshot(collection(db, "categories"), (snap) => {
        const container = document.getElementById('category-container');
        if(!container) return;
        
        container.innerHTML = `<button onclick="window.setCategory('all')" class="cat-btn ${currentCategory === 'all' ? 'active' : ''}">ყველა</button>`;
        
        snap.forEach(doc => {
            const cat = doc.data().name;
            const activeClass = currentCategory === cat ? 'active' : '';
            container.innerHTML += `<button onclick="window.setCategory('${cat}')" class="cat-btn ${activeClass}">${cat}</button>`;
        });
    });
}

window.setCategory = (cat) => {
    currentCategory = cat;
    currentPage = 1;
    window.filterProducts();
};

// --- პროდუქტების მართვა ---
function loadProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
        window.filterProducts();
    });
}

window.filterProducts = () => {
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const grid = document.getElementById('product-grid');
    if(!grid) return;

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const sort = sortSelect ? sortSelect.value : "default";
    
    let filtered = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search);
        const matchesCategory = currentCategory === 'all' || p.category === currentCategory;
        return matchesSearch && matchesCategory;
    });
    
    if(sort === 'low') filtered.sort((a,b) => a.price - b.price);
    if(sort === 'high') filtered.sort((a,b) => b.price - a.price);
    
    const itemsPerPage = window.innerWidth < 768 ? 4 : 16;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);
    
    grid.innerHTML = '';
    paginated.forEach(p => {
        // მარაგის შემოწმება (თუ ველი არ არსებობს, ვთვლით რომ არის)
        const inStock = p.inStock !== false;

        grid.innerHTML += `
            <div class="product-card group reveal-up flex flex-col h-full ${!inStock ? 'opacity-80' : ''}">
                <div class="flex-grow">
                    <div class="relative h-55 w-full flex items-center justify-center bg-black/40 mb-6 border border-white/5 overflow-hidden ">
                        <!-- Stock Badge -->
                        <span class="absolute top-2 left-2 px-2 py-1 text-[8px] font-bold uppercase tracking-widest z-10 ${inStock ? 'bg-green-600' : 'bg-red-600'}">
                            ${inStock ? 'მარაგშია' : 'ამოწურულია'}
                        </span>
                        
                        <img src="${p.image || ''}" class="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500 ${!inStock ? 'grayscale' : ''}">
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h3 class="font-sync text-[12px] font-bold uppercase italic">${p.name}</h3>
                            <p class="text-[9px] text-gray-500 uppercase">${p.category || ''}</p>
                        </div>
                        <span class="text-red-600 font-bold tracking-tighter">${p.price}₾</span>
                    </div>
                </div>
                
                <div class="mt-auto flex flex-col gap-1">
                    <button onclick="window.showDetails('${p.id}')" class="details-btn">დეტალები</button>
                    
                    <!-- Buy Button Logic -->
                    <button ${inStock ? `onclick="window.order('${p.id}', '${p.name}')"` : 'disabled'} 
                        class="buy-btn ${!inStock ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-50' : ''}">
                        ${inStock ? 'შეკვეთა' : 'არ არის მარაგში'}
                    </button>
                </div>
            </div>`;
    });
    renderPagination(totalPages);
};

function renderPagination(total) {
    const container = document.getElementById('pagination-bottom');
    if (!container) return;
    if (total <= 1) { container.innerHTML = ''; return; }
    container.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const btnClass = i === currentPage ? 'bg-red-600 text-white border-red-600' : 'text-gray-500 border-white/10';
        container.innerHTML += `<button onclick="window.goToPage(${i})" class="w-12 h-12 border font-bold transition-all ${btnClass}">${i}</button>`;
    }
}

window.goToPage = (page) => { 
    currentPage = page; 
    window.filterProducts(); 
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); 
};

// --- დეტალები ---
window.showDetails = (id) => {
    const p = allProducts.find(item => item.id === id);
    if(!p) return;
    const inStock = p.inStock !== false;
    const modal = document.getElementById('details-modal-overlay');
    const content = document.getElementById('details-content');
    content.innerHTML = `
        <div class="flex flex-col gap-6">
            <div class="w-full flex items-center justify-center bg-black/50 p-4 border border-white/5 relative">
                <span class="absolute top-4 left-4 px-2 py-1 text-[8px] font-bold uppercase tracking-widest z-10 ${inStock ? 'bg-green-600' : 'bg-red-600'}">
                    ${inStock ? 'მარაგშია' : 'ამოწურულია'}
                </span>
                <img src="${p.image || ''}" class="max-h-56 object-contain shadow-2xl shadow-red-600/20 ${!inStock ? 'grayscale' : ''}">
            </div>
            <div class="w-full text-left">
                <p class="text-red-600 text-[10px] font-bold uppercase mb-1">${p.category || 'ზოგადი'}</p>
                <h2 class="font-sync text-1xl font-black italic uppercase text-white mb-2">${p.name}</h2>
                <div class="text-white font-bold text-lg mb-4 tracking-tighter">${p.price}₾</div>
                <p class="text-gray-400 text-[12px] md:text-xs leading-relaxed uppercase whitespace-pre-line mb-5 bg-white/5 p-3 border-l border-red-600">${p.desc || 'აღწერა არ არის'}</p>
                <div class="flex flex-col gap-3">
                    <button ${inStock ? `onclick="window.order('${p.id}', '${p.name}'); window.closeDetails()"` : 'disabled'} 
                        class="buy-btn ${!inStock ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-50' : ''}">
                        ${inStock ? 'შეკვეთა' : 'არ არის მარაგში'}
                    </button>
                    <button onclick="window.closeDetails()" class="w-full py-2 text-[15px] text-red-500 hover:text-white uppercase font-bold tracking-widest transition">დახურვა</button>
                </div>
            </div>
        </div>`;
    modal.style.display = 'flex';
};

window.closeDetails = () => { document.getElementById('details-modal-overlay').style.display = 'none'; };

// --- შეკვეთის ლოგიკა ---
window.order = async (id, name) => {
    const user = auth.currentUser;

    if(!user) {
        window.primeShow("შეკვეთისთვის საჭიროა ავტორიზაცია!");
        window.scrollToAuth();
        return;
    }

    const uDoc = await getDoc(doc(db, "users", user.uid));
    const data = uDoc.data();
    
    if(!data || !data.phone || !data.address) { 
        window.primeShow("გთხოვთ, შეავსოთ ტელეფონი და მისამართი პროფილში!"); 
        window.toggleProfile(); 
        return; 
    }

    window.primeShow(`ადასტურებთ შეკვეთას: ${name}?`, true, async () => {
        const orderInfo = { 
            product: name, 
            email: user.email, 
            phone: data.phone, 
            address: data.address, 
            time: new Date().toLocaleString('ka-GE'), 
            timestamp: Date.now() 
        };

        try {
            await addDoc(collection(db, "orders"), orderInfo);
            await set(ref(rtdb, 'orders_live/' + user.uid + '_' + Date.now()), orderInfo);

            const botToken = '8023573505:AAFRsExFNpP2d2YpQB4nGDlB-ZEFo3u7wxE';
            const chatId = '-1003731895302';
            const tgText = `🚀 EverPrime: ახალი შეკვეთა!\n\n📦 პროდუქტი: ${orderInfo.product}\n📞 ტელეფონი: ${orderInfo.phone}\n📧 Email: ${orderInfo.email}\n📍 მისამართი: ${orderInfo.address}`;
            
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(tgText)}`);

            window.primeShow("შეკვეთა გაგზავნილია! ოპერატორი მალე დაგიკავშირდებათ.");
        } catch (e) {
            window.primeShow("შეცდომა: " + e.message);
        }
    });
};

// --- პროფილის და ავტორიზაციის ფუნქციები ---
async function loadUserProfile(uid) {
    const d = await getDoc(doc(db, "users", uid));
    if(d.exists()) {
        const phoneField = document.getElementById('u-phone-upd');
        const addrField = document.getElementById('u-address-upd');
        if(phoneField) phoneField.value = d.data().phone || '';
        if(addrField) addrField.value = d.data().address || '';
    }
}

window.updateProfile = async () => {
    const user = auth.currentUser;
    if(user) {
        await setDoc(doc(db, "users", user.uid), {
            phone: document.getElementById('u-phone-upd').value,
            address: document.getElementById('u-address-upd').value
        }, { merge: true });
        window.primeShow("პროფილი განახლებულია!");
        window.toggleProfile();
    }
};

window.handleLogin = async () => {
    const email = document.getElementById('l-email').value;
    const pass = document.getElementById('l-pass').value;
    try { 
        await signInWithEmailAndPassword(auth, email, pass);
    } catch(e) { window.primeShow("შეცდომა: " + e.message); }
};

window.handleRegister = async () => {
    const email = document.getElementById('r-email').value;
    const pass = document.getElementById('r-pass').value;
    const phone = document.getElementById('r-phone').value;
    const addr = document.getElementById('r-address').value;
    
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", res.user.uid), { 
            email: email, 
            phone: phone, 
            address: addr, 
            role: "user" 
        });
    } catch(e) { window.primeShow("შეცდომა: " + e.message); }
};

window.handleLogout = () => signOut(auth).then(() => location.reload());
window.toggleProfile = () => document.getElementById('profile-modal').classList.toggle('hidden');
window.toggleAuth = () => { 
    document.getElementById('login-form').classList.toggle('hidden'); 
    document.getElementById('register-form').classList.toggle('hidden'); 
};
window.scrollToAuth = () => {
    const authSec = document.getElementById('auth-section');
    if(authSec) {
        authSec.classList.remove('hidden');
        authSec.scrollIntoView({ behavior: 'smooth' });
    }
};
document.addEventListener("DOMContentLoaded", function() {
    const preloader = document.getElementById('custom-preloader');
    
    // დრო მილიწამებში (3 წამი)
    const displayTime = 2000; 

    setTimeout(function() {
        // 1. ვამატებთ კლასს, რომელიც იწყებს 0.8 წამიან გაქრობას (opacity: 0)
        preloader.classList.add('loader-hidden');
        
        // 2. ველოდებით ზუსტად 800 მილიწამს (იგივე დროს, რაც CSS transition-შია)
        // და შემდეგ სრულად ვაშორებთ DOM-იდან, რომ რესურსები არ დაიკავოს
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 800);

    }, displayTime);
});
let lastScrollTop = 0;
const sliderContainer = document.getElementById('main-slider-container');

window.addEventListener('scroll', function() {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // თუ გვერდის თავში ვართ, ყოველთვის გამოჩნდეს
    if (scrollTop <= 100) {
        sliderContainer.classList.remove('slider-hidden');
    } 
    // თუ დაბლა ვსქროლავთ - დაიმალოს
    else if (scrollTop > lastScrollTop) {
        sliderContainer.classList.add('slider-hidden');
    } 
    // თუ ოდნავ მაინც ზემოთ ავწიეთ - გამოჩნდეს
    else {
        sliderContainer.classList.remove('slider-hidden');
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // მობილურზე ნეგატიური სქროლის პრევენცია
}, false);

// ისრების სქროლის ფუნქცია (უცვლელი)
window.scrollSlide = (distance) => {
    document.getElementById('slider-list').scrollBy({
        left: distance,
        behavior: 'smooth'
    });
};
