import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ВСТАВЬ КОНФИГ СЮДА ---
const firebaseConfig = {
    apiKey: "AIzaSy.....",
    authDomain: "simpleexpense-lab.firebaseapp.com",
    projectId: "simpleexpense-lab",
    storageBucket: "simpleexpense-lab.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};
// -------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Состояние
let currentUser = null;
let expensesData = [];
let chartInstance = null;
let editingId = null;

// DOM Элементы
const els = {
    auth: document.getElementById('auth-section'),
    app: document.getElementById('app-section'),
    login: document.getElementById('login-btn'),
    logout: document.getElementById('logout-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    avatar: document.getElementById('user-avatar'),
    name: document.getElementById('user-name'),

    // Баланс
    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    filter: document.getElementById('filter-month'),

    // Форма
    form: document.getElementById('expense-form'),
    title: document.getElementById('title-input'),
    amount: document.getElementById('amount-input'),
    category: document.getElementById('category-input'),
    date: document.getElementById('date-input'),
    typeRadios: document.getElementsByName('type'),

    // Список
    container: document.getElementById('transactions-container'),
    loader: document.getElementById('loader'),
    empty: document.getElementById('empty-state'),

    // Модалка
    modal: document.getElementById('edit-modal'),
    modalClose: document.getElementById('close-modal'),
    editTitle: document.getElementById('edit-title'),
    editAmount: document.getElementById('edit-amount'),
    saveEdit: document.getElementById('save-edit')
};

// Конфигурация категорий
const CATEGORIES = {
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
};

// --- INIT ---
initTheme();
els.dateInput.valueAsDate = new Date();
updateCategoryOptions('expense'); // По умолчанию расход

// Слушатель смены типа (Доход/Расход)
document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        updateCategoryOptions(e.target.value);
    });
});

function updateCategoryOptions(type) {
    els.category.innerHTML = CATEGORIES[type].map(c =>
        `<option value="${c.id}">${c.name}</option>`
    ).join('');
}

// --- AUTH ---
els.login.addEventListener('click', () => signInWithPopup(auth, provider).catch(err => showToast('Ошибка входа', 'error')));
els.logout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        els.auth.classList.add('hidden');
        els.app.classList.remove('hidden');
        els.avatar.src = user.photoURL;
        els.name.textContent = user.displayName.split(' ')[0];
        subscribeToData();
        showToast(`Добро пожаловать, ${user.displayName.split(' ')[0]}!`, 'success');
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
        if(error.code === 'failed-precondition') alert("Требуется индекс! См. консоль.");
    });
}

// --- LOGIC & RENDER ---
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

    // Анимация чисел
    animateValue(els.totalIncome, income);
    animateValue(els.totalExpense, expense);
    animateValue(els.totalBalance, income - expense);
}

function renderList(data) {
    els.container.innerHTML = '';

    if (data.length === 0) {
        els.empty.classList.remove('hidden');
        return;
    }
    els.empty.classList.add('hidden');

    // Группировка по дате
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
            const catConfig = [...CATEGORIES.expense, ...CATEGORIES.income].find(c => c.id === item.category) || CATEGORIES.expense[0];
            const isIncome = item.type === 'income';

            const el = document.createElement('div');
            el.className = 'transaction-item';
            el.innerHTML = `
                <div class="t-left">
                    <div class="icon-box" style="background: ${catConfig.color}20; color: ${catConfig.color}">
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
                    <button class="mini-btn edit" onclick="editItem('${item.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="mini-btn del" onclick="deleteItem('${item.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            dayGroup.appendChild(el);
        });
        els.container.appendChild(dayGroup);
    });
}

function renderChart(data) {
    const ctx = document.getElementById('expensesChart').getContext('2d');
    const expenses = data.filter(i => i.type === 'expense');

    // Группировка по категориям
    const cats = {};
    expenses.forEach(i => {
        cats[i.category] = (cats[i.category] || 0) + i.amount;
    });

    if (Object.keys(cats).length === 0) {
        if (chartInstance) {
            chartInstance.data.datasets[0].data = [];
            chartInstance.update();
        }
        return;
    }

    const labels = Object.keys(cats).map(id => CATEGORIES.expense.find(c => c.id === id)?.name || id);
    const colors = Object.keys(cats).map(id => CATEGORIES.expense.find(c => c.id === id)?.color || '#ccc');

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: Object.values(cats),
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
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
        showToast('Запись добавлена', 'success');
    } catch (err) {
        showToast('Ошибка добавления', 'error');
    }
});

window.deleteItem = async (id) => {
    if(confirm('Удалить запись?')) {
        try {
            await deleteDoc(doc(db, "expenses", id));
            showToast('Удалено', 'success');
        } catch(e) { showToast('Ошибка', 'error'); }
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
    try {
        await updateDoc(doc(db, "expenses", editingId), {
            title: els.editTitle.value,
            amount: Number(els.editAmount.value)
        });
        els.modal.classList.add('hidden');
        showToast('Обновлено', 'success');
    } catch(e) { showToast('Ошибка', 'error'); }
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

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${msg}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatMoney(num) {
    return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';

    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

function animateValue(obj, end) {
    const start = parseInt(obj.innerText.replace(/\D/g, '')) || 0;
    if (start === end) return;
    const duration = 500;
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerText = formatMoney(current);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}