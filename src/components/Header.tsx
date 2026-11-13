import React, { useState } from 'react';
import { useRoomSplit } from '../data/store';
import { useLanguage } from '../i18n';

interface HeaderProps {
  currentTab: string;
  onOpenProfile: () => void;
  onLeaveGroup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onOpenProfile, onLeaveGroup }) => {
  const { activeGroup, authorizedGroups, switchGroup, currentMember, leaveGroup } = useRoomSplit();
  const { t, language, toggleLanguage } = useLanguage();
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return t.tabOverview;
      case 'expenses':
        return t.tabExpenses;
      case 'contributions':
        return t.tabFund;
      case 'loans':
        return t.tabLoans;
      case 'settle':
        return t.tabSettle;
      default:
        return t.appName;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'RS';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (!activeGroup) {
    return null;
  }

  const handleExit = () => {
    setShowGroupMenu(false);
    if (onLeaveGroup) {
      onLeaveGroup();
    } else {
      leaveGroup();
    }
  };

  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-surface/90 backdrop-blur-xl border-b border-black/[0.04] transition-all">
      <div className="h-11.5 px-3 flex items-center justify-between max-w-md mx-auto">
        {/* Start: Exit/Rooms Back Button & Brand Context */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={handleExit}
            title={t.returnToHome}
            className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high border border-black/[0.04] flex items-center justify-center text-outline hover:text-on-surface transition-colors active:scale-95 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] rtl:rotate-180">arrow_back</span>
          </button>

          <div className="flex flex-col min-w-0 text-start">
            <span className="text-[8.5px] font-semibold tracking-wider uppercase text-primary/80 leading-none truncate">
              {activeGroup.name}
            </span>
            <span className="text-xs font-semibold text-on-surface leading-tight truncate">
              {getTabTitle(currentTab)}
            </span>
          </div>
        </div>

        {/* Action Controls: Language Switcher, Group Selector Pill & Profile Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Compact Language Switcher Pill */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={t.languageLabel}
            className="h-6.5 px-2 rounded-full bg-surface-container/70 hover:bg-surface-container border border-black/[0.04] flex items-center gap-1 text-[10px] font-semibold text-on-surface transition-colors active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[12.5px] text-primary">translate</span>
            <span>{language === 'en' ? 'عربي' : 'EN'}</span>
          </button>

          {/* Active Group Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGroupMenu(!showGroupMenu)}
              className="h-6.5 px-2 rounded-full bg-surface-container/70 hover:bg-surface-container border border-black/[0.04] flex items-center gap-1 transition-colors focus:outline-none active:scale-95 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
              <span className="text-[10.5px] text-on-surface font-medium max-w-[75px] truncate">
                {activeGroup.name}
              </span>
              <span className="material-symbols-outlined text-[12px] text-outline">
                expand_more
              </span>
            </button>

            {/* Dropdown Menu */}
            {showGroupMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowGroupMenu(false)}
                />
                <div className="absolute end-0 mt-1.5 w-52 bg-white/95 backdrop-blur-2xl rounded-2xl p-1.5 shadow-xl border border-black/[0.06] z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[8.5px] font-bold uppercase text-outline tracking-wider text-start">
                    {t.switchDormRoom}
                  </div>
                  <div className="space-y-0.5">
                    {authorizedGroups.map((grp) => (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => {
                            switchGroup(grp.id);
                            setShowGroupMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-start text-[11px] transition-colors cursor-pointer ${
                            grp.id === activeGroup.id
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-surface-container/60 text-on-surface font-normal'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                grp.id === activeGroup.id ? 'bg-primary' : 'bg-outline/40'
                              }`}
                            ></span>
                            <span className="truncate">{grp.name}</span>
                          </div>
                          <span dir="ltr" className="text-[9px] font-mono text-outline shrink-0 ms-1">
                            {grp.code}
                          </span>
                        </button>
                      ))}
                  </div>

                  <div className="pt-1 mt-1 border-t border-black/[0.05]">
                    <button
                      type="button"
                      onClick={handleExit}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-start text-[11px] font-medium text-outline hover:text-on-surface hover:bg-surface-container/60 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">grid_view</span>
                      <span>{t.returnToHome}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Member Profile Initials Chip */}
          <button
            type="button"
            onClick={onOpenProfile}
            title={
              currentMember
                ? `${currentMember.name} (${currentMember.role.replace('_', ' ')})`
                : 'Profile'
            }
            className="w-6.5 h-6.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-black/[0.06] text-on-surface font-semibold text-[10px] flex items-center justify-center transition-transform active:scale-95 relative cursor-pointer"
          >
            {getInitials(currentMember?.name)}
            {currentMember?.role === 'main_admin' && (
              <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-primary text-white flex items-center justify-center text-[6px] font-bold border border-white">
                ★
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
