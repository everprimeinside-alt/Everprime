import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { getDatabase, ref, set, onDisconnect } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-database.js";

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
let currentUserOrders = [];

function escapeMd(text) {
    return String(text ?? '').replace(/([_*`\[])/g, '\\$1');
}

document.addEventListener("DOMContentLoaded", () => {
    verifyReferralStatus();
    loadProducts();
    loadCategories();
    setTimeout(() => {
        const pre = document.getElementById('custom-preloader');
        if(pre) {
            pre.classList.add('loader-hidden');
            setTimeout(() => pre.style.display = 'none', 800);
        }
    }, 2000);
});

async function verifyReferralStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralId = urlParams.get('ref');
    if (!referralId) {
        localStorage.removeItem('prime_referrer');
        return;
    }
    try {
        const refDocRef = doc(db, "partners", referralId);
        const refSnapshot = await getDoc(refDocRef);
        if (!refSnapshot.exists()) {
            urlParams.delete('ref');
            const cleanURL = window.location.origin + (urlParams.toString() ? '?' + urlParams.toString() : '');
            localStorage.removeItem('prime_referrer');
            window.primeShow("მოცემული რეფერალური ლინკი გაუქმებულია ან არ არსებობს!", false);
            setTimeout(() => { window.location.href = cleanURL; }, 2500);
        } else {
            localStorage.setItem('prime_referrer', referralId);
        }
    } catch (error) { console.log("Referral track check bypassed: ", error.message); }
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

async function generateUniqueOrderCode() {
    let code = '';
    let exists = true;
    let attempts = 0;
    const maxAttempts = 100;
    while (exists && attempts < maxAttempts) {
        code = String(Math.floor(1000 + Math.random() * 9000));
        const q = query(collection(db, "orders"), where("orderCode", "==", code));
        const snap = await getDocs(q);
        exists = !snap.empty;
        attempts++;
    }
    if (attempts >= maxAttempts) {
        code = String(Date.now()).slice(-4);
    }
    return code;
}

onAuthStateChanged(auth, async (user) => {
    const authSec = document.getElementById('auth-section');
    const navUser = document.getElementById('nav-user-area');
    if (user) {
        const userStatusRef = ref(rtdb, '/online_users/' + user.uid);
        set(userStatusRef, { email: user.email, last_active: Date.now() });
        onDisconnect(userStatusRef).remove();
        if(authSec) authSec.classList.add('hidden');
        if(navUser) navUser.innerHTML = `<button onclick="window.toggleProfile()" class="nav-btn">${user.email.split('@')[0].toUpperCase()}</button>`;
        loadUserProfile(user.uid);
        loadUserOrders(user.uid);
    } else {
        if(navUser) navUser.innerHTML = `<button onclick="window.scrollToAuth()" class="nav-btn">შესვლა</button>`;
    }
});

function loadCategories() {
    onSnapshot(collection(db, "categories"), (snap) => {
        const container = document.getElementById('category-container');
        if(!container) return;
        let html = `<button onclick="window.setCategory('all')" class="cat-btn ${currentCategory === 'all' ? 'active' : ''}">ყველა</button>`;
        snap.forEach(docSnap => {
            const cat = docSnap.data().name;
            if(cat) {
                html += `<button onclick="window.setCategory('${cat}')" class="cat-btn ${currentCategory === cat ? 'active' : ''}">${cat}</button>`;
            }
        });
        container.innerHTML = html;
    });
}

window.setCategory = (cat) => { 
    currentCategory = cat; 
    currentPage = 1; 
    
    const container = document.getElementById('category-container');
    if(container) {
        const buttons = container.querySelectorAll('.cat-btn');
        buttons.forEach(btn => {
            if(btn.textContent.trim() === cat || (cat === 'all' && btn.textContent.trim() === 'ყველა')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    window.filterProducts(); 
};

function loadProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
        window.filterProducts();

        // ავტომატური შემოწმება: თუ ლინკში მოჰყვება ?product=ID, ავტომატურად გავხსნათ პროდუქტი
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('product');
        if (productId && allProducts.length > 0) {
            window.showDetails(productId);
        }
    });
}

window.filterProducts = () => {
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const sort = sortSelect ? sortSelect.value : "default";

    let filtered = allProducts.filter(p => {
        const matchesSearch = p.name ? p.name.toLowerCase().includes(search) : false;
        const matchesCategory = currentCategory === 'all' || p.category === currentCategory;
        return matchesSearch && matchesCategory;
    });

    if(sort === 'low') filtered.sort((a,b) => Number(a.price) - Number(b.price));
    if(sort === 'high') filtered.sort((a,b) => Number(b.price) - Number(a.price));

    const itemsPerPage = window.innerWidth < 768 ? 4 : 16;
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if(currentPage > totalPages) currentPage = totalPages;
    
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    grid.innerHTML = '';
    
    if (paginated.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 bg-black/20">
                <span class="material-icons text-gray-600 text-4xl mb-2">inventory_2</span>
                <p class="text-gray-400 text-xs uppercase tracking-wider">პროდუქტები ვერ მოიძებნა</p>
            </div>`;
        renderPagination(0);
        return;
    }

    paginated.forEach(p => {
        const inStock = p.inStock !== false;
        const mainImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image || 'logo.jpg');
        grid.innerHTML += `
            <div class="product-card group flex flex-col h-full ${!inStock ? 'opacity-80' : ''}">
                <div class="flex-grow">
                    <div class="relative h-65 w-full flex items-center justify-center bg-black/40 mb-6 border border-white/5 overflow-hidden">
                        <span class="absolute top-2 left-2 px-2 py-1 text-[8px] font-bold uppercase z-10 ${inStock ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}">
                            ${inStock ? 'მარაგშია' : 'ამოწურულია'}
                        </span>
                        <img src="${mainImg}" class="max-h-full max-w-full object-contain group-hover:scale-110 transition-all duration-500" onerror="this.src='logo.jpg'">
                    </div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-[12px] font-bold uppercase italic text-white">${p.name || ''}</h3>
                            <p class="text-[9px] text-gray-500 uppercase">${p.category || ''}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-red-600 font-bold text-lg">${p.price}₾</p>
                        </div>
                    </div>
                </div>
                           <!-- პროდუქტის ბარათის ღილაკების სექცია -->
<div class="mt-auto flex flex-col gap-1">
    <div class="grid grid-cols-2 gap-1">
        <button onclick="window.showDetails('${p.id}')" class="details-btn">დეტალები</button>
        <button onclick="window.shareProduct('${p.id}')" class="details-btn flex items-center justify-center gap-1">
            <span style="color:red;" class="material-icons text-xxl">share</span> <!-- გაზიარების აიქონი -->
        </button>
    </div>
    <button ${inStock ? `onclick="window.order('${p.id}')"` : 'disabled'} class="buy-btn">
        ${inStock ? 'შეკვეთა' : 'არ არის მარაგში'}
    </button>
</div>

            </div>`;
    });
    renderPagination(totalPages);
};

// პროდუქტის უნიკალური ლინკით გაზიარების ფუნქცია
window.shareProduct = (id) => {
    const p = allProducts.find(item => item.id === id);
    if (!p) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const productUrl = `${baseUrl}?product=${id}`;

    if (navigator.share) {
        navigator.share({
            title: p.name || 'პროდუქტი',
            text: `ნახე ეს პროდუქტი: ${p.name} - ${p.price}₾`,
            url: productUrl,
        }).catch((error) => console.log('Sharing failed', error));
    } else {
        navigator.clipboard.writeText(productUrl).then(() => {
            window.primeShow(`ლინკი დაკოპირდა ბუფერში!`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            window.primeShow(`პროდუქტის ლინკი: ${productUrl}`);
        });
    }
};

window.showDetails = (id) => {
    const p = allProducts.find(item => item.id === id);
    if(!p) return;
    const images = (p.images && p.images.length > 0) ? p.images : [p.image || 'logo.jpg'];
    let currentIdx = 0;
    const inStock = p.inStock !== false;
    const modal = document.getElementById('details-modal-overlay');
    const content = document.getElementById('details-content');
    if (!modal || !content) return;

    const newUrl = `${window.location.pathname}?product=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    content.innerHTML = `
        <div class="flex flex-col gap-6">
            <div class="relative w-full aspect-square bg-black border border-white/5 flex items-center justify-center overflow-hidden">
                <img id="modal-slider-img" src="${images[0]}" class="max-h-full max-w-full object-contain" onerror="this.src='logo.jpg'">
                ${images.length > 1 ? `
                    <button id="prev-img" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/80 text-white p-3 hover:text-red-600 transition-all z-20">◀</button>
                    <button id="next-img" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/80 text-white p-3 hover:text-red-600 transition-all z-20">▶</button>
                    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/50 z-20" id="img-counter">1 / ${images.length}</div>
                ` : ''}
            </div>
            <div class="text-left">
                <h2 class="text-2xl font-black italic uppercase text-red-600 mb-2">${p.name || ''}</h2>
                <div class="flex items-baseline gap-3 mb-4">
                    <span class="text-white font-bold text-3xl">${p.price}₾</span>
                </div>
                <p class="text-gray-400 text-xs leading-relaxed border-l-2 border-red-600 pl-4 mb-6 whitespace-pre-line">${p.desc || 'აღწერა არ არის.'}</p>

                <div class="flex flex-col gap-2">
                    <button ${inStock ? `onclick="window.order('${p.id}'); window.closeDetails()"` : 'disabled'} class="buy-btn">შეკვეთა</button>
                    <button onclick="window.shareProduct('${p.id}')" class="details-btn bg-white/10 hover:bg-white/20 text-white">ლინკის კოპირება / გაზიარება</button>
                    <button onclick="window.closeDetails()" class="details-btn">დახურვა</button>
                </div>
            </div>
        </div>
    `;

    if(images.length > 1) {
        const imgEl = document.getElementById('modal-slider-img');
        const counterEl = document.getElementById('img-counter');

        const updateImage = () => {
            imgEl.src = images[currentIdx];
            counterEl.innerText = `${currentIdx + 1} / ${images.length}`;
        };

        document.getElementById('prev-img').onclick = (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx - 1 + images.length) % images.length;
            updateImage();
        };
        document.getElementById('next-img').onclick = (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx + 1) % images.length;
            updateImage();
        };
    }
    modal.style.display = 'flex';
};

window.closeDetails = () => { 
    const modal = document.getElementById('details-modal-overlay'); 
    if (modal) {
        modal.style.display = 'none';
        const cleanUrl = window.location.pathname;
        window.history.pushState({ path: cleanUrl }, '', cleanUrl);
    }
};

window.order = async (id) => {
    const user = auth.currentUser;
    if(!user) { window.primeShow("შესვლა აუცილებელია!"); window.scrollToAuth(); return; }
    const p = allProducts.find(item => item.id === id);
    if(!p) return;
    const name = p.name || '';
    try {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        const data = uDoc.data();
        if(!data || !data.phone || !data.address) { window.primeShow("მიუთითეთ ნომერი და მისამართი პროფილში!"); window.toggleProfile(); return; }
        window.primeShow(`ადასტურებთ შეკვეთას: ${name}?`, true, async () => {
            try {
                const referrerId = localStorage.getItem('prime_referrer') || 'Organic';
                const orderCode = await generateUniqueOrderCode();
                const orderInfo = {
                    product: name,
                    email: user.email,
                    userId: user.uid,
                    phone: data.phone,
                    address: data.address,
                    timestamp: Date.now(),
                    time: new Date().toLocaleString('ka-GE'),
                    referrer: referrerId,
                    orderCode: orderCode
                };
                await addDoc(collection(db, "orders"), orderInfo);
                await set(ref(rtdb, 'orders_live/' + user.uid + '_' + Date.now()), orderInfo);
                
                const botToken = '8553271170:AAH0KHkLVYREkcuOoafOgeBFc5-m3hCc8xs';
                const mainGroupId = '-1004329787412';
                const fitrockGroupId = '-1002388694200';
                
                const encodedAddress = encodeURIComponent(`${data.address}, თბილისი`);
                const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                
                const htmlText = `🚀 <b>ახალი შეკვეთა!</b>\n` +
                                 `📦 <b>პროდუქტი:</b> ${name}\n` +
                                 `📞 <b>ტელეფონი:</b> ${data.phone}\n` +
                                 `📍 <b>მისამართი:</b> ${data.address}\n` +
                                 `🗺 <a href="${mapsLink}">გახსნა რუკაზე</a>\n` +
                                 `🔗 <b>წყარო:</b> <code>${referrerId}</code>\n` +
                                 `🔑 <b>კოდი:</b> <code>#${orderCode}</code>`;

                const sendToTelegram = (chatId) => {
                    fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&parse_mode=HTML&text=${encodeURIComponent(htmlText)}`)
                        .then(r => r.json())
                        .then(res => { 
                            if (!res.ok) {
                                console.error("Telegram API error:", res);
                            } else {
                                console.log("Telegram notification sent successfully!");
                            }
                        })
                        .catch(e => console.error("Telegram network error:", e));
                };

                sendToTelegram(mainGroupId);
                if (name.toLowerCase().includes('fitrock')) sendToTelegram(fitrockGroupId);
                
                window.primeShow(`შეკვეთა გაიგზავნა! კოდი: ${orderCode}`);
                if (user) loadUserOrders(user.uid);
            } catch (innerError) { window.primeShow("შეცდომა: " + innerError.message); }
        });
    } catch (authError) { console.error(authError); }
};

async function loadUserOrders(uid) {
    const orderList = document.getElementById('order-list');
    if (!orderList) return;
    try {
        const q = query(collection(db, "orders"), where("userId", "==", uid));
        const snap = await getDocs(q);
        currentUserOrders = [];
        snap.forEach(docSnap => currentUserOrders.push({ id: docSnap.id, ...docSnap.data() }));
        currentUserOrders.sort((a, b) => b.timestamp - a.timestamp);

        if (currentUserOrders.length === 0) {
            orderList.innerHTML = `
                <div class="flex flex-col items-center justify-center h-48 border border-dashed border-white/5 bg-black/20">
                    <span class="material-icons text-gray-700 text-3xl mb-2">shopping_bag</span>
                    <p class="text-gray-500 text-[10px] uppercase tracking-wider">ჯერჯერობით შეკვეთები არ ფიქსირდება</p>
</div>`;
        } else {
            orderList.innerHTML = currentUserOrders.map(o => {
                const cleanTime = o.time ? o.time.split(',')[0] : '';
                return `
                <div class="dashboard-order-item p-4 flex items-center justify-between gap-4" style="clip-path: polygon(3% 0, 100% 0, 100% 85%, 97% 100%, 0 100%, 0 15%);">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                            <span class="material-icons text-red-600 text-sm">layers</span>
                        </div>
                        <div>
                            <h4 class="text-[11px] font-bold uppercase text-white tracking-tight">${o.product}</h4>
                            <p class="text-[9px] text-gray-500 mt-0.5">${cleanTime}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] font-mono bg-white/5 border border-white/10 text-gray-300 px-2.5 py-1 uppercase tracking-wider">
                            ID: <span class="text-red-500">#${o.orderCode || 'N/A'}</span>
                        </span>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (e) {
        console.error("Error loading orders:", e);
        orderList.innerHTML = `
            <div class="flex items-center gap-2 text-red-600 text-[10px] uppercase p-4 border border-red-600/20 bg-red-600/5">
                <span class="material-icons text-sm">error</span> ისტორიის ჩატვირთვა ვერ მოხერხდა
            </div>`;
    }
}

function renderPagination(total) {
    const container = document.getElementById('pagination-bottom');
    if (!container) return;
    if (total <= 1) { container.innerHTML = ''; return; }
    container.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const active = i === currentPage ? 'bg-red-600 text-white' : 'text-gray-500 border-white/10';
        container.innerHTML += `<button onclick="window.goToPage(${i})" class="w-10 h-10 border font-bold transition-all ${active}">${i}</button>`;
    }
}

window.goToPage = (p) => { currentPage = p; window.filterProducts(); const shopSec = document.getElementById('shop'); if(shopSec) shopSec.scrollIntoView({behavior: 'smooth'}); };

async function loadUserProfile(uid) {
    const d = await getDoc(doc(db, "users", uid));
    if(d.exists()) {
        const data = d.data();
        if(document.getElementById('u-phone-upd')) document.getElementById('u-phone-upd').value = data.phone || '';
        if(document.getElementById('u-address-upd')) document.getElementById('u-address-upd').value = data.address || '';
    }
}

window.updateProfile = async () => {
    const user = auth.currentUser;
    if(user) {
        try {
            await setDoc(doc(db, "users", user.uid), {
                phone: document.getElementById('u-phone-upd').value,
                address: document.getElementById('u-address-upd').value
            }, { merge: true });
            window.primeShow("პროფილი განახლდა!");
            window.toggleProfile();
        } catch(e) {
            window.primeShow("შეცდომა: " + e.message);
        }
    }
};

window.handleLogin = async () => {
    const emailField = document.getElementById('l-email');
    const passField = document.getElementById('l-pass');
    if (!emailField || !passField) return;
    const email = emailField.value;
    const pass = passField.value;
    try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { window.primeShow("შეცდომა: " + e.message); }
};

window.handleRegister = async () => {
    const emailField = document.getElementById('r-email');
    const passField = document.getElementById('r-pass');
    const phoneField = document.getElementById('r-phone');
    const addrField = document.getElementById('r-address');
    if (!emailField || !passField) return;
    const email = emailField.value;
    const pass = passField.value;
    const phone = phoneField ? phoneField.value : '';
    const addr = addrField ? addrField.value : '';
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", res.user.uid), { email, phone, address: addr, role: "user" });
        window.primeShow("რეგისტრაცია წარმატებულია!");
    } catch(e) { window.primeShow("შეცდომა: " + e.message); }
};

window.handleLogout = () => signOut(auth).then(() => location.reload());
window.toggleProfile = () => { const modal = document.getElementById('profile-modal'); if(modal) modal.classList.toggle('hidden'); };
window.toggleAuth = () => { 
    const lForm = document.getElementById('login-form');
    const rForm = document.getElementById('register-form');
    if(lForm && rForm) {
        lForm.classList.toggle('hidden'); 
        rForm.classList.toggle('hidden'); 
    }
};
window.scrollToAuth = () => { const sec = document.getElementById('auth-section'); if(sec) sec.classList.remove('hidden'); };
