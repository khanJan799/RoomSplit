import React, { useState } from 'react';
import { useRoomSplit } from '../../data/store';
import { useLanguage } from '../../i18n';
import { canDirectAddFund, canApproveFundRequests } from '../../utils/permissions';

interface DashboardScreenProps {
  onNavigateTab: (tab: string) => void;
  onOpenQuickAdd: () => void;
  onOpenAddExpense?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateTab,
  onOpenAddExpense,
}) => {
  const {
    activeGroup,
    currentMember,
    financialSummary,
    expenses,
    fundRequests,
    addExpense,
    confirmContribution,
  } = useRoomSplit();
  const { t } = useLanguage();

  // Inline Quick Add Expense state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [descInput, setDescInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [purchasedById, setPurchasedById] = useState<string>(currentMember?.id || '');
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payFromFund, setPayFromFund] = useState<boolean>(true);
  const [expenseError, setExpenseError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin: Record money given by member modal (Admin-only!)
  const [showContribModal, setShowContribModal] = useState<boolean>(false);
  const [contribMemberId, setContribMemberId] = useState<string>('');
  const [contribAmount, setContribAmount] = useState<string>('20000');
  const [contribNote, setContribNote] = useState<string>('');
  const [contribError, setContribError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!activeGroup) {
    return null;
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const groupExpenses = expenses.filter((e) => e.groupId === activeGroup.id);
  const pendingFundRequestsCount = fundRequests.filter(
    (r) => r.groupId === activeGroup.id && r.status === 'pending'
  ).length;
  const isAdminOrCoAdmin = canDirectAddFund(currentMember);
  const canApproveFunds = canApproveFundRequests(currentMember);

  const handleOpenAdd = () => {
    if (onOpenAddExpense) {
      onOpenAddExpense();
    } else {
      setDescInput('');
      setAmountInput('');
      setPurchasedById(currentMember?.id || activeGroup.members[0]?.id || '');
      setDateInput(new Date().toISOString().split('T')[0]);
      setPayFromFund(financialSummary.remainingGroupFund > 0);
      setExpenseError('');
      setShowAddModal(true);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setExpenseError('');

    const amt = parseFloat(amountInput) || 0;
    if (amt <= 0) {
      setExpenseError('Please enter a valid amount.');
      return;
    }
    if (!descInput.trim()) {
      setExpenseError('Please enter what was bought.');
      return;
    }

    const payer = activeGroup.members.find((m) => m.id === purchasedById) || activeGroup.members[0];

    const paidFromGroupFund = payFromFund ? amt : 0;
    const paidPersonally = payFromFund ? 0 : amt;

    setIsSubmitting(true);
    try {
      const res = await addExpense({
        amount: amt,
        description: descInput.trim(),
        date: dateInput,
        sharedMemberIds: activeGroup.members.map((m) => m.id),
        paymentSource: payFromFund ? 'group_fund' : 'personal',
        paidFromGroupFund,
        paidPersonally,
        personalPayerId: payer?.id,
        personalPayerName: payer?.name,
      });

      if (!res.success) {
        setExpenseError(res.message);
        return;
      }

      setShowAddModal(false);
      showToast(`${descInput.trim()} (${amt.toLocaleString()} ${activeGroup.currency})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmContribSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setContribError('');

    if (!isAdminOrCoAdmin) {
      setContribError(t.authorizedAddFund);
      return;
    }

    const amt = parseFloat(contribAmount) || 0;
    if (amt <= 0) {
      setContribError('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await confirmContribution(contribMemberId, amt, contribNote.trim());
      if (res.success) {
        setShowContribModal(false);
        showToast(res.message);
      } else {
        setContribError(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMemberForContrib = activeGroup.members.find((m) => m.id === contribMemberId);

  const currentRoleLabel =
    currentMember?.role === 'main_admin'
      ? t.mainAdminLabel
      : currentMember?.role === 'co_admin'
      ? t.coAdminLabel
      : t.roommateMemberLabel;

  return (
    <div className="flex flex-col w-full gap-3 pb-6 text-start">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-full font-medium text-xs shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. ROOM HEADER INFO */}
      <section className="bg-white rounded-2xl p-3 shadow-xs border border-black/[0.04]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {activeGroup.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-on-surface truncate">
                  {activeGroup.name}
                </h1>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-secondary-container text-secondary font-medium shrink-0">
                  {t.active}
                </span>
              </div>
              <p className="text-[10.5px] text-outline truncate">
                {t.roomCodePrefix}:{' '}
                <span dir="ltr" className="font-mono font-semibold">
                  {activeGroup.code}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="text-[8.5px] font-semibold text-outline uppercase tracking-wider">
              {t.yourRole}
            </span>
            <span
              className={`text-xs font-bold ${
                isAdminOrCoAdmin ? 'text-primary' : 'text-on-surface'
              }`}
            >
              {currentRoleLabel}
            </span>
          </div>
        </div>
      </section>

      {/* PENDING FUND REQUESTS BANNER (Admin / Co-Admin) */}
      {canApproveFunds && pendingFundRequestsCount > 0 && (
        <button
          type="button"
          onClick={() => onNavigateTab('contributions')}
          className="w-full p-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 flex items-center justify-between gap-2 text-start transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6.5 h-6.5 rounded-full bg-amber-200/70 text-amber-900 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[15px]">pending_actions</span>
            </span>
            <span className="text-xs font-semibold text-amber-950 truncate">
              {t.pendingRequestsBanner(pendingFundRequestsCount)}
            </span>
          </div>
          <span className="material-symbols-outlined text-[15px] text-amber-900 shrink-0 rtl:rotate-180">
            chevron_right
          </span>
        </button>
      )}

      {/* 2. GROUP FINANCIAL SUMMARY CARD */}
      <section className="relative overflow-hidden bg-white rounded-2xl p-4 shadow-sm border border-black/[0.05] flex flex-col gap-3">
        {/* Top: Remaining Group Balance Highlight */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
              {t.remainingGroupBalance}
            </span>
            <span className="text-[9px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
              {t.liveBalance}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mt-1">
            <span
              dir="ltr"
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                financialSummary.remainingGroupFund >= 0 ? 'text-on-surface' : 'text-rose-700'
              }`}
            >
              {financialSummary.remainingGroupFund.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-outline">
              {activeGroup.currency}
            </span>
          </div>
          <p className="text-[10.5px] text-outline mt-0.5">
            {t.collectedMinusSpent}
          </p>
        </div>

        {/* 2 Metric Tiles (Collected & Total Spent) */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/[0.04]">
          {/* Collected Money */}
          <div
            onClick={() => onNavigateTab('contributions')}
            className="p-2.5 rounded-xl bg-surface-container-low/70 flex flex-col justify-between cursor-pointer hover:bg-surface-container transition-colors"
          >
            <span className="text-[10px] text-outline font-medium">{t.collected}</span>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span dir="ltr" className="text-sm font-bold text-emerald-700">
                {financialSummary.totalContributions.toLocaleString()}
              </span>
              <span className="text-[9.5px] text-outline font-semibold">
                {activeGroup.currency}
              </span>
            </div>
          </div>

          {/* Total Spent */}
          <div
            onClick={() => onNavigateTab('expenses')}
            className="p-2.5 rounded-xl bg-surface-container-low/70 flex flex-col justify-between cursor-pointer hover:bg-surface-container transition-colors"
          >
            <span className="text-[10px] text-outline font-medium">{t.totalSpent}</span>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span dir="ltr" className="text-sm font-bold text-rose-700">
                {financialSummary.totalExpenses.toLocaleString()}
              </span>
              <span className="text-[9.5px] text-outline font-semibold">
                {activeGroup.currency}
              </span>
            </div>
          </div>
        </div>

        {/* PROMINENT ADD EXPENSE BUTTON */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="w-full h-10 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">add_circle</span>
          <span>{t.addExpense}</span>
        </button>
      </section>

      {/* 3. RECENT PURCHASES */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
            {t.recentPurchases}
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab('expenses')}
            className="text-[10.5px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>{t.viewAll(groupExpenses.length)}</span>
            <span className="material-symbols-outlined text-[13px] rtl:rotate-180">chevron_right</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-black/[0.04] divide-y divide-black/[0.03] overflow-hidden">
          {groupExpenses.length === 0 ? (
            <div className="p-4 text-center text-xs text-outline">
              <span className="material-symbols-outlined text-xl text-outline mb-1 block">
                shopping_bag
              </span>
              {t.noPurchasesYet}
            </div>
          ) : (
            groupExpenses.slice(0, 5).map((exp) => {
              const isGroupFund = exp.paymentSource === 'group_fund' || exp.paidFromGroupFund > 0;
              return (
                <div
                  key={exp.id}
                  className="p-2.5 flex items-center justify-between hover:bg-surface-container-low/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary-fixed/80 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[15px]">receipt</span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-on-surface truncate">
                        {exp.description}
                      </h4>
                      <p className="text-[10px] text-outline truncate">
                        {t.purchasedBy}{' '}
                        <span className="font-medium text-on-surface">
                          {exp.personalPayerName || exp.createdByName}
                        </span>{' '}
                        · <span dir="ltr">{exp.date}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-end shrink-0 ps-2">
                    <span dir="ltr" className="text-xs font-bold text-on-surface block">
                      {exp.amount.toLocaleString()} {activeGroup.currency}
                    </span>
                    <span className="text-[9px] text-outline block">
                      {isGroupFund ? t.groupFundSource : t.personalPaidSource}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 4. GROUP MEMBERS (WITH ADMIN-ONLY RECORD FUND) */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
              {t.groupMembers}
            </span>
            <span className="text-[10px] font-semibold text-outline">
              ({activeGroup.members.length})
            </span>
          </div>
          <span className="text-[10px] text-outline">
            {t.shareCodeToJoin(activeGroup.code)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {activeGroup.members.map((member) => {
            const isMe = member.id === currentMember?.id;
            const isMainAdmin = member.role === 'main_admin';
            const isCoAdmin = member.role === 'co_admin';
            const memberStat = financialSummary.memberStats[member.id];

            return (
              <div
                key={member.id}
                className={`p-2.5 rounded-2xl bg-white shadow-xs border transition-all flex items-center justify-between ${
                  isMe ? 'border-primary/20 ring-1 ring-primary/10' : 'border-black/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-surface-container text-on-surface font-semibold text-[10.5px] flex items-center justify-center shrink-0">
                    {member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-on-surface truncate">
                        {member.name}
                      </span>
                      {isMe && (
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-primary/10 text-primary font-bold">
                          {t.youBadge}
                        </span>
                      )}
                      {isMainAdmin && (
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          {t.adminBadge}
                        </span>
                      )}
                      {isCoAdmin && (
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                          {t.coAdminBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-outline truncate">
                      {member.roomNumber} · <span dir="ltr">{member.phone}</span>
                    </p>
                  </div>
                </div>

                {/* Fund Action: Admin/Co-Admin adds directly; Member can request approval on own row */}
                <div className="flex items-center gap-2 shrink-0 ps-1">
                  <div className="text-end">
                    <span dir="ltr" className="text-[10.5px] font-semibold text-on-surface block">
                      {(memberStat?.totalContribution || 0).toLocaleString()} {activeGroup.currency}
                    </span>
                    <span className="text-[9px] text-outline block">
                      {t.given}
                    </span>
                  </div>
                  {isAdminOrCoAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setContribMemberId(member.id);
                        setContribAmount('20000');
                        setContribNote('');
                        setContribError('');
                        setShowContribModal(true);
                      }}
                      className="h-7 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>{t.recordFund}</span>
                    </button>
                  ) : isMe ? (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('contributions')}
                      className="h-7 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[13px]">send</span>
                      <span>{t.requestFundBtn}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SIMPLE ADD EXPENSE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4.5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 border border-black/[0.06] max-h-[90vh] overflow-y-auto text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-1 mb-2 sm:hidden"></div>

            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] mb-3">
              <div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-primary block">
                  {t.quickEntry}
                </span>
                <h2 className="text-sm font-bold text-on-surface">{t.addExpense}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {expenseError && (
              <div className="p-2 rounded-xl bg-error-container text-on-error-container text-[11px] font-medium mb-3">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.whatDidYouBuy}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.whatBoughtPlaceholder}
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.howMuchCost} ({activeGroup.currency}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="2000"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-sm font-bold text-primary focus:outline-none border border-black/[0.05]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.purchasedByLabel}
                </label>
                <select
                  value={purchasedById}
                  onChange={(e) => setPurchasedById(e.target.value)}
                  className="w-full h-9.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface focus:outline-none border border-black/[0.05]"
                >
                  {activeGroup.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.id === currentMember?.id ? `(${t.youBadge})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.dateLabel}
                </label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low/70 flex items-center justify-between border border-black/[0.04]">
                <div>
                  <span className="text-xs font-semibold text-on-surface block">
                    {t.paidUsingGroupMoney}
                  </span>
                  <span className="text-[10px] text-outline block">
                    {t.subtractFromFund(
                      `${financialSummary.remainingGroupFund.toLocaleString()} ${activeGroup.currency}`
                    )}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={payFromFund}
                  onChange={(e) => setPayFromFund(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform mt-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">check</span>
                <span>{t.saveExpense}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN-ONLY: RECORD FUND GIVEN BY MEMBER */}
      {showContribModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowContribModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4.5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 border border-black/[0.06] text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-1 mb-2 sm:hidden"></div>

            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] mb-3">
              <div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">
                  {t.adminAuthorityOnly}
                </span>
                <h2 className="text-sm font-bold text-on-surface">{t.recordMoneyReceived}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowContribModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {contribError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium mb-3">
                {contribError}
              </div>
            )}

            <form onSubmit={handleConfirmContribSubmit} className="space-y-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-900">
                {t.recordingFundAs(currentMember?.name || '', currentRoleLabel)}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.selectRoommateGaveMoney}
                </label>
                <select
                  value={contribMemberId}
                  onChange={(e) => setContribMemberId(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface focus:outline-none border border-black/[0.05]"
                >
                  {activeGroup.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.roomNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.amountGivenBy(selectedMemberForContrib?.name || '')} ({activeGroup.currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="20000"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-base font-bold text-emerald-800 focus:outline-none border border-black/[0.05]"
                />
              </div>

              {/* Quick shortcut amounts */}
              <div className="grid grid-cols-4 gap-1">
                {[10000, 20000, 30000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setContribAmount(amt.toString())}
                    className="py-1 rounded-lg bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.notes}
                </label>
                <input
                  type="text"
                  placeholder={t.noteCashPlaceholder}
                  value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform mt-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>{t.confirmAddToFund}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
