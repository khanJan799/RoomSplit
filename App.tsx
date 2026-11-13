/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LanguageProvider, useLanguage } from './i18n';
import { RoomSplitProvider, useRoomSplit } from './data/store';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { AddActionModal } from './components/AddActionModal';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { ExpensesScreen } from './components/screens/ExpensesScreen';
import { ContributionsScreen } from './components/screens/ContributionsScreen';
import { LoansScreen } from './components/screens/LoansScreen';
import { SettlementScreen } from './components/screens/SettlementScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';

const MainApp: React.FC = () => {
  const { activeGroup, leaveGroup } = useRoomSplit();
  const { t } = useLanguage();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  // Modal triggers for specific screens
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [isConfirmContribOpen, setIsConfirmContribOpen] = useState<boolean>(false);
  const [isNewLoanOpen, setIsNewLoanOpen] = useState<boolean>(false);

  // If no group is currently active, show the clean Welcome Homepage
  if (!activeGroup) {
    return <WelcomeScreen />;
  }

  const handleSelectQuickAction = (
    action: 'expense' | 'contribution' | 'loan' | 'settle'
  ) => {
    if (action === 'expense') {
      setCurrentTab('expenses');
      setIsAddExpenseOpen(true);
    } else if (action === 'contribution') {
      setCurrentTab('contributions');
      setIsConfirmContribOpen(true);
    } else if (action === 'loan') {
      setCurrentTab('loans');
      setIsNewLoanOpen(true);
    } else if (action === 'settle') {
      setCurrentTab('settle');
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface antialiased flex flex-col items-center">
      {/* Centered mobile-first application shell */}
      <div className="w-full max-w-md min-h-screen flex flex-col bg-surface shadow-2xl relative border-x border-outline-variant/20">
        {/* Sticky Header with room name, exit back button, language toggle and profile */}
        <Header
          currentTab={currentTab}
          onOpenProfile={() => setIsProfileOpen(true)}
          onLeaveGroup={leaveGroup}
        />

        {/* Scrollable Main Content Canvas */}
        <main className="flex-1 flex flex-col relative w-full px-4 pt-15 pb-24 bg-surface">
          {currentTab === 'dashboard' && (
            <DashboardScreen
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
              onOpenAddExpense={() => {
                setCurrentTab('expenses');
                setIsAddExpenseOpen(true);
              }}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesScreen
              isAddDrawerOpen={isAddExpenseOpen}
              onCloseAddDrawer={() => setIsAddExpenseOpen(false)}
              onOpenAddDrawer={() => setIsAddExpenseOpen(true)}
            />
          )}

          {currentTab === 'contributions' && (
            <ContributionsScreen
              isConfirmModalOpen={isConfirmContribOpen}
              onCloseConfirmModal={() => setIsConfirmContribOpen(false)}
              onOpenConfirmModal={() => setIsConfirmContribOpen(true)}
            />
          )}

          {currentTab === 'loans' && (
            <LoansScreen
              isNewLoanModalOpen={isNewLoanOpen}
              onCloseNewLoanModal={() => setIsNewLoanOpen(false)}
              onOpenNewLoanModal={() => setIsNewLoanOpen(true)}
            />
          )}

          {currentTab === 'settle' && <SettlementScreen />}

          {/* Footer attribution */}
          <footer className="w-full py-3 text-center mt-auto border-t border-surface-container/60">
            <span className="text-[11px] text-outline font-medium">
              {t.footerCredit}
            </span>
          </footer>
        </main>

        {/* Sticky Bottom Dock Navigation */}
        <Navigation
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        />

        {/* Quick Add Modal */}
        <AddActionModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onSelectAction={handleSelectQuickAction}
        />

        {/* Profile & Admin Settings Sheet */}
        {isProfileOpen && (
          <SettingsScreen onClose={() => setIsProfileOpen(false)} />
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <RoomSplitProvider>
        <MainApp />
      </RoomSplitProvider>
    </LanguageProvider>
  );
}
