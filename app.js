import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- КОНФИГ ---
const firebaseConfig = {
    apiKey: "AIzaSy.....",
    authDomain: "simpleexpense-lab.firebaseapp.com",
    projectId: "simpleexpense-lab",
    storageBucket: "simpleexpense-lab.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};
// -------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Состояние
let currentUser = null;
let expensesData = [];
let chartInstance = null;
let editingId = null;
let currentCurrency = localStorage.getItem('currency') || 'RUB'; // Дефолтная валюта

// DOM Элементы
const els = {
    auth: document.getElementById('auth-section'),
    app: document.getElementById('app-section'),
    login: document.getElementById('login-btn'),
    logout: document.getElementById('logout-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    currencySelect: document.getElementById('currency-select'),
    avatar: document.getElementById('user-avatar'),
    name: document.getElementById('user-name'),

    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    filter: document.getElementById('filter-month'),

    form: document.getElementById('expense-form'),
    title: document.getElementById('title-input'),
    amount: document.getElementById('amount-input'),
    category: document.getElementById('category-input'),
    date: document.getElementById('date-input'),

    container: document.getElementById('transactions-container'),
    loader: document.getElementById('loader'),
    empty: document.getElementById('empty-state'),

    modal: document.getElementById('edit-modal'),
    modalClose: document.getElementById('close-modal'),
    editTitle: document.getElementById('edit-title'),
    editAmount: document.getElementById('edit-amount'),
    saveEdit: document.getElementById('save-edit')
};

// Конфигурация
const CONFIG = {
    currencies: {
        'RUB': { locale: 'ru-RU', symbol: '₽' },
        'BYN': { locale: 'be-BY', symbol: 'Br' },
        'USD': { locale: 'en-US', symbol: '$' },
        'EUR': { locale: 'de-DE', symbol: '€' }
    },
    categories: {
        expense: [
            { id: 'food', name: 'Еда', icon: 'fa-burger', color: '#EF4444' },
            { id: 'transport', name: 'Транспорт', icon: 'fa-taxi', color: '#F59E0B' },
            { id: 'home', name: 'Жилье', icon: 'fa-house', color: '#6366F1' },
            { id: 'shop', name: 'Шопинг', icon: 'fa-bag-shopping', color: '#EC4899' },
            { id: 'fun', name: 'Развлечения', icon: 'fa-gamepad', color: '#8B5CF6' }
        ],
        income: [
            { id: 'salary', name: 'Зарплата', icon: 'fa-money-bill-wave', color: '#10B981' },
            { id: 'gift', name: 'Подарок', icon: 'fa-gift', color: '#3B82F6' },
            { id: 'other', name: 'Другое', icon: 'fa-circle-plus', color: '#64748B' }
        ]
    }
};

// --- INIT ---
initTheme();
initCurrency();
if(els.date) els.date.valueAsDate = new Date();
updateCategoryOptions('expense');

document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', (e) => updateCategoryOptions(e.target.value));
});

function updateCategoryOptions(type) {
    els.category.innerHTML = CONFIG.categories[type].map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// --- CURRENCY LOGIC ---
function initCurrency() {
    els.currencySelect.value = currentCurrency;
    els.currencySelect.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        localStorage.setItem('currency', currentCurrency);
        renderAll(); // Перерисовка с новой валютой
    });
}

function formatMoney(amount) {
    const conf = CONFIG.currencies[currentCurrency];
    return new Intl.NumberFormat(conf.locale, {
        style: 'currency',
        currency: currentCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

// --- AUTH ---
els.login.addEventListener('click', () => signInWithPopup(auth, provider).catch(e => showToast('Ошибка входа', 'error')));
els.logout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        els.auth.classList.add('hidden');
        els.app.classList.remove('hidden');
        els.avatar.src = user.photoURL;
        els.name.textContent = user.displayName ? user.displayName.split(' ')[0] : 'User';
        subscribeToData();
        showToast('Добро пожаловать!', 'success');
    } else {
        currentUser = null;
        els.app.classList.add('hidden');
        els.auth.classList.remove('hidden');
    }
});

// --- FIRESTORE ---
function subscribeToData() {
    els.loader.classList.remove('hidden');
    const q = query(collection(db, "expenses"), where("uid", "==", currentUser.uid), orderBy("date", "desc"));

    onSnapshot(q, (snapshot) => {
        els.loader.classList.add('hidden');
        expensesData = [];
        snapshot.forEach(doc => expensesData.push({ id: doc.id, ...doc.data() }));
        renderAll();
    }, (error) => {
        console.error(error);
        if(error.code === 'failed-precondition') alert("Ошибка: Создай индекс в Firebase Console (см. F12)");
    });
}

// --- RENDER ---
els.filter.addEventListener('change', renderAll);

