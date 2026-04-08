 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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



// --- 1. ინტერაქტიული ელემენტები (Cursor & Preloader) ---

document.addEventListener("DOMContentLoaded", () => {

    const cursor = document.getElementById('cursor');

    document.addEventListener('mousemove', (e) => {

        if(cursor) {

            cursor.style.left = e.clientX + 'px';

            cursor.style.top = e.clientY + 'px';

        }

    });



    setTimeout(() => {

        const pre = document.getElementById('custom-preloader');

        if(pre) {

            pre.classList.add('loader-hidden');

            setTimeout(() => pre.style.display = 'none', 800);

        }

    }, 2000);

});



// --- 2. შეტყობინებების ფანჯარა (Popup) ---

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



// --- 3. ავტორიზაცია და სტატუსი ---

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

        navUser.innerHTML = `<button onclick="window.toggleProfile()" class="nav-btn">${user.email.split('@')[0].toUpperCase()}</button>`;

        loadUserProfile(user.uid);

    } else {

        navUser.innerHTML = `<button onclick="window.scrollToAuth()" class="nav-btn">შესვლა</button>`;

    }

});



// --- 4. პროდუქტების და კატეგორიების მართვა ---

function loadCategories() {

    onSnapshot(collection(db, "categories"), (snap) => {

        const container = document.getElementById('category-container');

        if(!container) return;

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

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    

    grid.innerHTML = '';

    paginated.forEach(p => {

        const inStock = p.inStock !== false;

        const mainImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image || 'logo.jpg');

        // ამ კოდით ჩაანაცვლე filterProducts-ის შიგნით არსებული grid.innerHTML-ის ნაწილი:

grid.innerHTML += `

    <div class="product-card group flex flex-col h-full ${!inStock ? 'opacity-80' : ''}">

        <div class="flex-grow">

            <div class="relative h-65 w-full flex items-center justify-center bg-black/40 mb-6 border border-white/5 overflow-hidden">

                <span class="absolute top-2 left-2 px-2 py-1 text-[8px] font-bold uppercase z-10 ${inStock ? 'bg-green-600' : 'bg-red-600'}">

                    ${inStock ? 'მარაგშია' : 'ამოწურულია'}

                </span>

                <img src="${mainImg}" class="max-h-full max-w-full object-contain group-hover:scale-110 transition-all duration-500">

            </div>

            <div class="flex justify-between items-start mb-4">

                <div>

                    <h3 class="text-[12px] font-bold uppercase italic text-white">${p.name}</h3>

                    <p class="text-[9px] text-gray-500 uppercase">${p.category || ''}</p>

                </div>

             <div class="text-right">

    <p class="text-red-600 font-bold text-lg">${p.price}₾</p>

    ${p.oldPrice ? `<p class="text-gray-500 text-[9px] uppercase tracking-tighter">იყო: ${p.oldPrice}₾</p>` : ''}

</div>



            </div>

        </div>

        <div class="mt-auto flex flex-col gap-1">

            <button onclick="window.showDetails('${p.id}')" class="details-btn">დეტალები</button>

            <button ${inStock ? `onclick="window.order('${p.id}', '${p.name}')"` : 'disabled'} class="buy-btn">

                ${inStock ? 'შეკვეთა' : 'არ არის მარაგში'}

            </button>

        </div>

    </div>`;



    });

    renderPagination(totalPages);

};



// --- 5. სლაიდერი და დეტალები ---

window.showDetails = (id) => {

    const p = allProducts.find(item => item.id === id);

    if(!p) return;



    const images = (p.images && p.images.length > 0) ? p.images : [p.image || 'logo.jpg'];

    let currentIdx = 0;

    const inStock = p.inStock !== false;



    const modal = document.getElementById('details-modal-overlay');

    const content = document.getElementById('details-content');



    content.innerHTML = `

        <div class="flex flex-col gap-6">

            <div class="relative w-full aspect-square bg-black border border-white/5 flex items-center justify-center overflow-hidden">

                <img id="modal-slider-img" src="${images[0]}" class="max-h-full max-w-full object-contain transition-opacity duration-300">

                ${images.length > 1 ? `

                    <button id="prev-img" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/80 text-white p-3 hover:text-red-600 transition-all">◀</button>

                    <button id="next-img" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/80 text-white p-3 hover:text-red-600 transition-all">▶</button>

                    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/50" id="img-counter">1 / ${images.length}</div>

                ` : ''}

            </div>

            <div class="text-left">

                <h2 class="text-2xl font-black italic uppercase text-red-600 mb-2">${p.name}</h2>

             <div class="flex items-baseline gap-3 mb-4">

    <span class="text-white font-bold text-3xl">${p.price}₾</span>

    ${p.oldPrice ? `<span class="text-gray-500 text-sm italic underline decoration-red-600/30">იყო: ${p.oldPrice}₾</span>` : ''}

</div>



                <p class="text-gray-400 text-xs leading-relaxed border-l-2 border-red-600 pl-4 mb-6 whitespace-pre-line">${p.desc || 'აღწერა არ არის.'}</p>

                <div class="flex flex-col gap-2">

                    <button ${inStock ? `onclick="window.order('${p.id}', '${p.name}'); window.closeDetails()"` : 'disabled'} class="buy-btn">შეკვეთა</button>

                    <button onclick="window.closeDetails()" class="details-btn">დახურვა</button>

                </div>

            </div>

        </div>

    `;



    if(images.length > 1) {

        const imgEl = document.getElementById('modal-slider-img');

        const counterEl = document.getElementById('img-counter');

        const update = () => {

            imgEl.style.opacity = '0';

            setTimeout(() => {

                imgEl.src = images[currentIdx];

                imgEl.style.opacity = '1';

                counterEl.innerText = `${currentIdx + 1} / ${images.length}`;

            }, 200);

        };

        document.getElementById('prev-img').onclick = () => { currentIdx = (currentIdx - 1 + images.length) % images.length; update(); };

        document.getElementById('next-img').onclick = () => { currentIdx = (currentIdx + 1) % images.length; update(); };

    }

    modal.style.display = 'flex';

};



window.closeDetails = () => { document.getElementById('details-modal-overlay').style.display = 'none'; };



// --- 6. შეკვეთის ლოგიკა და ტელეგრამი ---

window.order = async (id, name) => {

    const user = auth.currentUser;

    if(!user) { window.primeShow("შესვლა აუცილებელია!"); window.scrollToAuth(); return; }



    const uDoc = await getDoc(doc(db, "users", user.uid));

    const data = uDoc.data();

    if(!data.phone || !data.address) { window.primeShow("მიუთითეთ ნომერი და მისამართი პროფილში!"); window.toggleProfile(); return; }



    window.primeShow(`ადასტურებთ შეკვეთას: ${name}?`, true, async () => {

        const orderInfo = { 

            product: name, email: user.email, phone: data.phone, address: data.address, 

            timestamp: Date.now(), time: new Date().toLocaleString('ka-GE') 

        };

        await addDoc(collection(db, "orders"), orderInfo);

        await set(ref(rtdb, 'orders_live/' + user.uid + '_' + Date.now()), orderInfo);

        

        const botToken = '8023573505:AAFRsExFNpP2d2YpQB4nGDlB-ZEFo3u7wxE';

        const tgText = `🚀 ახალი შეკვეთა!\n📦 პროდუქტი: ${name}\n📞 ტელეფონი: ${data.phone}\n📍 მისამართი: ${data.address}`;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=-1003731895302&text=${encodeURIComponent(tgText)}`);

        

        window.primeShow("შეკვეთა გაიგზავნა!");

    });

};



// --- 7. დამხმარე UI ფუნქციები ---

function renderPagination(total) {

    const container = document.getElementById('pagination-bottom');

    if (!container || total <= 1) { if(container) container.innerHTML = ''; return; }

    container.innerHTML = '';

    for (let i = 1; i <= total; i++) {

        const active = i === currentPage ? 'bg-red-600 text-white' : 'text-gray-500 border-white/10';

        container.innerHTML += `<button onclick="window.goToPage(${i})" class="w-10 h-10 border font-bold transition-all ${active}">${i}</button>`;

    }

}



window.goToPage = (p) => { currentPage = p; window.filterProducts(); document.getElementById('shop').scrollIntoView({behavior: 'smooth'}); };



// --- 8. ავტორიზაციის და პროფილის ფუნქციები ---

async function loadUserProfile(uid) {

    const d = await getDoc(doc(db, "users", uid));

    if(d.exists()) {

        document.getElementById('u-phone-upd').value = d.data().phone || '';

        document.getElementById('u-address-upd').value = d.data().address || '';

    }

}



window.updateProfile = async () => {

    const user = auth.currentUser;

    if(user) {

        await setDoc(doc(db, "users", user.uid), {

            phone: document.getElementById('u-phone-upd').value,

            address: document.getElementById('u-address-upd').value

        }, { merge: true });

        window.primeShow("პროფილი განახლდა!");

        window.toggleProfile();

    }

};



window.handleLogin = async () => {

    const email = document.getElementById('l-email').value;

    const pass = document.getElementById('l-pass').value;

    try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { window.primeShow("შეცდომა: " + e.message); }

};



window.handleRegister = async () => {

    const email = document.getElementById('r-email').value;

    const pass = document.getElementById('r-pass').value;

    const phone = document.getElementById('r-phone').value;

    const addr = document.getElementById('r-address').value;

    try {

        const res = await createUserWithEmailAndPassword(auth, email, pass);

        await setDoc(doc(db, "users", res.user.uid), { email, phone, address: addr, role: "user" });

    } catch(e) { window.primeShow("შეცდომა: " + e.message); }

};



window.handleLogout = () => signOut(auth).then(() => location.reload());

window.toggleProfile = () => document.getElementById('profile-modal').classList.toggle('hidden');

window.toggleAuth = () => { 

    document.getElementById('login-form').classList.toggle('hidden'); 

    document.getElementById('register-form').classList.toggle('hidden'); 

};

window.scrollToAuth = () => { 

    const sec = document.getElementById('auth-section');

    if(sec) sec.classList.remove('hidden');

};



// --- 9. Navigation Slider Hide on Scroll ---

let lastScroll = 0;

window.addEventListener('scroll', () => {

    const slider = document.getElementById('main-slider-container');

    if(!slider) return;

    let st = window.pageYOffset || document.documentElement.scrollTop;

    if (st > lastScroll && st > 100) slider.classList.add('slider-hidden');

    else slider.classList.remove('slider-hidden');

    lastScroll = st <= 0 ? 0 : st;

});



window.scrollSlide = (distance) => { document.getElementById('slider-list').scrollBy({ left: distance, behavior: 'smooth' }); };
