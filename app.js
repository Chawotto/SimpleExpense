import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ВСТАВЬ КОНФИГ СЮДА ---
const firebaseConfig = {
  apiKey: "AIzaSyCrnduwAzlj_Qw17GsOAYqs9AhDxZPGUBM",
  authDomain: "simpleexpense-lab.firebaseapp.com",
  projectId: "simpleexpense-lab",
  storageBucket: "simpleexpense-lab.firebasestorage.app",
  messagingSenderId: "975594715737",
  appId: "1:975594715737:web:884b43c0a3fc4be9cccf48"
};
// -------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Переменные состояния
let currentUser = null;
let unsubscribe = null;
let expensesData = []; // Храним данные локально для графиков и фильтров
let expenseChart = null; // Объект графика
let editingId = null; // ID записи, которую редактируем

// DOM элементы
const els = {
    auth: document.getElementById('auth-section'),
    app: document.getElementById('app-section'),
    login: document.getElementById('login-btn'),
    logout: document.getElementById('logout-btn'),
    avatar: document.getElementById('user-avatar'),
    name: document.getElementById('user-name'),
    form: document.getElementById('expense-form'),
    list: document.getElementById('expense-list'),
    total: document.getElementById('total-amount'),
    filter: document.getElementById('filter-month'),
    dateInput: document.getElementById('date-input'),
    loader: document.getElementById('loader'),
    empty: document.getElementById('empty-state'),
    // Модальное окно
    modal: document.getElementById('edit-modal'),
    editTitle: document.getElementById('edit-title'),
    editAmount: document.getElementById('edit-amount'),
    cancelEdit: document.getElementById('cancel-edit'),
    saveEdit: document.getElementById('save-edit')
};

// Установка сегодняшней даты в инпут
els.dateInput.valueAsDate = new Date();

// --- АВТОРИЗАЦИЯ ---
els.login.addEventListener('click', () => signInWithPopup(auth, provider).catch(alert));
els.logout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        toggleView(true);
        els.avatar.src = user.photoURL;
        els.name.textContent = user.displayName.split(' ')[0];
        subscribeToData();
    } else {
        currentUser = null;
        toggleView(false);
        if (unsubscribe) unsubscribe();
    }
});

function toggleView(isAuth) {
    els.auth.classList.toggle('hidden', isAuth);
    els.auth.classList.toggle('active', !isAuth);
    els.app.classList.toggle('hidden', !isAuth);
    els.app.classList.toggle('active', isAuth);
}

// --- БАЗА ДАННЫХ ---
function subscribeToData() {
    els.loader.classList.remove('hidden');
    // Сортировка по дате, которую мы записываем строкой YYYY-MM-DD
    const q = query(
        collection(db, "expenses"),
        where("uid", "==", currentUser.uid),
        orderBy("date", "desc")
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        els.loader.classList.add('hidden');
        expensesData = [];

        snapshot.forEach(doc => {
            expensesData.push({ id: doc.id, ...doc.data() });
        });

        applyFilterAndRender();
    }, (error) => {
        console.error("Firestore Error:", error);
        // Если ошибка индекса, просто покажем что есть, но предупредим в консоли
        if(error.code === 'failed-precondition') alert("Требуется индекс! Проверь консоль (F12).");
    });
}

// --- ФИЛЬТРАЦИЯ И РЕНДЕР ---
els.filter.addEventListener('change', applyFilterAndRender);

function applyFilterAndRender() {
    const filterType = els.filter.value;
    let filtered = expensesData;

    if (filterType === 'current') {
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7); // "2023-10"
        filtered = expensesData.filter(e => e.date.startsWith(currentMonth));
    }

    renderList(filtered);
    updateChart(filtered);
    updateTotal(filtered);
}

function renderList(data) {
    els.list.innerHTML = '';

    if (data.length === 0) {
        els.empty.classList.remove('hidden');
        return;
    }
    els.empty.classList.add('hidden');

    const categoryIcons = {
        food: '🍔', transport: '🚖', home: '🏠', fun: '🎬', shopping: '🛍️', other: '📦'
    };

    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-info">
                <span>${categoryIcons[item.category] || '📦'} ${item.title}</span>
                <span class="item-date">${item.date.split('-').reverse().join('.')}</span>
            </div>
            <div class="item-actions">
                <span class="cost">-${item.amount} ₽</span>
                <button class="action-btn edit-btn" onclick="openEdit('${item.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-btn delete-btn" onclick="deleteItem('${item.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        els.list.appendChild(li);
    });
}

function updateTotal(data) {
    const sum = data.reduce((acc, item) => acc + item.amount, 0);
    // Анимация числа
    const start = parseInt(els.total.innerText) || 0;
    const duration = 500;
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        els.total.innerText = Math.floor(progress * (sum - start) + start);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// --- ДОБАВЛЕНИЕ ---
els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title-input').value;
    const amount = Number(document.getElementById('amount-input').value);
    const category = document.getElementById('category-input').value;
    const date = els.dateInput.value;

    try {
        await addDoc(collection(db, "expenses"), {
            uid: currentUser.uid,
            title, amount, category, date,
            createdAt: new Date().toISOString()
        });
        els.form.reset();
        els.dateInput.valueAsDate = new Date(); // Вернуть дату на сегодня
    } catch (err) {
        console.error(err);
    }
});

// --- УДАЛЕНИЕ И РЕДАКТИРОВАНИЕ (Глобальные функции) ---
window.deleteItem = async (id) => {
    if(confirm('Удалить запись?')) {
        await deleteDoc(doc(db, "expenses", id));
    }
};

window.openEdit = (id) => {
    const item = expensesData.find(e => e.id === id);
    if (!item) return;

    editingId = id;
    els.editTitle.value = item.title;
    els.editAmount.value = item.amount;
    els.modal.classList.remove('hidden');
};

els.cancelEdit.addEventListener('click', () => els.modal.classList.add('hidden'));

els.saveEdit.addEventListener('click', async () => {
    if (!editingId) return;
    const newTitle = els.editTitle.value;
    const newAmount = Number(els.editAmount.value);

    await updateDoc(doc(db, "expenses", editingId), {
        title: newTitle,
        amount: newAmount
    });

    els.modal.classList.add('hidden');
    editingId = null;
});

// --- ГРАФИК (Chart.js) ---
function updateChart(data) {
    const ctx = document.getElementById('expensesChart').getContext('2d');

    // Группировка по категориям
    const categories = {};
    data.forEach(item => {
        if (!categories[item.category]) categories[item.category] = 0;
        categories[item.category] += item.amount;
    });

    const labels = Object.keys(categories).map(k => {
        const names = {food:'Еда', transport:'Транспорт', home:'Жилье', fun:'Развл.', shopping:'Шопинг', other:'Др.'};
        return names[k] || k;
    });
    const values = Object.values(categories);

    if (expenseChart) expenseChart.destroy(); // Удаляем старый график

    // Если нет данных, показываем пустой круг
    if (values.length === 0) return;

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Скрываем легенду для компактности
            },
            cutout: '70%' // Толщина бублика
        }
    });
}