function renderAll() {
    const filter = els.filter.value;
    let filtered = expensesData;

    if (filter === 'current') {
        const month = new Date().toISOString().slice(0, 7);
        filtered = expensesData.filter(item => item.date.startsWith(month));
    }

    renderStats(filtered);
    renderList(filtered);
    renderChart(filtered);
}

function renderStats(data) {
    let income = 0, expense = 0;
    data.forEach(item => {
        if (item.type === 'income') income += item.amount;
        else expense += item.amount;
    });

    els.totalIncome.innerText = formatMoney(income);
    els.totalExpense.innerText = formatMoney(expense);
    els.totalBalance.innerText = formatMoney(income - expense);
}

function renderList(data) {
    els.container.innerHTML = '';

    if (data.length === 0) {
        els.empty.classList.remove('hidden');
        return;
    }
    els.empty.classList.add('hidden');

    const grouped = data.reduce((groups, item) => {
        const date = item.date;
        if (!groups[date]) groups[date] = [];
        groups[date].push(item);
        return groups;
    }, {});

    Object.keys(grouped).sort().reverse().forEach(date => {
        const dayGroup = document.createElement('div');
        dayGroup.className = 'date-group';
        dayGroup.innerHTML = `<h4>${formatDate(date)}</h4>`;

        grouped[date].forEach(item => {
            const catType = item.type || 'expense';
            const catList = CONFIG.categories[catType] || CONFIG.categories.expense;
            const catConfig = catList.find(c => c.id === item.category) || catList[0];
            const isIncome = item.type === 'income';

            const el = document.createElement('div');
            el.className = 'transaction-item';
            el.innerHTML = `
                <div class="t-left">
                    <div class="icon-box" style="background: ${catConfig.color}15; color: ${catConfig.color}">
                        <i class="fa-solid ${catConfig.icon}"></i>
                    </div>
                    <div class="t-info">
                        <span class="t-title">${item.title}</span>
                        <span class="t-cat">${catConfig.name}</span>
                    </div>
                </div>
                <div class="t-right">
                    <span class="t-amount ${isIncome ? 'income' : 'expense'}">
                        ${isIncome ? '+' : '-'}${formatMoney(item.amount)}
                    </span>
                </div>
                <div class="t-actions">
                    <button class="mini-btn edit" onclick="window.editItem('${item.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="mini-btn del" onclick="window.deleteItem('${item.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            dayGroup.appendChild(el);
        });
        els.container.appendChild(dayGroup);
    });
}

function renderChart(data) {
    const ctx = document.getElementById('expensesChart').getContext('2d');
    const expenses = data.filter(i => (!i.type || i.type === 'expense'));

    const cats = {};
    expenses.forEach(i => { cats[i.category] = (cats[i.category] || 0) + i.amount; });

    const labels = Object.keys(cats).map(id =>
        CONFIG.categories.expense.find(c => c.id === id)?.name || id
    );
    const colors = Object.keys(cats).map(id =>
        CONFIG.categories.expense.find(c => c.id === id)?.color || '#ccc'
    );

    if (chartInstance) chartInstance.destroy();

    // Кастомный тултип для валюты
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: Object.values(cats),
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${formatMoney(context.raw)}`;
                        }
                    }
                }
            },
            cutout: '75%'
        }
    });
}

// --- CRUD ---
els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;

    try {
        await addDoc(collection(db, "expenses"), {
            uid: currentUser.uid,
            title: els.title.value,
            amount: Number(els.amount.value),
            category: els.category.value,
            date: els.date.value,
            type: type,
            createdAt: new Date().toISOString()
        });
        els.form.reset();
        els.date.valueAsDate = new Date();
        showToast('Сохранено', 'success');
    } catch (err) { showToast('Ошибка', 'error'); }
});

window.deleteItem = async (id) => {
    if(confirm('Удалить?')) {
        await deleteDoc(doc(db, "expenses", id));
        showToast('Удалено', 'success');
    }
};

window.editItem = (id) => {
    const item = expensesData.find(i => i.id === id);
    if (!item) return;
    editingId = id;
    els.editTitle.value = item.title;
    els.editAmount.value = item.amount;
    els.modal.classList.remove('hidden');
};

els.saveEdit.addEventListener('click', async () => {
    if(!editingId) return;
    await updateDoc(doc(db, "expenses", editingId), {
        title: els.editTitle.value,
        amount: Number(els.editAmount.value)
    });
    els.modal.classList.add('hidden');
    showToast('Обновлено', 'success');
});

els.modalClose.addEventListener('click', () => els.modal.classList.add('hidden'));

// --- THEME & UTILS ---
els.themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    els.themeToggle.innerHTML = isDark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
});

function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', saved);
    if (saved === 'dark') els.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
}

function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${msg}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';

    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}