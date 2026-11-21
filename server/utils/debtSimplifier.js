function calculateSettlements(members, expenses) {
  const balances = {};
  members.forEach((m) => (balances[m] = 0));

  // 1. Calculate net balance per person (+ means owed money, - means owes money)
  expenses.forEach(({ amount, paidBy, splitAmong }) => {
    if (!splitAmong || splitAmong.length === 0) return;
    const share = amount / splitAmong.length;

    balances[paidBy] = (balances[paidBy] || 0) + amount;
    splitAmong.forEach((person) => {
      balances[person] = (balances[person] || 0) - share;
    });
  });

  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([person, bal]) => {
    const rounded = Math.round(bal * 100) / 100;
    if (rounded < -0.01) debtors.push({ person, amount: -rounded });
    else if (rounded > 0.01) creditors.push({ person, amount: rounded });
  });

  // 2. Match largest debtor with largest creditor to minimize transactions
  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const payAmount = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({
      from: debtors[i].person,
      to: creditors[j].person,
      amount: Math.round(payAmount * 100) / 100,
    });

    debtors[i].amount -= payAmount;
    creditors[j].amount -= payAmount;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return { balances, settlements };
}

module.exports = { calculateSettlements };
