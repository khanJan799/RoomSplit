import React from 'react';
import { useLanguage } from '../i18n';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenQuickAdd: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickAdd,
}) => {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface/92 backdrop-blur-xl border-t border-black/[0.04] transition-all">
      <div className="max-w-md mx-auto h-12 px-1 flex items-center justify-between relative">
        {/* Overview / Dashboard */}
        <button
          type="button"
          onClick={() => onTabChange('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors active:scale-95 cursor-pointer ${
            currentTab === 'dashboard'
              ? 'text-primary font-semibold'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">dashboard</span>
          <span className="text-[8.5px] tracking-tight leading-none">{t.tabOverview}</span>
        </button>

        {/* Expenses */}
        <button
          type="button"
          onClick={() => onTabChange('expenses')}
          className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors active:scale-95 cursor-pointer ${
            currentTab === 'expenses'
              ? 'text-primary font-semibold'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">receipt_long</span>
          <span className="text-[8.5px] tracking-tight leading-none">{t.tabExpenses}</span>
        </button>

        {/* Center Quick Add Trigger - Classy, perfectly proportioned pill */}
        <div className="flex-1 flex items-center justify-center relative">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            aria-label={t.recordTransaction}
            className="w-9.5 h-9.5 -mt-3 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_2px_10px_rgba(53,37,205,0.28)] active:scale-92 transition-all hover:bg-primary-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>

        {/* Contributions / Fund */}
        <button
          type="button"
          onClick={() => onTabChange('contributions')}
          className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors active:scale-95 cursor-pointer ${
            currentTab === 'contributions'
              ? 'text-primary font-semibold'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">savings</span>
          <span className="text-[8.5px] tracking-tight leading-none">{t.tabFund}</span>
        </button>

        {/* Loans */}
        <button
          type="button"
          onClick={() => onTabChange('loans')}
          className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors active:scale-95 cursor-pointer ${
            currentTab === 'loans'
              ? 'text-primary font-semibold'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">handshake</span>
          <span className="text-[8.5px] tracking-tight leading-none">{t.tabLoans}</span>
        </button>

        {/* Settlement */}
        <button
          type="button"
          onClick={() => onTabChange('settle')}
          className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors active:scale-95 cursor-pointer ${
            currentTab === 'settle'
              ? 'text-primary font-semibold'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">balance</span>
          <span className="text-[8.5px] tracking-tight leading-none">{t.tabSettle}</span>
        </button>
      </div>
    </nav>
  );
};
