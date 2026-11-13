import React, { useState } from 'react';
import { useRoomSplit } from '../../data/store';
import { calculateGroupFinancialSummary, formatCurrency } from '../../utils/calculations';

interface GroupsScreenProps {
  onEnterExpenses: () => void;
  onEnterDashboard: () => void;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({
  onEnterExpenses,
  onEnterDashboard,
}) => {
  const {
    authorizedGroups,
    activeGroup,
    currentMember,
    switchGroup,
    createGroup,
    joinGroup,
    contributions,
    expenses,
    loans,
  } = useRoomSplit();
  const groups = authorizedGroups;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupCampus, setNewGroupCampus] = useState('');
  const [newGroupPassword, setNewGroupPassword] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState<'IQD' | 'USD' | 'EUR'>('IQD');
  const [newGroupExpectedContrib, setNewGroupExpectedContrib] = useState<number>(10000);
  const [showNewPass, setShowNewPass] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinName, setJoinName] = useState(currentMember?.name || '');
  const [joinPhone, setJoinPhone] = useState(currentMember?.phone || '');
  const [joinRoom, setJoinRoom] = useState(currentMember?.roomNumber || '');
  const [showJoinPass, setShowJoinPass] = useState(false);
  const [joinError, setJoinError] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const result = await createGroup(
      newGroupName.trim(),
      newGroupPassword,
      newGroupExpectedContrib || 50000,
      newGroupCurrency,
      {
        name: currentMember?.name || 'Admin',
        phone: currentMember?.phone || '07700000000',
        roomNumber: currentMember?.roomNumber || 'Room',
      },
      newGroupDesc.trim()
    );

    if (!result.success || !result.group) {
      showToast(result.message || 'Unable to create room.');
      return;
    }

    setShowCreateModal(false);
    showToast(`Room "${result.group.name}" created! Code: ${result.group.code}`);
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupCampus('');
    setNewGroupPassword('');
  };

  const handleJoinGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

    if (!joinCode.trim()) {
      setJoinError('Please enter a room code (e.g. RS-6582).');
      return;
    }
    if (!joinName.trim() || !joinPhone.trim() || !joinRoom.trim()) {
      setJoinError('Full name, phone, and room number are required.');
      return;
    }

    const res = await joinGroup(joinCode.trim(), joinPassword, {
      name: joinName.trim(),
      phone: joinPhone.trim(),
      roomNumber: joinRoom.trim(),
    });

    if (res.success) {
      setShowJoinModal(false);
      showToast('Joined dorm group successfully!');
      setJoinCode('');
      setJoinPassword('');
    } else {
      setJoinError(res.message || 'Invalid room code or incorrect password.');
    }
  };

  if (!activeGroup || !currentMember) return null;

  const activeSummary = calculateGroupFinancialSummary(
    activeGroup,
    contributions,
    expenses,
    loans
  );
  const memberStat = activeSummary.memberStats[currentMember.id];

  return (
    <div className="flex flex-col w-full pb-6 space-y-2.5">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-full font-medium text-xs shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Welcome & Status Card */}
      <div className="relative overflow-hidden rounded-2xl bg-white p-3 shadow-xs border border-black/[0.04]">
        <div className="flex flex-col space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-primary">
              Welcome back
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[9.5px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {activeGroup.name} Active
            </span>
          </div>
          <h1 className="text-lg font-bold text-on-surface tracking-tight">
            {currentMember.name}
          </h1>
          <p className="text-[10.5px] text-outline">
            {currentMember.roomNumber} · {activeGroup.members.length} Roommates · {activeGroup.currency} Ledger
          </p>
        </div>

        {/* Active Balance Highlight Bento Bar */}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="p-2 rounded-xl bg-surface-container-low/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] text-outline font-medium">Your Balance</span>
              <span
                className={`material-symbols-outlined text-[14px] ${
                  memberStat && memberStat.currentBalance >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {memberStat && memberStat.currentBalance >= 0 ? 'trending_up' : 'trending_down'}
              </span>
            </div>
            <div className="mt-0.5">
              <span
                className={`text-sm font-bold ${
                  memberStat && memberStat.currentBalance > 0
                    ? 'text-emerald-700'
                    : memberStat && memberStat.currentBalance < 0
                    ? 'text-rose-700'
                    : 'text-on-surface'
                }`}
              >
                {memberStat && memberStat.currentBalance > 0 ? '+' : ''}
                {memberStat ? memberStat.currentBalance.toLocaleString() : 0}
              </span>
              <span className="text-[9px] text-outline ml-1 font-semibold">{activeGroup.currency}</span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-surface-container-low/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] text-outline font-medium">Group Fund Left</span>
              <span className="material-symbols-outlined text-[14px] text-primary">savings</span>
            </div>
            <div className="mt-0.5">
              <span className="text-sm font-bold text-on-surface">
                {activeSummary.remainingGroupFund.toLocaleString()}
              </span>
              <span className="text-[9px] text-outline ml-1 font-semibold">{activeGroup.currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid - Refined & Proportioned */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-xs hover:bg-surface-container-low active:scale-95 transition-all text-center border border-black/[0.04]"
        >
          <div className="w-7 h-7 rounded-full bg-primary-fixed text-primary flex items-center justify-center mb-0.5">
            <span className="material-symbols-outlined text-[15px]">group_add</span>
          </div>
          <span className="text-[10.5px] text-on-surface font-medium leading-tight">Create Group</span>
          <span className="text-[9px] text-outline">New Room</span>
        </button>

        <button
          type="button"
          onClick={() => setShowJoinModal(true)}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-xs hover:bg-surface-container-low active:scale-95 transition-all text-center border border-black/[0.04]"
        >
          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mb-0.5">
            <span className="material-symbols-outlined text-[15px]">vpn_key</span>
          </div>
          <span className="text-[10.5px] text-on-surface font-medium leading-tight">Join Code</span>
          <span className="text-[9px] text-outline">6-Digit PIN</span>
        </button>

        <button
          type="button"
          onClick={onEnterDashboard}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-xs hover:bg-surface-container-low active:scale-95 transition-all text-center border border-black/[0.04]"
        >
          <div className="w-7 h-7 rounded-full bg-surface-container text-on-surface flex items-center justify-center mb-0.5">
            <span className="material-symbols-outlined text-[15px]">pie_chart</span>
          </div>
          <span className="text-[10.5px] text-on-surface font-medium leading-tight">Overview</span>
          <span className="text-[9px] text-outline">Analytics</span>
        </button>
      </div>

      {/* Groups List */}
      <div className="flex flex-col space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            My Dorm & Groups
          </span>
          <span className="text-[10.5px] text-outline font-medium">
            {groups.length} Rooms
          </span>
        </div>

        {groups.map((grp) => {
          const isActive = grp.id === activeGroup.id;
          const grpSummary = calculateGroupFinancialSummary(
            grp,
            contributions,
            expenses,
            loans
          );

          return (
            <div
              key={grp.id}
              className={`relative overflow-hidden rounded-2xl p-2.5 shadow-xs transition-all border ${
                isActive
                  ? 'bg-white border-primary/20 ring-1 ring-primary/10'
                  : grp.isArchived
                  ? 'bg-surface-container-low/60 opacity-70 border-black/[0.03]'
                  : 'bg-white border-black/[0.04] hover:border-black/[0.08]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-7.5 h-7.5 rounded-xl flex items-center justify-center font-bold text-[10.5px] shrink-0 ${
                      isActive
                        ? 'bg-primary text-white'
                        : grp.isArchived
                        ? 'bg-surface-container text-outline'
                        : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {grp.name.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-semibold text-on-surface truncate">
                        {grp.name}
                      </h3>
                      {isActive && (
                        <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[8.5px] font-semibold uppercase">
                          Active
                        </span>
                      )}
                      {grp.isArchived && (
                        <span className="px-1.5 py-0.2 rounded bg-surface-container text-outline text-[8.5px] font-semibold uppercase">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-outline truncate mt-0.5">
                      {grp.description || grp.campus || 'Shared dorm room'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 pl-1">
                  <span className="text-[8.5px] font-semibold text-outline uppercase tracking-wider">
                    Code
                  </span>
                  <span className="text-[11px] font-mono font-bold text-primary">
                    {grp.code}
                  </span>
                </div>
              </div>

              {/* Members Thumbnails & Total spend */}
              <div className="mt-2 flex items-center justify-between pt-1 border-t border-black/[0.03]">
                <div className="flex items-center -space-x-1">
                  {grp.members.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      title={m.name}
                      className="w-5.5 h-5.5 rounded-full bg-surface-container text-on-surface text-[8.5px] font-semibold flex items-center justify-center border border-white"
                    >
                      {m.name.substring(0, 2).toUpperCase()}
                    </div>
                  ))}
                  {grp.members.length > 4 && (
                    <div className="w-5.5 h-5.5 rounded-full bg-surface-container text-outline text-[8.5px] font-semibold flex items-center justify-center border border-white">
                      +{grp.members.length - 4}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-outline">Total Spend</span>
                  <span className="text-[11px] font-semibold text-on-surface">
                    {formatCurrency(grpSummary.totalExpenses, grp.currency)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-1.5 flex items-center gap-1.5">
                {isActive ? (
                  <button
                    type="button"
                    onClick={onEnterExpenses}
                    className="flex-1 h-7.5 rounded-xl bg-primary text-white text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                  >
                    <span>Enter {grp.name}</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      switchGroup(grp.id);
                      showToast(`Switched active context to ${grp.name}`);
                    }}
                    className="flex-1 h-7.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <span>Switch to {grp.name}</span>
                    <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                  </button>
                )}

                <button
                  type="button"
                  title="Copy Group Code"
                  onClick={() => {
                    navigator.clipboard?.writeText(grp.code);
                    showToast(`Copied code ${grp.code} to clipboard!`);
                  }}
                  className="w-7.5 h-7.5 rounded-xl bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors active:scale-95 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">share</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Create New Room */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl p-4 shadow-xl flex flex-col max-h-[85vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200 border-t border-black/[0.05]">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-0.5 mb-1.5"></div>
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-black/[0.04]">
              <div>
                <h2 className="text-sm font-bold text-on-surface">Create New Room</h2>
                <p className="text-[11px] text-outline">
                  You will automatically become the Main Admin
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-0.5">
                  Group / Room Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 65, Dorm Hall 4"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.04]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-0.5">
                  Campus / Dorm Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Baghdad Medical Hall B, 3rd Floor"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.04]"
                />
              </div>

              {/* Currency Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-0.5">
                  Currency
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['IQD', 'USD', 'EUR'] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setNewGroupCurrency(curr)}
                      className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                        newGroupCurrency === curr
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-surface-container text-outline hover:text-on-surface'
                      }`}
                    >
                      <span>{curr}</span>
                      <span className="text-[10px] opacity-75">
                        {curr === 'IQD' ? 'ع.د' : curr === 'USD' ? '$' : '€'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-0.5">
                  Expected Contribution per Member ({newGroupCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={newGroupExpectedContrib}
                  onChange={(e) => setNewGroupExpectedContrib(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface focus:outline-none border border-black/[0.04]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-0.5">
                  Group Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="Set password for your roommates"
                    value={newGroupPassword}
                    onChange={(e) => setNewGroupPassword(e.target.value)}
                    className="w-full h-9 pl-2.5 pr-8 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.04]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2 top-2 text-outline"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {showNewPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-9.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-transform"
              >
                <span>Create Group & Enter</span>
                <span className="material-symbols-outlined text-[15px]">door_front</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Join Existing Room */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setShowJoinModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl p-4 shadow-xl flex flex-col max-h-[85vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200 border-t border-black/[0.05]">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-0.5 mb-1.5"></div>
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-black/[0.04]">
              <div>
                <h2 className="text-sm font-bold text-on-surface">Join Existing Room</h2>
                <p className="text-[11px] text-outline">
                  Enter the code and password from your roommate
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {joinError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinGroupSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-0.5">
                  Room Split Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RS-6582"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface uppercase font-mono tracking-wider font-bold focus:outline-none border border-black/[0.04]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-0.5">
                  Group Password
                </label>
                <div className="relative">
                  <input
                    type={showJoinPass ? 'text' : 'password'}
                    placeholder="Enter group password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    className="w-full h-9 pl-2.5 pr-8 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.04]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJoinPass(!showJoinPass)}
                    className="absolute right-2 top-2 text-outline"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {showJoinPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low/70 space-y-1.5 border border-black/[0.03]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                  Your Room Profile
                </span>
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-white text-xs text-on-surface focus:outline-none border border-black/[0.04]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="tel"
                    required
                    placeholder="Phone: 07XXXXXXXXX"
                    value={joinPhone}
                    onChange={(e) => setJoinPhone(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-white text-xs text-on-surface focus:outline-none border border-black/[0.04]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Room: Room 65 · Bed C"
                    value={joinRoom}
                    onChange={(e) => setJoinRoom(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-white text-xs text-on-surface focus:outline-none border border-black/[0.04]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-9.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-transform"
              >
                <span>Verify & Enter Group</span>
                <span className="material-symbols-outlined text-[15px]">login</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
