import React, { useState, useMemo } from 'react';
import { useRoomSplit } from '../../data/store';
import { useLanguage } from '../../i18n';
import { canMarkSettlementPaid } from '../../utils/permissions';

export const SettlementScreen: React.FC = () => {
  const {
    activeGroup,
    currentMember,
    financialSummary,
    activities,
    recordSettlementTransfer,
  } = useRoomSplit();
  const { t } = useLanguage();

  const [reportType, setReportType] = useState<
    'all' | 'contribution' | 'shared_expense' | 'personal_loan' | 'loan_repayment'
  >('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeGroupId = activeGroup?.id;
  const filteredActivities = useMemo(() => {
    if (!activeGroupId) return [];
    return activities.filter((act) => {
      if (act.groupId !== activeGroupId) return false;
      if (reportType !== 'all' && act.type !== reportType) return false;
      return true;
    });
  }, [activities, activeGroupId, reportType]);

  if (!activeGroup || !currentMember) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleSettleTransfer = (fromId: string, toId: string, amount: number) => {
    const res = recordSettlementTransfer(fromId, toId, amount);
    if (!res.success) {
      showToast(res.message);
      return;
    }
    const fromName = activeGroup.members.find((m) => m.id === fromId)?.name || t.memberRoleLabel;
    const toName = activeGroup.members.find((m) => m.id === toId)?.name || t.memberRoleLabel;
    showToast(
      t.settlementRecordedToast(
        `${amount.toLocaleString()} ${activeGroup.currency}`,
        fromName,
        toName
      )
    );
  };

  return (
    <div className="flex flex-col w-full gap-2.5 pb-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-full font-medium text-xs shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3-Column Summary Metrics */}
      <div className="grid grid-cols-3 gap-1.5 mt-0.5">
        <div className="p-2 rounded-2xl bg-white shadow-xs border border-black/[0.04] text-center">
          <span className="text-[9px] font-semibold uppercase text-outline block">
            {t.contributionsShort}
          </span>
          <span dir="ltr" className="text-xs font-bold text-emerald-800 block mt-0.5">
            {financialSummary.totalContributions.toLocaleString()}
          </span>
          <span className="text-[8.5px] text-outline">{activeGroup.currency}</span>
        </div>

        <div className="p-2 rounded-2xl bg-white shadow-xs border border-black/[0.04] text-center">
          <span className="text-[9px] font-semibold uppercase text-outline block">
            {t.expensesShort}
          </span>
          <span dir="ltr" className="text-xs font-bold text-on-surface block mt-0.5">
            {financialSummary.totalExpenses.toLocaleString()}
          </span>
          <span className="text-[8.5px] text-outline">{activeGroup.currency}</span>
        </div>

        <div className="p-2 rounded-2xl bg-white shadow-xs border border-black/[0.04] text-center">
          <span className="text-[9px] font-semibold uppercase text-outline block">
            {t.fundLeftShort}
          </span>
          <span dir="ltr" className="text-xs font-bold text-primary block mt-0.5">
            {financialSummary.remainingGroupFund.toLocaleString()}
          </span>
          <span className="text-[8.5px] text-outline">{activeGroup.currency}</span>
        </div>
      </div>

      {/* WHO OWES WHOM */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
            {t.whoOwesWhom}
          </span>
          <span className="text-[10px] font-mono font-medium text-outline">
            {t.totalDue(`${financialSummary.totalOwed.toLocaleString()} ${activeGroup.currency}`)}
          </span>
        </div>

        {financialSummary.settlements.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white text-center shadow-xs border border-black/[0.04]">
            <span className="material-symbols-outlined text-2xl text-emerald-600 mb-1">
              check_circle
            </span>
            <p className="text-xs font-semibold text-on-surface">{t.allRoommatesSettled}</p>
            <p className="text-[10.5px] text-outline mt-0.5">
              {t.nobodyOwesRoom}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {financialSummary.settlements.map((settle) => (
              <div
                key={settle.id}
                className="p-2.5 rounded-2xl bg-white shadow-xs border border-black/[0.04] flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-[9.5px] shrink-0">
                    {settle.fromMemberName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-medium text-on-surface">
                        {settle.fromMemberName}
                      </span>
                      <span className="text-[9.5px] text-outline font-normal">{t.paysWord}</span>
                      <span className="text-xs font-semibold text-primary">
                        {settle.toMemberName}
                      </span>
                    </div>
                    <span className="text-[10px] text-outline block">
                      {t.directPeerSettlement}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 ps-2">
                  <span dir="ltr" className="text-xs font-semibold text-rose-700">
                    {settle.amount.toLocaleString()}{' '}
                    <span className="text-[9px] text-outline font-normal">
                      {activeGroup.currency}
                    </span>
                  </span>
                  {canMarkSettlementPaid(currentMember, settle.toMemberId) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSettleTransfer(
                          settle.fromMemberId,
                          settle.toMemberId,
                          settle.amount
                        )
                      }
                      className="mt-0.5 px-2 py-0.5 rounded-lg bg-surface-container text-[9.5px] font-medium text-primary hover:bg-surface-container-high active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[11px]">done</span>
                      <span>{t.markPaid}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MEMBER FINANCIAL BREAKDOWN */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
            {t.detailedMemberLedger}
          </span>
          <span className="text-[9.5px] text-outline">
            {t.ledgerFormulaHint}
          </span>
        </div>

        <div className="space-y-1">
          {activeGroup.members.map((member) => {
            const stat = financialSummary.memberStats[member.id];
            return (
              <div
                key={member.id}
                className="p-2.5 rounded-2xl bg-white shadow-xs border border-black/[0.04] flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6.5 h-6.5 rounded-full bg-surface-container text-on-surface font-semibold text-[9.5px] flex items-center justify-center">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-on-surface block">
                        {member.name}
                      </span>
                      <span className="text-[9.5px] text-outline">{member.roomNumber}</span>
                    </div>
                  </div>

                  <div className="text-end">
                    <span
                      dir="ltr"
                      className={`text-xs font-semibold inline-block ${
                        stat && stat.currentBalance > 0
                          ? 'text-emerald-700'
                          : stat && stat.currentBalance < 0
                          ? 'text-rose-700'
                          : 'text-outline'
                      }`}
                    >
                      {stat && stat.currentBalance > 0 ? '+' : ''}
                      {stat ? stat.currentBalance.toLocaleString() : 0} {activeGroup.currency}
                    </span>
                    <span className="text-[9px] text-outline block">
                      {stat && stat.currentBalance > 0
                        ? t.shouldReceive
                        : stat && stat.currentBalance < 0
                        ? t.owesRoom
                        : t.balanced}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-container-low/70 p-1 text-center text-[10px]">
                  <div>
                    <span className="text-[8px] text-outline block">{t.contribShort}</span>
                    <span dir="ltr" className="font-medium text-on-surface">
                      {stat ? stat.totalContribution.toLocaleString() : 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-outline block">{t.personalShort}</span>
                    <span dir="ltr" className="font-medium text-primary">
                      {stat ? stat.personalPayments.toLocaleString() : 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-outline block">{t.fairShareShort}</span>
                    <span dir="ltr" className="font-medium text-on-surface">
                      {stat ? stat.fairShare.toLocaleString() : 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-outline block">{t.balanceShort}</span>
                    <span
                      dir="ltr"
                      className={`font-semibold inline-block ${
                        stat && stat.currentBalance > 0
                          ? 'text-emerald-700'
                          : stat && stat.currentBalance < 0
                          ? 'text-rose-700'
                          : 'text-outline'
                      }`}
                    >
                      {stat ? stat.currentBalance.toLocaleString() : 0}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REPORTS & AUDIT TRAIL */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            {t.reportsAuditTrail}
          </span>
          <span className="text-[10px] text-outline">{t.permanentHistory}</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: t.filterAll },
            { id: 'shared_expense', label: t.expensesShort },
            { id: 'contribution', label: t.filterFund },
            { id: 'personal_loan', label: t.filterLoans },
            { id: 'loan_repayment', label: t.filterRepayments },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id as any)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all ${
                reportType === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-outline hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-black/[0.04] divide-y divide-black/[0.03] overflow-hidden">
          {filteredActivities.length === 0 ? (
            <div className="p-4 text-center text-xs text-outline">
              {t.noAuditRecords}
            </div>
          ) : (
            filteredActivities.map((act) => (
              <div key={act.id} className="p-2.5 flex items-center justify-between">
                <div className="min-w-0 pe-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[8.5px] px-1 py-0.2 rounded font-semibold uppercase bg-surface-container text-on-surface">
                      {t.auditTypeLabels[act.type] || act.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-semibold text-on-surface truncate">
                      {act.title}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-outline truncate mt-0.5">
                    {act.description}
                  </p>
                  <span className="text-[9.5px] text-outline">
                    <span dir="ltr">{act.date}</span> · {act.actorName}
                  </span>
                </div>
                <div className="text-end shrink-0">
                  <span dir="ltr" className="text-xs font-semibold text-on-surface inline-block">
                    {act.amount > 0 ? `${act.amount.toLocaleString()} ${activeGroup.currency}` : t.recordedWord}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
