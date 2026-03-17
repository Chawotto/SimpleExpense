import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { financeUtils } from "./utils.js";

const firebaseConfig = {
   
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let expensesData = [];
let goalsData =[];
let chartInstance = null;
let currentCurrency = localStorage.getItem('currency') || 'RUB';

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

    // Цели
    goalsContainer: document.getElementById('goals-container'),
    goalsEmptyState: document.getElementById('goals-empty-state'),
    addGoalBtn: document.getElementById('add-goal-btn'),
    goalModal: document.getElementById('goal-modal'),
    closeGoalModal: document.getElementById('close-goal-modal'),
    saveGoalBtn: document.getElementById('save-goal'),
    goalTitleInput: document.getElementById('goal-title'),
    goalTargetInput: document.getElementById('goal-target'),

    // Редактирование
    editModal: document.getElementById('edit-modal'),
    editTitle: document.getElementById('edit-title'),
    editAmount: document.getElementById('edit-amount'),
    saveEdit: document.getElementById('save-edit'),
    closeEditModal: document.getElementById('close-modal'),

    // Кастомный Confirm (UX ЛР6)
    confirmModal: document.getElementById('confirm-modal'),
    confirmCancelBtn: document.getElementById('cancel-confirm'),
    confirmOkBtn: document.getElementById('ok-confirm')
};

const CONFIG = {
    currencies: { 'RUB': { locale: 'ru-RU' }, 'BYN': { locale: 'be-BY' }, 'USD': { locale: 'en-US' }, 'EUR': { locale: 'de-DE' } },
    categories: {
        expense:[ { id: 'food', name: 'Еда', icon: 'fa-burger', color: '#EF4444' }, { id: 'transport', name: 'Транспорт', icon: 'fa-taxi', color: '#F59E0B' }, { id: 'home', name: 'Жилье', icon: 'fa-house', color: '#6366F1' }, { id: 'shop', name: 'Шопинг', icon: 'fa-bag-shopping', color: '#EC4899' }, { id: 'fun', name: 'Развлечения', icon: 'fa-gamepad', color: '#8B5CF6' } ],
        income:[ { id: 'salary', name: 'Зарплата', icon: 'fa-money-bill-wave', color: '#10B981' }, { id: 'gift', name: 'Подарок', icon: 'fa-gift', color: '#3B82F6' }, { id: 'other', name: 'Другое', icon: 'fa-circle-plus', color: '#64748B' } ]
    }
};

function showConfirmDialog(onConfirm) {
    els.confirmModal.classList.remove('hidden');

    els.confirmCancelBtn.onclick = () => {
        els.confirmModal.classList.add('hidden');
    };

    els.confirmOkBtn.onclick = () => {
        els.confirmModal.classList.add('hidden');
        onConfirm();
    };
}


function formatMoney(amount) {
    const locale = CONFIG.currencies[currentCurrency]?.locale || 'ru-RU';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currentCurrency }).format(amount);
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${msg}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function init() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    if(els.currencySelect) els.currencySelect.value = currentCurrency;
    if(els.date) els.date.valueAsDate = new Date();
    updateCategoryOptions('expense');

    // Добавляем поддержку Enter для радио-кнопок (Accessibility)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') document.getElementById(btn.getAttribute('for')).click();
        });
    });
}
init();

// --- АВТОРИЗАЦИЯ ---
els.login.onclick = () => signInWithPopup(auth, provider).catch(err => showToast('Ошибка входа', 'error'));
els.logout.onclick = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        els.auth.classList.add('hidden');
        els.app.classList.remove('hidden');
        els.avatar.src = user.photoURL;
        els.name.textContent = user.displayName.split(' ')[0];
        subscribeToFirestore();
    }
});

// --- FIREBASE ---
function subscribeToFirestore() {
    const qExp = query(collection(db, "expenses"), where("uid", "==", currentUser.uid), orderBy("date", "desc"));
    onSnapshot(qExp, (snapshot) => {
        expensesData =[];
        snapshot.forEach(doc => expensesData.push({ id: doc.id, ...doc.data() }));
        renderAll();
    });

    const qGoals = query(collection(db, "goals"), where("uid", "==", currentUser.uid));
    onSnapshot(qGoals, (snapshot) => {
        goalsData =[];
        snapshot.forEach(doc => goalsData.push({ id: doc.id, ...doc.data() }));
        renderGoals();
    });
}

// --- ОТРИСОВКА ---
function renderAll() {
    const totals = financeUtils.calculateTotals(expensesData);
    els.totalIncome.innerText = formatMoney(totals.income);
    els.totalExpense.innerText = formatMoney(totals.expense);
    els.totalBalance.innerText = formatMoney(totals.balance);
    renderList();
    renderChart();
    renderGoals();
}

