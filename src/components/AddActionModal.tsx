import React from 'react';
import { useRoomSplit } from '../data/store';
import { useLanguage } from '../i18n';
import { canDirectAddFund } from '../utils/permissions';

interface AddActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: 'expense' | 'contribution' | 'loan' | 'settle') => void;
}

export const AddActionModal: React.FC<AddActionModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const { currentMember, activeGroup } = useRoomSplit();
  const { t } = useLanguage();

  if (!isOpen || !activeGroup || !currentMember) return null;

  const canDirectFund = canDirectAddFund(currentMember);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl p-3.5 shadow-xl flex flex-col gap-2.5 z-10 animate-in slide-in-from-bottom duration-200 border-t border-black/[0.05]">
        <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-0.5 mb-0.5"></div>

        <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
          <div className="min-w-0 text-start">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-primary block leading-none mb-0.5">
              {activeGroup.name}
            </span>
            <h3 className="text-xs font-semibold text-on-surface">{t.recordTransaction}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6.5 h-6.5 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1">
          {/* Action 1: Add Shared Expense */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectAction('expense');
            }}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all active:scale-[0.99] text-start border border-black/[0.03] cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-primary-fixed text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[15px]">receipt_long</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-on-surface">
                  {t.addSharedExpense}
                </span>
                <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-medium uppercase">
                  {t.roomBadge}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant truncate">
                {t.equalSplitDesc}
              </p>
            </div>
            <span className="material-symbols-outlined text-[13px] text-outline rtl:rotate-180">
              chevron_right
            </span>
          </button>

          {/* Action 2: Add to Group Fund (Admin/Co-Admin) OR Request Fund Approval (Member) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectAction('contribution');
            }}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all active:scale-[0.99] text-start border border-black/[0.03] cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[15px]">payments</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-on-surface">
                  {canDirectFund ? t.addToGroupFund : t.requestFundApproval}
                </span>
                {canDirectFund ? (
                  <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-medium uppercase">
                    {t.adminOrCoAdminBadge}
                  </span>
                ) : (
                  <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-medium uppercase">
                    {t.approvalRequiredBadge}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-on-surface-variant truncate">
                {canDirectFund ? t.verifyCashDesc : t.requestFundDesc}
              </p>
            </div>
            <span className="material-symbols-outlined text-[13px] text-outline rtl:rotate-180">
              chevron_right
            </span>
          </button>

          {/* Action 3: Record 1-on-1 Personal Loan */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectAction('loan');
            }}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all active:scale-[0.99] text-start border border-black/[0.03] cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[15px]">handshake</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-on-surface">
                  {t.recordPersonalLoan}
                </span>
                <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-medium uppercase">
                  {t.oneOnOneBadge}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant truncate">
                {t.privateLoanDesc}
              </p>
            </div>
            <span className="material-symbols-outlined text-[13px] text-outline rtl:rotate-180">
              chevron_right
            </span>
          </button>

          {/* Action 4: Settle Balances */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectAction('settle');
            }}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all active:scale-[0.99] text-start border border-black/[0.03] cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[15px]">balance</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-on-surface">
                  {t.settleUpBalances}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant truncate">
                {t.settleDesc}
              </p>
            </div>
            <span className="material-symbols-outlined text-[13px] text-outline rtl:rotate-180">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
