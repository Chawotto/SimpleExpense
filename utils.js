export const financeUtils = {
    calculateTotals: (data) => {
        let income = 0;
        let expense = 0;
        data.forEach(item => {
            if (item.type === 'income') income += item.amount;
            else expense += item.amount;
        });
        return { income, expense, balance: income - expense };
    },

    calculateGoalProgress: (currentBalance, targetAmount) => {
        if (targetAmount <= 0) return 0;
        let progress = (currentBalance / targetAmount) * 100;
        if (progress < 0) progress = 0;
        if (progress > 100) progress = 100;
        return parseFloat(progress.toFixed(1));
    }
};