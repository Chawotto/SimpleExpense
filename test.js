import { financeUtils } from "./utils.js";

console.log("🧪 ЗАПУСК UNIT-ТЕСТОВ...");

const mockData = [
    { type: 'income', amount: 1000 },
    { type: 'expense', amount: 400 },
    { type: 'expense', amount: 100 }
];

// Тест 1: Расчет баланса
const totals = financeUtils.calculateTotals(mockData);
if (totals.balance === 500 && totals.income === 1000 && totals.expense === 500) {
    console.log("✅ Тест 1 (Totals): Пройден");
} else {
    console.error("❌ Тест 1 (Totals): Ошибка!", totals);
}

// Тест 2: Расчет процентов цели
const progress = financeUtils.calculateGoalProgress(500, 2000);
if (progress === 25.0) {
    console.log("✅ Тест 2 (Goal Progress): Пройден");
} else {
    console.error("❌ Тест 2 (Goal Progress): Ошибка!", progress);
}

// Тест 3: Грантичные значения (цель 0)
const zeroProgress = financeUtils.calculateGoalProgress(500, 0);
if (zeroProgress === 0) {
    console.log("✅ Тест 3 (Zero Target): Пройден");
} else {
    console.error("❌ Тест 3 (Zero Target): Ошибка!");
}