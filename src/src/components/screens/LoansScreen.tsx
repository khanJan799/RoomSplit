import React, { useState, useEffect, useMemo } from 'react';
import { useRoomSplit } from '../../data/store';
import { useLanguage } from '../../i18n';
import { isAdminOrCoAdmin, canRecordLoanRepayment } from '../../utils/permissions';

interface LoansScreenProps {
  isNewLoanModalOpen: boolean;
  onCloseNewLoanModal: () => void;
  onOpenNewLoanModal: () => void;
}

export const LoansScreen: React.FC<LoansScreenProps> = ({
  isNewLoanModalOpen,
  onCloseNewLoanModal,
  onOpenNewLoanModal,
}) => {
  const {
    activeGroup,
    currentMember,
    loans,
    loanSummary,
    recordLoan,
    recordLoanRepayment,
  } = useRoomSplit();
  const { t } = useLanguage();

  const [activeRepayLoanId, setActiveRepayLoanId] = useState<string | null>(null);
  const [repayAmountInput, setRepayAmountInput] = useState<string>('');
  const [repayNoteInput, setRepayNoteInput] = useState<string>('');
  const [repayError, setRepayError] = useState<string>('');

  const [newBorrowerId, setNewBorrowerId] = useState<string>(
    activeGroup
      ? activeGroup.members.find((m) => m.id !== currentMember?.id)?.id || currentMember?.id || ''
      : ''
  );
  const [newLenderId, setNewLenderId] = useState<string>(currentMember?.id || '');
  const [newAmountInput, setNewAmountInput] = useState<string>('');
  const [newDescInput, setNewDescInput] = useState<string>('');
  const [newDateInput, setNewDateInput] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newLoanDirection, setNewLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [newLoanError, setNewLoanError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loanFilter, setLoanFilter] = useState<'all' | 'active' | 'settled'>('all');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isNewLoanModalOpen && activeGroup && currentMember) {
      const otherMember = activeGroup.members.find((m) => m.id !== currentMember.id);
      setNewLoanDirection('lent');
      setNewBorrowerId(otherMember?.id || currentMember.id);
      setNewLenderId(currentMember.id);
      setNewAmountInput('');
      setNewDescInput('');
      setNewDateInput(new Date().toISOString().split('T')[0]);
      setNewLoanError('');
    }
  }, [isNewLoanModalOpen, activeGroup?.id, activeGroup?.members.length, currentMember?.id]);

  const groupLoans = useMemo(() => {
    if (!activeGroup) return [];
    return loans.filter((l) => l.groupId === activeGroup.id);
  }, [loans, activeGroup]);

  const filteredLoans = useMemo(() => {
    if (loanFilter === 'active') return groupLoans.filter((l) => l.status !== 'settled');
    if (loanFilter === 'settled') return groupLoans.filter((l) => l.status === 'settled');
    return groupLoans;
  }, [groupLoans, loanFilter]);

  const auditEvents = useMemo(() => {
    const events: {
      id: string;
      kind: 'repayment' | 'issued';
      title: string;
      subtitle: string;
      amount: number;
      date: string;
      balanceLabel: string;
      sortTime: number;
    }[] = [];

    groupLoans.forEach((loan) => {
      const issuedTs =
        loan.createdAt || parseInt(loan.id.split('-')[1] || '0', 10) || Date.parse(loan.date) || 0;
      events.push({
        id: `issued-${loan.id}`,
        kind: 'issued',
        title: t.loanAgreementTitle,
        subtitle: t.borrowedFrom(loan.borrowerName, loan.lenderName, loan.description),
        amount: loan.originalAmount,
        date: loan.date,
        balanceLabel: t.originalLabel(loan.originalAmount.toLocaleString()),
        sortTime: issuedTs,
      });

      (loan.repayments || []).forEach((rep) => {
        const repTs =
          rep.createdAt || parseInt(rep.id.split('-')[1] || '0', 10) || Date.parse(rep.date) || issuedTs + 1;
        events.push({
          id: rep.id,
          kind: 'repayment',
          title: rep.remainingAfter === 0 ? t.fullRepaymentTitle : t.partialRepaymentTitle,
          subtitle: t.returnedTo(loan.borrowerName, loan.lenderName, rep.note),
          amount: rep.amount,
          date: rep.date,
          balanceLabel: t.leftLabel(rep.remainingAfter.toLocaleString()),
          sortTime: repTs,
        });
      });
    });

    return events.sort((a, b) => b.sortTime - a.sortTime);
  }, [groupLoans, t]);

  if (!activeGroup || !currentMember) return null;

  const myLoanStats = loanSummary.memberLoanStats[currentMember.id];
  const lentOutTotal = myLoanStats?.lentOutRemaining || 0;
  const lentOutOriginal = myLoanStats?.lentOutOriginal || 0;
  const borrowedTotal = myLoanStats?.borrowedRemaining || 0;
  const borrowedOriginal = myLoanStats?.borrowedOriginal || 0;
  const netLoanBalance = myLoanStats?.netLoanBalance || 0;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const selectedRepayLoan = groupLoans.find((l) => l.id === activeRepayLoanId);
  const rawRepayVal = parseFloat(repayAmountInput) || 0;
  const repayVal = Math.round(rawRepayVal * 100) / 100;
  const remainingAfterRepay = selectedRepayLoan
    ? Math.max(0, Math.round((selectedRepayLoan.remainingAmount - repayVal) * 100) / 100)
    : 0;

  const handleRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setRepayError('');

    if (!selectedRepayLoan) return;
    if (repayVal <= 0) {
      setRepayError('Please enter a valid repayment amount.');
      return;
    }
    if (repayVal > selectedRepayLoan.remainingAmount + 0.005) {
      setRepayError(
        `Amount exceeds remaining debt (${selectedRepayLoan.remainingAmount.toLocaleString()} ${activeGroup.currency}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordLoanRepayment(
        selectedRepayLoan.id,
        repayVal,
        new Date().toISOString().split('T')[0],
        repayNoteInput
      );

      if (!res.success) {
        setRepayError(res.message);
        return;
      }

      setActiveRepayLoanId(null);
      showToast(res.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setNewLoanError('');

    if (newBorrowerId === newLenderId) {
      setNewLoanError('Borrower and lender must be different roommates.');
      return;
    }

    const amount = Math.round((parseFloat(newAmountInput) || 0) * 100) / 100;
    if (amount <= 0) {
      setNewLoanError('Please enter a valid loan amount.');
      return;
    }

    if (!newDescInput.trim()) {
      setNewLoanError('Please enter a reason or description.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordLoan(
        newBorrowerId,
        newLenderId,
        amount,
        newDescInput.trim(),
        newDateInput
      );

      if (!res.success) {
        setNewLoanError(res.message);
        return;
      }

      onCloseNewLoanModal();
      showToast(res.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic quick-repayment fractions derived from remaining debt
  const calcFraction = (rem: number, pct: number) => {
    const raw = rem * pct;
    const rounded = rem >= 100 ? Math.round(raw) : Math.round(raw * 100) / 100;
    return Math.min(rem, Math.max(0.01, rounded));
  };

  const quickRepayOptions = selectedRepayLoan
    ? [
        {
          label: '25%',
          value: calcFraction(selectedRepayLoan.remainingAmount, 0.25),
        },
        {
          label: '50%',
          value: calcFraction(selectedRepayLoan.remainingAmount, 0.5),
        },
        {
          label: t.settled100,
          value: selectedRepayLoan.remainingAmount,
        },
      ]
    : [];

  const filterLabels: Record<'all' | 'active' | 'settled', string> = {
    all: t.filterAll,
    active: t.filterActive,
    settled: t.filterSettled,
  };

  return (
    <div className="flex flex-col w-full gap-2.5 pb-6 text-start">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-full font-medium text-xs shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Personal Loan Balances Summary */}
      <div className="grid grid-cols-2 gap-2 mt-0.5">
        <div className="flex flex-col justify-between p-3 rounded-2xl bg-white shadow-xs border border-black/[0.04]">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase text-outline tracking-wider">
              {t.lentOut}
            </span>
            <span className="w-5.5 h-5.5 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-[13px]">arrow_outward</span>
            </span>
          </div>
          <div className="mt-1">
            <span dir="ltr" className="text-base font-bold text-emerald-800">
              {lentOutTotal.toLocaleString()}{' '}
              <span className="text-[9.5px] text-outline font-normal">{activeGroup.currency}</span>
            </span>
            <p className="text-[9px] text-outline mt-0.5">
              {lentOutOriginal > 0
                ? t.returnedProgress(
                    (myLoanStats?.lentOutRepaid || 0).toLocaleString(),
                    lentOutOriginal.toLocaleString()
                  )
                : t.owedToYou}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 rounded-2xl bg-rose-50/70 shadow-xs border border-rose-100">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase text-rose-800 tracking-wider">
              {t.youOwe}
            </span>
            <span className="w-5.5 h-5.5 rounded-full bg-rose-200/60 text-rose-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[13px]">call_received</span>
            </span>
          </div>
          <div className="mt-1">
            <span dir="ltr" className="text-base font-bold text-rose-800">
              {borrowedTotal.toLocaleString()}{' '}
              <span className="text-[9.5px] text-rose-700/80 font-normal">{activeGroup.currency}</span>
            </span>
            <p className="text-[9px] text-rose-700/80 mt-0.5">
              {borrowedOriginal > 0
                ? t.paidBackProgress(
                    (myLoanStats?.borrowedRepaid || 0).toLocaleString(),
                    borrowedOriginal.toLocaleString()
                  )
                : t.privateOneOnOneDebt}
            </p>
          </div>
        </div>
      </div>

      {/* Net Loan Position & Group Totals */}
      <div className="p-2.5 rounded-2xl bg-white border border-black/[0.04] shadow-xs flex items-center justify-between gap-2">
        <div>
          <span className="text-[9.5px] font-semibold uppercase text-outline tracking-wider block">
            {t.yourNetLoanPosition}
          </span>
          <span
            dir="ltr"
            className={`text-sm font-bold inline-block ${
              netLoanBalance > 0
                ? 'text-emerald-700'
                : netLoanBalance < 0
                ? 'text-rose-700'
                : 'text-on-surface'
            }`}
          >
            {netLoanBalance > 0 ? '+' : ''}
            {netLoanBalance.toLocaleString()} {activeGroup.currency}
          </span>
          <span className="text-[9.5px] text-outline block">
            {netLoanBalance > 0
              ? t.netOwedToYou
              : netLoanBalance < 0
              ? t.netYouOwe
              : t.allPersonalLoansBalanced}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenNewLoanModal}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-white text-[11px] font-semibold active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          <span>{t.newLoan}</span>
        </button>
      </div>

      {/* Pairwise Net 1-on-1 Balances */}
      {loanSummary.pairwiseBalances.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
              {t.netOneOnOneBalances}
            </span>
            <span className="text-[10px] text-outline">
              {t.activeDebtLabel(`${loanSummary.totalActiveDebt.toLocaleString()} ${activeGroup.currency}`)}
            </span>
          </div>
          <div className="bg-white rounded-2xl shadow-xs border border-black/[0.04] divide-y divide-black/[0.03] overflow-hidden">
            {loanSummary.pairwiseBalances.map((pair) => (
              <div
                key={pair.id}
                className="px-3 py-2 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-on-surface truncate">
                    {pair.fromMemberName}
                  </span>
                  <span className="text-[10px] text-outline shrink-0">{t.owesWord}</span>
                  <span className="font-semibold text-primary truncate">
                    {pair.toMemberName}
                  </span>
                </div>
                <span dir="ltr" className="font-bold text-rose-700 shrink-0 ps-2">
                  {pair.amount.toLocaleString()} {activeGroup.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loan Agreements List */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
            {t.loanContracts(loanSummary.activeCount)}
          </span>
          <div className="flex items-center gap-1">
            {(['all', 'active', 'settled'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setLoanFilter(f)}
                className={`px-2 py-0.5 rounded-full text-[9.5px] font-semibold cursor-pointer transition-colors ${
                  loanFilter === f
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-outline hover:text-on-surface'
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>
        </div>

        {filteredLoans.length === 0 ? (
          <div className="p-5 text-center bg-white rounded-2xl shadow-xs border border-black/[0.04]">
            <span className="material-symbols-outlined text-2xl text-outline mb-1">handshake</span>
            <p className="text-xs font-semibold">
              {groupLoans.length === 0
                ? t.noPersonalLoans
                : t.noFilteredLoans(filterLabels[loanFilter])}
            </p>
            <p className="text-[10.5px] text-outline mt-0.5">
              {t.tapNewLoanHint}
            </p>
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const isSettled = loan.status === 'settled' || loan.remainingAmount <= 0;
            const repaidAmount = Math.max(
              0,
              Math.round((loan.originalAmount - loan.remainingAmount) * 100) / 100
            );
            const progressPct =
              loan.originalAmount > 0
                ? Math.min(100, Math.max(0, Math.round((repaidAmount / loan.originalAmount) * 100)))
                : 0;

            return (
              <div
                key={loan.id}
                className="flex flex-col rounded-2xl bg-white p-3 shadow-xs border border-black/[0.04] gap-1.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-0.5 min-w-0 pe-2">
                    <span className="text-[9px] font-semibold uppercase text-primary tracking-wider">
                      {isSettled ? t.settledAgreement : t.activeAgreement} ·{' '}
                      <span dir="ltr">{loan.date}</span>
                    </span>
                    <h3 className="text-xs font-semibold text-on-surface truncate flex items-center gap-1">
                      <span>{loan.lenderName}</span>
                      <span className="inline-block rtl:rotate-180">→</span>
                      <span>{loan.borrowerName}</span>
                    </h3>
                    <span className="text-[10.5px] text-outline truncate">{loan.description}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0 ${
                      isSettled
                        ? 'bg-secondary-container text-secondary'
                        : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {isSettled ? t.settled100 : t.pctPaid(progressPct)}
                  </span>
                </div>

                {/* Metric Split */}
                <div className="flex items-baseline justify-between pt-0.5">
                  <div>
                    <span className="text-[9px] text-outline block font-medium">{t.remaining}</span>
                    <span dir="ltr" className="text-base font-bold text-primary tracking-tight">
                      {loan.remainingAmount.toLocaleString()}{' '}
                      <span className="text-[11px] text-outline font-normal">
                        {activeGroup.currency}
                      </span>
                    </span>
                  </div>
                  <div className="text-end">
                    <span className="text-[9px] text-outline block font-medium">{t.original}</span>
                    <span dir="ltr" className="text-[11px] font-semibold text-outline">
                      {loan.originalAmount.toLocaleString()} {activeGroup.currency}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="flex flex-col gap-0.5">
                  <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isSettled ? 'bg-emerald-600' : 'bg-primary'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-outline">
                    <span>{repaidAmount.toLocaleString()} {t.returnedWord}</span>
                    <span>{loan.remainingAmount.toLocaleString()} {t.leftWord}</span>
                  </div>
                </div>

                {/* Action: ONLY Lender or Admin/Co-Admin can confirm loan repayment */}
                {!isSettled && canRecordLoanRepayment(currentMember, loan) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRepayLoanId(loan.id);
                      setRepayAmountInput(loan.remainingAmount.toString());
                      setRepayNoteInput('');
                      setRepayError('');
                    }}
                    className="w-full h-8 mt-0.5 rounded-xl bg-primary text-white text-[11px] font-medium flex items-center justify-center gap-1 active:scale-98 transition-all shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    <span>{t.recordRepayment}</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Audit History Timeline */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
            {t.loanAuditLedger}
          </span>
          <span className="text-[10px] text-outline font-medium">
            {t.repaidTotalLabel(`${loanSummary.totalRepaid.toLocaleString()} ${activeGroup.currency}`)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {auditEvents.length === 0 ? (
            <div className="p-4 text-center bg-white rounded-2xl shadow-xs border border-black/[0.04] text-xs text-outline">
              {t.noLoanTransactions}
            </div>
          ) : (
            auditEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white shadow-xs border border-black/[0.04]"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    ev.kind === 'repayment'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-surface-container text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {ev.kind === 'repayment' ? 'check_circle' : 'contract'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-on-surface">{ev.title}</span>
                    <span
                      dir="ltr"
                      className={`text-xs font-semibold ${
                        ev.kind === 'repayment' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {ev.kind === 'repayment' ? '+' : '-'}
                      {ev.amount.toLocaleString()} {activeGroup.currency}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-outline truncate mt-0.5">{ev.subtitle}</p>
                  <div className="flex items-center justify-between mt-1 pt-0.5 text-[9.5px] text-outline">
                    <span dir="ltr">{ev.date}</span>
                    <span className="font-semibold text-on-surface">
                      {ev.balanceLabel} {activeGroup.currency}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL: Record Repayment */}
      {selectedRepayLoan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            onClick={() => setActiveRepayLoanId(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl p-4 shadow-xl flex flex-col gap-2.5 z-10 animate-in slide-in-from-bottom duration-200 border-t border-black/[0.05] text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-0.5 mb-1"></div>
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
              <div>
                <span className="text-[10px] font-semibold uppercase text-primary flex items-center gap-1">
                  <span>{selectedRepayLoan.borrowerName}</span>
                  <span className="inline-block rtl:rotate-180">→</span>
                  <span>{selectedRepayLoan.lenderName}</span>
                </span>
                <h3 className="text-sm font-bold text-on-surface">{t.recordRepayment}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRepayLoanId(null)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {repayError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {repayError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              {quickRepayOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRepayAmountInput(opt.value.toString())}
                  className="py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  {opt.value.toLocaleString()} ({opt.label})
                </button>
              ))}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-on-surface block mb-0.5">
                {t.repaymentAmount} ({activeGroup.currency})
              </label>
              <div className="flex items-center px-3 py-1.5 rounded-xl bg-surface-container-low border border-black/[0.04]">
                <input
                  type="number"
                  min="1"
                  step="any"
                  max={selectedRepayLoan.remainingAmount}
                  value={repayAmountInput}
                  onChange={(e) => setRepayAmountInput(e.target.value)}
                  className="w-full bg-transparent text-lg font-bold text-on-surface outline-none"
                />
                <span className="text-xs font-semibold text-outline ms-1">
                  {activeGroup.currency}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-on-surface block mb-0.5">
                {t.noteOptional}
              </label>
              <input
                type="text"
                value={repayNoteInput}
                onChange={(e) => setRepayNoteInput(e.target.value)}
                placeholder={t.noteCashPlaceholder}
                className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-surface-container-low text-xs font-mono text-on-surface border border-black/[0.03]">
              {t.debtLeftPreview(
                selectedRepayLoan.remainingAmount.toLocaleString(),
                repayVal.toLocaleString(),
                `${remainingAfterRepay.toLocaleString()} ${activeGroup.currency}`
              )}
            </div>

            <button
              type="button"
              onClick={handleRepaymentSubmit}
              className="w-full h-9.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-transform shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>{t.confirmRepayment}</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: New Loan */}
      {isNewLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            onClick={onCloseNewLoanModal}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl p-4 shadow-xl flex flex-col gap-2.5 z-10 animate-in slide-in-from-bottom duration-200 border-t border-black/[0.05] text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-0.5 mb-1"></div>
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
              <div>
                <span className="text-[10px] font-semibold uppercase text-secondary">
                  {t.oneOnOneContract}
                </span>
                <h3 className="text-sm font-bold text-on-surface">{t.recordNewLoan}</h3>
              </div>
              <button
                type="button"
                onClick={onCloseNewLoanModal}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {newLoanError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {newLoanError}
              </div>
            )}

            <form onSubmit={handleNewLoanSubmit} className="space-y-2.5">
              {isAdminOrCoAdmin(currentMember) ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                      {t.borrower}
                    </label>
                    <select
                      value={newBorrowerId}
                      onChange={(e) => setNewBorrowerId(e.target.value)}
                      className="w-full h-8.5 px-2 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                    >
                      {activeGroup.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.id === currentMember.id ? `(${t.youBadge})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                      {t.lender}
                    </label>
                    <select
                      value={newLenderId}
                      onChange={(e) => setNewLenderId(e.target.value)}
                      className="w-full h-8.5 px-2 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                    >
                      {activeGroup.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.id === currentMember.id ? `(${t.youBadge})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10.5px] font-semibold text-on-surface block mb-1">
                      {t.loanDirectionLabel}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-0.5 rounded-xl border border-black/[0.04]">
                      <button
                        type="button"
                        onClick={() => {
                          const other = activeGroup.members.find((m) => m.id !== currentMember.id);
                          setNewLoanDirection('lent');
                          setNewLenderId(currentMember.id);
                          setNewBorrowerId(other?.id || '');
                        }}
                        className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          newLoanDirection === 'lent'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-outline hover:text-on-surface'
                        }`}
                      >
                        {t.iLentMoney}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const other = activeGroup.members.find((m) => m.id !== currentMember.id);
                          setNewLoanDirection('borrowed');
                          setNewBorrowerId(currentMember.id);
                          setNewLenderId(other?.id || '');
                        }}
                        className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          newLoanDirection === 'borrowed'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-outline hover:text-on-surface'
                        }`}
                      >
                        {t.iBorrowedMoney}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                      {newLoanDirection === 'lent' ? t.borrower : t.lender}
                    </label>
                    <select
                      value={newLoanDirection === 'lent' ? newBorrowerId : newLenderId}
                      onChange={(e) => {
                        if (newLoanDirection === 'lent') {
                          setNewBorrowerId(e.target.value);
                          setNewLenderId(currentMember.id);
                        } else {
                          setNewLenderId(e.target.value);
                          setNewBorrowerId(currentMember.id);
                        }
                      }}
                      className="w-full h-8.5 px-2 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                    >
                      {activeGroup.members
                        .filter((m) => m.id !== currentMember.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.roomNumber})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                    {t.amountLabel} ({activeGroup.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="10000"
                    value={newAmountInput}
                    onChange={(e) => setNewAmountInput(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface outline-none border border-black/[0.04]"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                    {t.dateLabel}
                  </label>
                  <input
                    type="date"
                    value={newDateInput}
                    onChange={(e) => setNewDateInput(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                  {t.reasonItem}
                </label>
                <input
                  type="text"
                  required
                  value={newDescInput}
                  onChange={(e) => setNewDescInput(e.target.value)}
                  placeholder={t.reasonPlaceholder}
                  className="w-full h-8.5 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                />
              </div>

              <button
                type="submit"
                className="w-full h-9.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-transform shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>{t.savePrivateLoan}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
