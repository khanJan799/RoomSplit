import React, { useState, useEffect } from 'react';
import { useRoomSplit } from '../../data/store';
import { PaymentSourceType } from '../../types';
import { useLanguage } from '../../i18n';

interface ExpensesScreenProps {
  isAddDrawerOpen: boolean;
  onCloseAddDrawer: () => void;
  onOpenAddDrawer: () => void;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({
  isAddDrawerOpen,
  onCloseAddDrawer,
  onOpenAddDrawer,
}) => {
  const {
    activeGroup,
    currentMember,
    expenses,
    financialSummary,
    addExpense,
  } = useRoomSplit();
  const { t } = useLanguage();

  // Add Expense form state
  const [amountInput, setAmountInput] = useState<string>('');
  const [descInput, setDescInput] = useState<string>('');
  const [dateInput, setDateInput] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentSource, setPaymentSource] = useState<PaymentSourceType>('group_fund');
  const [personalPayerId, setPersonalPayerId] = useState<string>(currentMember?.id || '');
  const [fundPortionInput, setFundPortionInput] = useState<string>('0');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    activeGroup ? activeGroup.members.map((m) => m.id) : []
  );
  const [splitMode, setSplitMode] = useState<'all' | 'custom'>('all');
  const [formError, setFormError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isAddDrawerOpen && activeGroup && currentMember) {
      setPaymentSource(financialSummary.remainingGroupFund > 0 ? 'group_fund' : 'personal');
      setPersonalPayerId(currentMember.id);
      setSelectedMemberIds(activeGroup.members.map((m) => m.id));
      setSplitMode('all');
      setFormError('');
    }
  }, [isAddDrawerOpen, activeGroup?.id, activeGroup?.members.length, currentMember?.id]);

  if (!activeGroup || !currentMember) return null;

  const amountVal = parseFloat(amountInput) || 0;
  const currentParticipants =
    splitMode === 'all' ? activeGroup.members.map((m) => m.id) : selectedMemberIds;
  const perPerson =
    currentParticipants.length > 0 ? Math.round(amountVal / currentParticipants.length) : 0;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleToggleMember = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length === 1) return;
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  const handleOpenDrawerWithDefaults = () => {
    if (financialSummary.remainingGroupFund > 0) {
      setPaymentSource('group_fund');
    } else {
      setPaymentSource('personal');
    }
    setPersonalPayerId(currentMember.id);
    setSelectedMemberIds(activeGroup.members.map((m) => m.id));
    setSplitMode('all');
    setFormError('');
    onOpenAddDrawer();
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    if (amountVal <= 0) {
      setFormError('Please enter a valid expense amount.');
      return;
    }
    if (!descInput.trim()) {
      setFormError('Please enter what the expense was for.');
      return;
    }

    const participants =
      splitMode === 'all' ? activeGroup.members.map((m) => m.id) : selectedMemberIds;
    if (participants.length === 0) {
      setFormError('Please select at least one roommate sharing this expense.');
      return;
    }

    let paidFromGroupFund = 0;
    let paidPersonally = 0;
    let payerId: string | undefined = undefined;
    let payerName: string | undefined = undefined;

    if (paymentSource === 'group_fund') {
      paidFromGroupFund = amountVal;
      paidPersonally = 0;
    } else if (paymentSource === 'personal') {
      paidFromGroupFund = 0;
      paidPersonally = amountVal;
      payerId = personalPayerId;
      payerName = activeGroup.members.find((m) => m.id === personalPayerId)?.name;
    } else {
      const fundPart = parseFloat(fundPortionInput) || 0;
      if (fundPart < 0 || fundPart > amountVal) {
        setFormError('Fund portion must be between 0 and the total expense amount.');
        return;
      }
      paidFromGroupFund = fundPart;
      paidPersonally = amountVal - fundPart;
      payerId = personalPayerId;
      payerName = activeGroup.members.find((m) => m.id === personalPayerId)?.name;
    }

    setIsSubmitting(true);
    try {
      const result = await addExpense({
        amount: amountVal,
        description: descInput.trim(),
        date: dateInput,
        sharedMemberIds: participants,
        paymentSource,
        paidFromGroupFund,
        personalPayerId: payerId,
        personalPayerName: payerName,
        paidPersonally,
      });

      if (!result.success) {
        setFormError(result.message);
        return;
      }

      onCloseAddDrawer();
      showToast(`${descInput.trim()} (${amountVal.toLocaleString()} ${activeGroup.currency})`);
      setDescInput('');
      setAmountInput('');
      setFundPortionInput('0');
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupExpenses = expenses.filter((e) => e.groupId === activeGroup.id);
  const myStat = financialSummary.memberStats[currentMember.id];

  return (
    <div className="flex flex-col w-full pb-6 space-y-2.5 text-start">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-full font-medium text-xs shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Overview Summary Bento Card */}
      <div className="w-full bg-white rounded-2xl p-3 shadow-xs border border-black/[0.04]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">pie_chart</span>
            <span className="text-[9.5px] uppercase text-outline font-semibold tracking-wider">
              {activeGroup.name} · {t.sharedSpend}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[9.5px] font-medium">
            {t.activeCycle}
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="text-xl font-bold text-on-surface tracking-tight flex items-baseline gap-1">
              <span dir="ltr">{financialSummary.totalExpenses.toLocaleString()}</span>
              <span className="text-[11px] font-normal text-outline">
                {activeGroup.currency}
              </span>
            </div>
            <p className="text-[10.5px] text-outline mt-0.5">
              {t.splitAcrossMembers(activeGroup.members.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenDrawerWithDefaults}
            className="h-7.5 px-2.5 bg-primary hover:bg-primary-container text-white rounded-xl text-[11px] font-medium active:scale-95 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>{t.addExpense}</span>
          </button>
        </div>

        {/* Financial Split Breakdown Pill Tiles */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-black/[0.04]">
          <div className="p-1.5 rounded-xl bg-surface-container-low/70 text-center">
            <span className="text-[9px] text-outline block font-medium">{t.youPaid}</span>
            <span dir="ltr" className="text-[11.5px] font-semibold text-on-surface block mt-0.5">
              {myStat ? myStat.personalPayments.toLocaleString() : 0}
            </span>
          </div>
          <div className="p-1.5 rounded-xl bg-surface-container-low/70 text-center">
            <span className="text-[9px] text-outline block font-medium">{t.yourShare}</span>
            <span dir="ltr" className="text-[11.5px] font-semibold text-on-surface block mt-0.5">
              {myStat ? myStat.fairShare.toLocaleString() : 0}
            </span>
          </div>
          <div
            className={`p-1.5 rounded-xl text-center ${
              myStat && myStat.currentBalance >= 0
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-rose-50 text-rose-800'
            }`}
          >
            <span className="text-[9px] block font-medium">{t.netPoolDue}</span>
            <span dir="ltr" className="text-[11.5px] font-semibold block mt-0.5">
              {myStat && myStat.currentBalance > 0 ? '+' : ''}
              {myStat ? myStat.currentBalance.toLocaleString() : 0}
            </span>
          </div>
        </div>
      </div>

      {/* Shared Ledger Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
          {t.sharedLedger}
        </span>
        <span className="text-[10.5px] text-outline font-medium">
          {t.itemsInRoom(groupExpenses.length, activeGroup.name)}
        </span>
      </div>

      {/* Expenses List */}
      <div className="flex flex-col w-full space-y-1.5">
        {groupExpenses.length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center text-on-surface-variant shadow-xs border border-black/[0.04]">
            <span className="material-symbols-outlined text-2xl text-outline mb-1">receipt_long</span>
            <p className="text-xs font-semibold">{t.noSharedExpensesYet}</p>
            <p className="text-[10.5px] text-outline mt-0.5">
              {t.tapAddExpenseHint(activeGroup.name)}
            </p>
          </div>
        ) : (
          groupExpenses.map((expense) => {
            const isGroupFund = expense.paymentSource === 'group_fund';
            const isPersonal = expense.paymentSource === 'personal';
            const isSplit = expense.paymentSource === 'split_group_personal';

            const isSharing = expense.sharedMemberIds.includes(currentMember.id);
            const mySplit = isSharing
              ? Math.round(expense.amount / expense.sharedMemberIds.length)
              : 0;

            let balanceBadge = '';
            let balanceColor = 'text-outline';
            if (isGroupFund) {
              balanceBadge = isSharing
                ? t.sharePrefix(mySplit.toLocaleString())
                : t.groupFundSource;
              balanceColor = 'text-outline font-medium';
            } else if (isSplit) {
              balanceBadge = isSharing
                ? t.sharePrefix(mySplit.toLocaleString())
                : t.mixedPay;
              balanceColor = 'text-outline font-medium';
            } else if (isPersonal && expense.personalPayerId === currentMember.id) {
              const backAmount = expense.amount - mySplit;
              balanceBadge = t.backSuffix(backAmount.toLocaleString());
              balanceColor = 'text-emerald-700 font-semibold';
            } else if (isSharing && expense.personalPayerId !== currentMember.id) {
              balanceBadge = t.dueSuffix(mySplit.toLocaleString());
              balanceColor = 'text-rose-700 font-semibold';
            }

            const perEach = Math.round(
              expense.amount / Math.max(1, expense.sharedMemberIds.length)
            );

            return (
              <div
                key={expense.id}
                className="w-full bg-white rounded-2xl p-2.5 shadow-xs border border-black/[0.04] flex flex-col gap-1 transition-all hover:border-black/[0.08]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary-fixed/80 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[15px]">receipt</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11.5px] font-medium text-on-surface truncate">
                          {expense.description}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full bg-surface-container text-on-surface-variant text-[8.5px] font-medium uppercase">
                          {t.sharedTag}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-on-surface-variant truncate mt-0.5">
                        {isGroupFund
                          ? t.groupFundSource
                          : isPersonal
                          ? t.paidBy(expense.personalPayerName || '')
                          : `${expense.paidFromGroupFund.toLocaleString()} + ${expense.paidPersonally.toLocaleString()} (${expense.personalPayerName})`}
                      </p>
                    </div>
                  </div>

                  <div className="text-end shrink-0 ps-2">
                    <span dir="ltr" className="text-[11.5px] font-semibold text-on-surface block">
                      {expense.amount.toLocaleString()}{' '}
                      <span className="text-[9.5px] text-outline font-normal">
                        {activeGroup.currency}
                      </span>
                    </span>
                    {balanceBadge && (
                      <span className={`text-[9.5px] block ${balanceColor}`}>
                        {balanceBadge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub row */}
                <div className="flex items-center justify-between pt-0.5 rounded-lg bg-surface-container-low/60 px-2 py-0.5 text-[10px]">
                  <div className="flex items-center gap-1 min-w-0 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[12px] text-outline">groups</span>
                    <span className="truncate">
                      {t.splitWaysPerEa(
                        expense.sharedMemberIds.length,
                        `${perEach.toLocaleString()} ${activeGroup.currency}`
                      )}
                    </span>
                  </div>
                  <span dir="ltr" className="text-[9.5px] text-outline shrink-0 ms-1">
                    {expense.date}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ADD EXPENSE SLIDE-UP DRAWER */}
      {isAddDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={onCloseAddDrawer}
          />

          <div className="relative w-full max-w-md bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[88vh] overflow-hidden z-10 animate-in slide-in-from-bottom duration-200 border-t border-black/[0.05] text-start">
            {/* Header */}
            <div className="w-full pt-2 pb-1.5 px-3.5 flex flex-col items-center bg-white shrink-0 border-b border-black/[0.04]">
              <div className="w-8 h-1 rounded-full bg-surface-container-highest mb-1"></div>
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[17px]">
                    post_add
                  </span>
                  <span className="text-xs font-semibold text-on-surface">{t.newSharedExpense}</span>
                </div>
                <button
                  type="button"
                  onClick={onCloseAddDrawer}
                  className="w-6.5 h-6.5 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitExpense} className="overflow-y-auto px-3.5 py-2.5 space-y-2.5 flex-1 pb-5">
              {formError && (
                <div className="p-2 rounded-xl bg-error-container text-on-error-container text-[11px] font-medium">
                  {formError}
                </div>
              )}

              {/* Amount Keypad Display */}
              <div className="w-full bg-surface-container-low/70 rounded-xl p-2.5 flex flex-col items-center justify-center text-center border border-black/[0.03]">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-outline mb-0.5">
                  {t.totalSpentAmount}
                </span>
                <div className="flex items-baseline justify-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    required
                    min="1"
                    step="any"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="text-xl font-bold text-primary bg-transparent text-center focus:outline-none w-32 tracking-tight"
                    placeholder="0"
                  />
                  <span className="text-xs font-semibold text-outline">
                    {activeGroup.currency}
                  </span>
                </div>
                <span className="text-[10.5px] text-outline mt-0.5 font-medium">
                  {t.perPersonSummary(
                    `${perPerson.toLocaleString()} ${activeGroup.currency}`,
                    currentParticipants.length
                  )}
                </span>
              </div>

              {/* Description Input */}
              <div className="space-y-0.5">
                <label className="text-[10.5px] font-semibold text-on-surface block">
                  {t.descriptionLabel}
                </label>
                <div className="flex items-center bg-surface-container-low rounded-xl px-2.5 py-1.5 border border-black/[0.04]">
                  <input
                    type="text"
                    required
                    placeholder={t.descriptionPlaceholder}
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    className="bg-transparent text-xs text-on-surface placeholder:text-outline focus:outline-none w-full"
                  />
                </div>
              </div>

              {/* Date Input */}
              <div className="space-y-0.5">
                <label className="text-[10.5px] font-semibold text-on-surface block">
                  {t.dateLabel}
                </label>
                <div className="flex items-center bg-surface-container-low rounded-xl px-2.5 py-1.5 border border-black/[0.04]">
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="bg-transparent text-xs font-medium text-on-surface focus:outline-none w-full"
                  />
                </div>
              </div>

              {/* PAYMENT SOURCE SELECTOR */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-semibold text-on-surface">
                    {t.paymentSourceLabel}
                  </label>
                  <span className="text-[9.5px] text-primary font-medium">
                    {t.fundRemainingShort(
                      `${financialSummary.remainingGroupFund.toLocaleString()} ${activeGroup.currency}`
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-0.5 rounded-xl text-center border border-black/[0.03]">
                  <button
                    type="button"
                    onClick={() => setPaymentSource('group_fund')}
                    className={`text-[10.5px] py-1 px-1 rounded-lg font-medium transition-all cursor-pointer ${
                      paymentSource === 'group_fund'
                        ? 'bg-white text-primary shadow-xs font-semibold'
                        : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    {t.groupFundTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentSource('personal')}
                    className={`text-[10.5px] py-1 px-1 rounded-lg font-medium transition-all cursor-pointer ${
                      paymentSource === 'personal'
                        ? 'bg-white text-primary shadow-xs font-semibold'
                        : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    {t.personalTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentSource('split_group_personal');
                      const available = Math.min(amountVal, Math.max(0, financialSummary.remainingGroupFund));
                      setFundPortionInput(available.toString());
                    }}
                    className={`text-[10.5px] py-1 px-1 rounded-lg font-medium transition-all cursor-pointer ${
                      paymentSource === 'split_group_personal'
                        ? 'bg-white text-primary shadow-xs font-semibold'
                        : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    {t.bothMixTab}
                  </button>
                </div>

                {paymentSource === 'personal' && (
                  <div className="space-y-1 p-2 rounded-xl bg-surface-container-low/70 border border-black/[0.03]">
                    <span className="text-[9.5px] font-semibold text-outline block mb-0.5">
                      {t.whoPaidPersonally}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {activeGroup.members.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPersonalPayerId(m.id)}
                          className={`py-1 px-1 rounded-lg text-[10.5px] font-medium text-center transition-all cursor-pointer ${
                            personalPayerId === m.id
                              ? 'bg-primary text-white shadow-xs font-semibold'
                              : 'bg-white text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          {m.name.split(' ')[0]} {m.id === currentMember.id ? `(${t.youBadge})` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {paymentSource === 'split_group_personal' && (
                  <div className="space-y-1 p-2 rounded-xl bg-surface-container-low/70 border border-black/[0.03]">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9.5px] font-medium text-outline block mb-0.5">
                          {t.fromGroupFund}
                        </label>
                        <input
                          type="number"
                          max={amountVal}
                          min="0"
                          value={fundPortionInput}
                          onChange={(e) => setFundPortionInput(e.target.value)}
                          className="w-full h-7.5 px-2 rounded-lg bg-white text-xs font-semibold text-on-surface focus:outline-none border border-black/[0.04]"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-medium text-outline block mb-0.5">
                          {t.personalOutOfPocket}
                        </label>
                        <div className="h-7.5 px-2 rounded-lg bg-white/60 flex items-center text-xs font-semibold text-primary border border-black/[0.04]">
                          {Math.max(0, amountVal - (parseFloat(fundPortionInput) || 0)).toLocaleString()} {activeGroup.currency}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9.5px] font-semibold text-outline block mb-0.5">
                        {t.payerForRemainder}
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {activeGroup.members.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPersonalPayerId(m.id)}
                            className={`py-1 px-1 rounded-lg text-[10px] font-medium text-center transition-all cursor-pointer ${
                              personalPayerId === m.id
                                ? 'bg-primary text-white shadow-xs font-semibold'
                                : 'bg-white text-on-surface'
                            }`}
                          >
                            {m.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SPLIT PARTICIPANTS */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-semibold text-on-surface">{t.splitAmong}</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSplitMode('all')}
                      className={`text-[9.5px] px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                        splitMode === 'all'
                          ? 'bg-primary text-white font-semibold'
                          : 'bg-surface-container text-outline'
                      }`}
                    >
                      {t.allCount(activeGroup.members.length)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode('custom')}
                      className={`text-[9.5px] px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                        splitMode === 'custom'
                          ? 'bg-primary text-white font-semibold'
                          : 'bg-surface-container text-outline'
                      }`}
                    >
                      {t.custom}
                    </button>
                  </div>
                </div>

                {splitMode === 'custom' && (
                  <div className="space-y-0.5 p-1.5 rounded-xl bg-surface-container-low/70 border border-black/[0.03]">
                    {activeGroup.members.map((m) => {
                      const isChecked = selectedMemberIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => handleToggleMember(m.id)}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-white cursor-pointer hover:bg-surface-container transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 accent-primary rounded"
                            />
                            <span className="text-xs text-on-surface">
                              {m.name}
                            </span>
                          </div>
                          <span className="text-[10.5px] font-mono font-medium text-primary">
                            {isChecked ? `${perPerson.toLocaleString()} ${activeGroup.currency}` : t.excluded}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-8.5 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-semibold shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[15px]">check</span>
                <span>{t.saveExpense} ({amountVal.toLocaleString()} {activeGroup.currency})</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
