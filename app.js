const titleInput = document.getElementById('title-input');
const amountInput = document.getElementById('amount-input');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('expense-list');
const totalSpan = document.getElementById('total-amount');

let expenses = [];

addBtn.addEventListener('click', () => {
    const title = titleInput.value;
    const amount = Number(amountInput.value);

    if (title === '' || amount <= 0) {
        alert('Введите корректные данные');
        return;
    }

    const expense = {
        id: Date.now(),
        title: title,
        amount: amount
    };

    expenses.push(expense);
    render();

    // Очистка полей
    titleInput.value = '';
    amountInput.value = '';
});

function render() {
    list.innerHTML = '';
    let sum = 0;
    expenses.forEach(exp => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${exp.title}</span>
            <div>
                <b>${exp.amount} руб.</b>
            </div>
        `;
        list.appendChild(li);
        sum += exp.amount;
    });
    totalSpan.innerText = sum;
}