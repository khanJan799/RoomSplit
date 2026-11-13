import React, { useState, useEffect } from 'react';
import { useRoomSplit } from '../../data/store';
import { useLanguage } from '../../i18n';
import { canDirectAddFund, canApproveFundRequests } from '../../utils/permissions';

interface ContributionsScreenProps {
  isConfirmModalOpen: boolean;
  onCloseConfirmModal: () => void;
  onOpenConfirmModal: () => void;
}

export const ContributionsScreen: React.FC<ContributionsScreenProps> = ({
  isConfirmModalOpen,
  onCloseConfirmModal,
  onOpenConfirmModal,
}) => {
  const {
    activeGroup,
    currentMember,
    contributions,
    fundRequests,
    activities,
    financialSummary,
    confirmContribution,
    requestFundContribution,
    updateFundRequest,
    cancelFundRequest,
    reviewFundRequest,
  } = useRoomSplit();
  const { t } = useLanguage();

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    currentMember?.id || (activeGroup ? activeGroup.members[0]?.id || '' : '')
  );
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [amountReceivedInput, setAmountReceivedInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (activeGroup && activeGroup.members.length > 0) {
      const exists = activeGroup.members.some((m) => m.id === selectedMemberId);
      if (!exists) {
        setSelectedMemberId(currentMember?.id || activeGroup.members[0].id);
      }
    }
  }, [activeGroup, currentMember?.id, selectedMemberId]);

  useEffect(() => {
    if (!isConfirmModalOpen) {
      setEditingRequestId(null);
      setModalError('');
    }
  }, [isConfirmModalOpen]);

  if (!activeGroup || !currentMember) return null;

  const isAdminOrCoAdmin = canDirectAddFund(currentMember);
  const canApprove = canApproveFundRequests(currentMember);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleOpenForMember = (memberId: string) => {
    if (!isAdminOrCoAdmin) {
      handleOpenMemberRequest();
      return;
    }
    setEditingRequestId(null);
    setSelectedMemberId(memberId);
    setAmountReceivedInput('');
    setNotesInput('');
    setModalError('');
    onOpenConfirmModal();
  };

  const handleOpenMemberRequest = () => {
    setEditingRequestId(null);
    setSelectedMemberId(currentMember.id);
    setAmountReceivedInput('');
    setNotesInput('');
    setModalError('');
    onOpenConfirmModal();
  };

  const handleOpenEditRequest = (reqId: string, amount: number, notes?: string) => {
    setEditingRequestId(reqId);
    setSelectedMemberId(currentMember.id);
    setAmountReceivedInput(amount.toString());
    setNotesInput(notes || '');
    setModalError('');
    onOpenConfirmModal();
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setModalError('');

    const parsedAmount = parseFloat(amountReceivedInput) || 0;
    if (parsedAmount <= 0) {
      setModalError('Please enter a valid fund amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isAdminOrCoAdmin) {
        const res = await confirmContribution(selectedMemberId, parsedAmount, notesInput.trim());
        if (!res.success) {
          setModalError(res.message);
          return;
        }
        onCloseConfirmModal();
        showToast(res.message);
        return;
      }

      // Regular member: submit new or update pending fund request (awaiting Admin approval)
      const res = editingRequestId
        ? await updateFundRequest(editingRequestId, parsedAmount, notesInput.trim())
        : await requestFundContribution(parsedAmount, notesInput.trim());

      if (!res.success) {
        setModalError(res.message);
        return;
      }

      onCloseConfirmModal();
      setEditingRequestId(null);
      setAmountReceivedInput('');
      setNotesInput('');
      showToast(res.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewRequest = async (reqId: string, decision: 'approved' | 'rejected') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await reviewFundRequest(reqId, decision);
      showToast(res.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await cancelFundRequest(reqId);
      showToast(res.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // All individual fund additions recorded for this group
  const fundHistory = activities.filter(
    (act) => act.groupId === activeGroup.id && act.type === 'contribution'
  );

  const groupRequests = fundRequests.filter((r) => r.groupId === activeGroup.id);
  const pendingAdminRequests = groupRequests.filter((r) => r.status === 'pending');
  const myFundRequests = groupRequests.filter((r) => r.memberId === currentMember.id);

  const selectedMember = activeGroup.members.find((m) => m.id === selectedMemberId);

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

      {/* Fund Metrics Summary: Collected & Remaining Fund */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl bg-white shadow-xs border border-black/[0.04] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase text-outline tracking-wider">
              {t.totalCollected}
            </span>
            <span className="w-5.5 h-5.5 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[13px]">account_balance</span>
            </span>
          </div>
          <div className="mt-1">
            <span dir="ltr" className="text-lg font-bold text-emerald-800">
              {financialSummary.totalContributions.toLocaleString()}
            </span>
            <span className="text-[9.5px] text-outline font-semibold ms-1">
              {activeGroup.currency}
            </span>
            <p className="text-[9px] text-outline mt-0.5">
              {t.fromMembersCount(activeGroup.members.length)}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white shadow-xs border border-black/[0.04] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase text-outline tracking-wider">
              {t.remainingFund}
            </span>
            <span className="w-5.5 h-5.5 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[13px]">savings</span>
            </span>
          </div>
          <div className="mt-1">
            <span
              dir="ltr"
              className={`text-lg font-bold ${
                financialSummary.remainingGroupFund >= 0 ? 'text-on-surface' : 'text-rose-700'
              }`}
            >
              {financialSummary.remainingGroupFund.toLocaleString()}
            </span>
            <span className="text-[9.5px] text-outline font-semibold ms-1">
              {activeGroup.currency}
            </span>
            <p className="text-[9px] text-outline mt-0.5">
              {t.spentFromFund(financialSummary.totalPaidFromGroupFund.toLocaleString())}
            </p>
          </div>
        </div>
      </div>

      {/* Role Action Bar: Admin adds directly; Member submits request for Admin approval */}
      <div className="p-2.5 rounded-2xl bg-white shadow-xs border border-black/[0.04] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary-fixed text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
            {currentMember.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-on-surface truncate">
                {currentMember.name}
              </span>
              <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-surface-container font-semibold uppercase text-outline">
                {currentMember.role === 'main_admin'
                  ? t.adminBadge
                  : currentMember.role === 'co_admin'
                  ? t.coAdminBadge
                  : t.memberRoleLabel}
              </span>
            </div>
            <span className="text-[10px] text-outline truncate block">
              {isAdminOrCoAdmin ? t.authorizedAddFund : t.requestFundDesc}
            </span>
          </div>
        </div>

        {isAdminOrCoAdmin ? (
          <button
            type="button"
            onClick={() => handleOpenForMember(currentMember.id)}
            className="h-7.5 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all shadow-xs shrink-0 bg-primary text-white hover:bg-primary-container active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">add_circle</span>
            <span>{t.addFund}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenMemberRequest}
            className="h-7.5 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all shadow-xs shrink-0 bg-amber-600 text-white hover:bg-amber-700 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">send</span>
            <span>{t.requestFundBtn}</span>
          </button>
        )}
      </div>

      {/* ADMIN / CO-ADMIN: PENDING FUND APPROVAL QUEUE */}
      {canApprove && pendingAdminRequests.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              {t.pendingFundRequests} ({pendingAdminRequests.length})
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {pendingAdminRequests.map((req) => (
              <div
                key={req.id}
                className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-xs flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-amber-200/80 text-amber-950 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {req.memberName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-on-surface truncate">
                        {req.memberName}
                      </span>
                      <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-semibold uppercase">
                        {t.pendingApprovalBadge}
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      <span dir="ltr" className="font-bold text-amber-950">
                        +{req.amount.toLocaleString()} {activeGroup.currency}
                      </span>
                      {req.notes ? ` · ${req.notes}` : ''} · <span dir="ltr">{req.date}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReviewRequest(req.id, 'approved')}
                    className="h-7 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10.5px] font-semibold flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[13px]">check</span>
                    <span>{t.approveBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewRequest(req.id, 'rejected')}
                    className="h-7 px-2 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] font-semibold flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                    <span>{t.declineBtn}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGULAR MEMBER: OWN FUND REQUESTS (Pending / Approved / Declined) */}
      {!canApprove && myFundRequests.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
              {t.yourFundRequests} ({myFundRequests.length})
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {myFundRequests.map((req) => {
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              return (
                <div
                  key={req.id}
                  className={`p-2.5 rounded-2xl border shadow-xs flex items-center justify-between gap-2 ${
                    isPending
                      ? 'bg-amber-50/70 border-amber-200'
                      : isApproved
                      ? 'bg-emerald-50/50 border-emerald-200/70'
                      : 'bg-rose-50/50 border-rose-200/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span dir="ltr" className="text-xs font-bold text-on-surface">
                        +{req.amount.toLocaleString()} {activeGroup.currency}
                      </span>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-semibold uppercase ${
                          isPending
                            ? 'bg-amber-200 text-amber-900'
                            : isApproved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isPending
                          ? t.pendingApprovalBadge
                          : isApproved
                          ? t.approvedBadge
                          : t.declinedBadge}
                      </span>
                    </div>
                    <p className="text-[10px] text-outline truncate mt-0.5">
                      {req.notes ? `${req.notes} · ` : ''}
                      <span dir="ltr">{req.date}</span>
                      {req.reviewedByAdminName ? ` · ${t.reviewedBy(req.reviewedByAdminName)}` : ''}
                    </p>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditRequest(req.id, req.amount, req.notes)}
                        className="h-7 px-2 rounded-lg bg-white border border-black/[0.08] text-primary text-[10px] font-semibold cursor-pointer hover:bg-surface-container"
                      >
                        {t.editRequestBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelRequest(req.id)}
                        className="h-7 px-2 rounded-lg bg-white border border-rose-200 text-rose-700 text-[10px] font-semibold cursor-pointer hover:bg-rose-50"
                      >
                        {t.cancelRequestBtn}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Group Members & Total Given by Each Person */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
              {t.membersFundSummary}
            </span>
            <span className="text-[10px] text-outline font-semibold">
              ({activeGroup.members.length})
            </span>
          </div>
          <span className="text-[10px] text-outline">
            {t.codeLabel}: <span dir="ltr" className="font-mono font-semibold text-on-surface">{activeGroup.code}</span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {activeGroup.members.map((member) => {
            const contrib = contributions.find(
              (c) => c.groupId === activeGroup.id && c.memberId === member.id
            );
            const totalGiven = contrib?.confirmedAmount || 0;
            const isMe = member.id === currentMember.id;

            return (
              <div
                key={member.id}
                className={`p-3 rounded-2xl bg-white shadow-xs border flex items-center justify-between gap-2 ${
                  isMe ? 'border-primary/20 ring-1 ring-primary/10' : 'border-black/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7.5 h-7.5 rounded-full bg-surface-container text-on-surface font-semibold text-[10.5px] flex items-center justify-center shrink-0">
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
                      {member.role === 'main_admin' && (
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          {t.adminBadge}
                        </span>
                      )}
                      {member.role === 'co_admin' && (
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                          {t.coAdminBadge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-outline truncate block">
                      {member.roomNumber}
                      {contrib?.confirmedByAdminName
                        ? ` · ${t.lastAddedBy(contrib.confirmedByAdminName)}`
                        : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-end">
                    <span
                      dir="ltr"
                      className={`text-xs font-bold block ${
                        totalGiven > 0 ? 'text-emerald-700' : 'text-outline'
                      }`}
                    >
                      {totalGiven.toLocaleString()} {activeGroup.currency}
                    </span>
                    <span className="text-[9px] text-outline block">{t.totalGiven}</span>
                  </div>

                  {isAdminOrCoAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenForMember(member.id)}
                      className="h-7 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10.5px] font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>{t.addShort}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fund Contributions Log */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
            {t.fundGivenHistory}
          </span>
          <span className="text-[10px] text-outline font-medium">
            {t.entriesCount(fundHistory.length)}
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-black/[0.04] divide-y divide-black/[0.03] overflow-hidden">
          {fundHistory.length === 0 ? (
            <div className="p-4 text-center text-xs text-outline">
              <span className="material-symbols-outlined text-xl text-outline mb-1 block">
                payments
              </span>
              {t.noFundsAddedYet}
              {isAdminOrCoAdmin ? ` ${t.tapAddFundHint}` : ''}
            </div>
          ) : (
            fundHistory.map((item) => (
              <div
                key={item.id}
                className="p-2.5 flex items-center justify-between hover:bg-surface-container-low/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[15px]">south_west</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-on-surface truncate">
                      {t.givenByName(item.actorName)}
                    </h4>
                    <p className="text-[10px] text-outline truncate">
                      {item.targetName ? t.addedByName(item.targetName) : t.verified} ·{' '}
                      <span dir="ltr">{item.date}</span>
                    </p>
                  </div>
                </div>

                <div className="text-end shrink-0 ps-2">
                  <span dir="ltr" className="text-xs font-bold text-emerald-700 block">
                    +{item.amount.toLocaleString()} {activeGroup.currency}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL: Add to Group Fund (Admin/Co-Admin) OR Request Fund Approval (Member) */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={onCloseConfirmModal}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl p-4 shadow-xl flex flex-col gap-3 z-10 animate-in slide-in-from-bottom duration-200 border-t border-black/[0.05] text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-0.5 mb-1"></div>
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
              <div>
                <span className="text-[10px] font-semibold uppercase text-secondary block">
                  {isAdminOrCoAdmin
                    ? currentMember.role === 'main_admin'
                      ? t.adminBadge
                      : t.coAdminBadge
                    : t.memberRoleLabel}
                </span>
                <h3 className="text-sm font-bold text-on-surface">
                  {isAdminOrCoAdmin
                    ? t.addToGroupFund
                    : editingRequestId
                    ? t.editFundRequestTitle
                    : t.requestFundApproval}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseConfirmModal}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleConfirmSubmit} className="space-y-2.5">
              {isAdminOrCoAdmin ? (
                <div>
                  <label className="text-[11px] font-semibold text-on-surface block mb-1">
                    {t.whoGaveMoney}
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {activeGroup.members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer truncate ${
                          selectedMemberId === m.id
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {m.name.split(' ')[0]} {m.id === currentMember.id ? `(${t.youBadge})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 leading-snug">
                  {t.requestFundInfoBanner}
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-on-surface block mb-0.5">
                  {isAdminOrCoAdmin
                    ? `${t.amountGivenBy(selectedMember?.name || '')} (${activeGroup.currency}) *`
                    : `${t.amountYouGave} (${activeGroup.currency}) *`}
                </label>
                <div className="flex items-center px-3 py-1.5 rounded-xl bg-surface-container-low border border-black/[0.04]">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    placeholder="20000"
                    value={amountReceivedInput}
                    onChange={(e) => setAmountReceivedInput(e.target.value)}
                    className="w-full bg-transparent text-lg font-bold text-on-surface outline-none"
                  />
                  <span className="text-xs font-semibold text-outline ms-1">
                    {activeGroup.currency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {[10000, 20000, 30000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountReceivedInput(amt.toString())}
                    className="py-1 rounded-lg bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-on-surface block mb-0.5">
                  {t.noteOptional}
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder={t.noteCashPlaceholder}
                  className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                />
              </div>

              <button
                type="submit"
                className={`w-full h-9.5 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-transform cursor-pointer ${
                  isAdminOrCoAdmin ? 'bg-primary' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isAdminOrCoAdmin ? 'check_circle' : 'send'}
                </span>
                <span>
                  {isAdminOrCoAdmin
                    ? t.addToGroupFund
                    : editingRequestId
                    ? t.updateFundRequest
                    : t.submitFundRequest}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