function renderList() {
    els.container.innerHTML = '';
    if (expensesData.length === 0) {
        els.empty.classList.remove('hidden');
        return;
    }
    els.empty.classList.add('hidden');

    expensesData.forEach(item => {
        const catList = CONFIG.categories[item.type || 'expense'];
        const cat = catList.find(c => c.id === item.category) || catList[0];
        const el = document.createElement('div');
        el.className = 'transaction-item';
        el.innerHTML = `
            <div class="t-left">
                <div class="icon-box" style="background: ${cat.color}15; color: ${cat.color}"><i class="fa-solid ${cat.icon}"></i></div>
                <div class="t-info"><span class="t-title">${item.title}</span><span class="t-cat">${cat.name}</span></div>
            </div>
            <div class="t-right">
                <span class="t-amount ${item.type === 'income' ? 'income' : 'expense'}">${item.type === 'income' ? '+' : '-'}${formatMoney(item.amount)}</span>
            </div>
            <div class="t-actions">
                <button class="mini-btn edit" onclick="window.editItem('${item.id}')" aria-label="Редактировать"><i class="fa-solid fa-pen"></i></button>
                <button class="mini-btn del" onclick="window.deleteItem('${item.id}')" aria-label="Удалить"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        els.container.appendChild(el);
    });
}

function renderGoals() {
    els.goalsContainer.innerHTML = '';

    if (goalsData.length === 0) {
        els.goalsEmptyState.classList.remove('hidden');
        return;
    }
    els.goalsEmptyState.classList.add('hidden');

    const totals = financeUtils.calculateTotals(expensesData);

    goalsData.forEach(goal => {
        const progress = financeUtils.calculateGoalProgress(totals.balance, goal.target);
        const div = document.createElement('div');
        div.className = `goal-item ${progress >= 100 ? 'completed' : ''}`;
        div.innerHTML = `
            <div class="goal-info"><span>${goal.title}</span><span>${formatMoney(goal.target)}</span></div>
            <div class="goal-progress-bg"><div class="goal-progress-fill" style="width: ${progress}%"></div></div>
            <span class="goal-percentage">${progress}% накоплено</span>
        `;
        els.goalsContainer.appendChild(div);
    });
}

// --- CRUD ---
els.form.onsubmit = async (e) => {
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
        showToast('Запись успешно добавлена');
    } catch (err) { showToast('Ошибка при сохранении', 'error'); }
};

els.addGoalBtn.onclick = () => {
    els.goalModal.classList.remove('hidden');
    els.goalTitleInput.focus();
};
els.closeGoalModal.onclick = () => els.goalModal.classList.add('hidden');

els.saveGoalBtn.onclick = async () => {
    const title = els.goalTitleInput.value;
    const target = Number(els.goalTargetInput.value);
    if(!title || !target) return;

    await addDoc(collection(db, "goals"), { uid: currentUser.uid, title, target });
    els.goalModal.classList.add('hidden');
    showToast('Цель поставлена!');
    els.goalTitleInput.value = ''; els.goalTargetInput.value = '';
};

window.deleteItem = (id) => {
    showConfirmDialog(async () => {
        await deleteDoc(doc(db, "expenses", id));
        showToast('Запись удалена');
    });
};

window.editItem = (id) => {
    const item = expensesData.find(i => i.id === id);
    if (!item) return;
    window.editingId = id;
    els.editTitle.value = item.title;
    els.editAmount.value = item.amount;
    els.editModal.classList.remove('hidden');
    els.editTitle.focus();
};

els.saveEdit.onclick = async () => {
    await updateDoc(doc(db, "expenses", window.editingId), {
        title: els.editTitle.value,
        amount: Number(els.editAmount.value)
    });
    els.editModal.classList.add('hidden');
    showToast('Данные обновлены');
};

els.closeEditModal.onclick = () => els.editModal.classList.add('hidden');

// --- INTERFACE ---
function updateCategoryOptions(type) {
    els.category.innerHTML = CONFIG.categories[type].map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', (e) => updateCategoryOptions(e.target.value));
});

els.themeToggle.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    els.themeToggle.innerHTML = next === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
};

els.currencySelect.onchange = (e) => {
    currentCurrency = e.target.value;
    localStorage.setItem('currency', currentCurrency);
    renderAll();
};

function renderChart() {
    const ctx = document.getElementById('expensesChart').getContext('2d');
    const expenses = expensesData.filter(i => i.type === 'expense');
    const cats = {};
    expenses.forEach(i => cats[i.category] = (cats[i.category] || 0) + i.amount);

    if (chartInstance) chartInstance.destroy();
    if (expenses.length === 0) return;

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats).map(id => CONFIG.categories.expense.find(c => c.id === id)?.name || id),
            datasets:[{
                data: Object.values(cats),
                backgroundColor:['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '75%' }
    });
}