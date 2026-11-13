import React, { useState } from 'react';
import { useRoomSplit } from '../../data/store';
import { useLanguage } from '../../i18n';
import { MIN_GROUP_PASSWORD_LENGTH, validatePasswordStrength } from '../../utils/security';

export const WelcomeScreen: React.FC = () => {
  const {
    supabaseConfigured,
    isAuthLoading,
    authorizedGroups,
    userAccount,
    saveUserAccount,
    clearUserAccount,
    switchGroup,
    createGroup,
    joinGroup,
  } = useRoomSplit();
  const { t, language, setLanguage } = useLanguage();

  // Modals state
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Account creation inputs (used on first visit or edit)
  const [accName, setAccName] = useState<string>('');
  const [accPhone, setAccPhone] = useState<string>('');
  const [accRoom, setAccRoom] = useState<string>('');
  const [accError, setAccError] = useState<string>('');

  // Join group flow state
  const [joinCode, setJoinCode] = useState<string>('');
  const [joinPassword, setJoinPassword] = useState<string>('');
  const [showJoinPass, setShowJoinPass] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>('');

  // Create group flow state
  const [createName, setCreateName] = useState<string>('');
  const [createPassword, setCreatePassword] = useState<string>('');
  const [createCurrency, setCreateCurrency] = useState<'IQD' | 'USD' | 'EUR'>('IQD');
  const [showCreatePass, setShowCreatePass] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  /**
   * Language Toggle Pill shown cleanly at the top of the welcome screen
   */
  const renderLanguagePill = () => (
    <div className="w-full max-w-md flex justify-end mb-3">
      <div className="inline-flex items-center p-0.5 rounded-full bg-white border border-black/[0.06] shadow-xs">
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
            language === 'en'
              ? 'bg-primary text-white shadow-xs'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setLanguage('ar')}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
            language === 'ar'
              ? 'bg-primary text-white shadow-xs'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          العربية
        </button>
      </div>
    </div>
  );

  /**
   * Mandatory First Step:
   * When opening the site without an account, create account first!
   */
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAccError('');

    if (!accName.trim() || !accPhone.trim() || !accRoom.trim()) {
      setAccError(t.accountFieldsError);
      return;
    }

    if (!supabaseConfigured) {
      setAccError(t.supabaseNotConfiguredError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveUserAccount(accName.trim(), accPhone.trim(), accRoom.trim());
      if (!res.success || !res.account) {
        setAccError(res.message || t.accountFieldsError);
        return;
      }
      showToast(t.welcomeAccountReady(res.account.name));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenJoin = () => {
    setJoinCode('');
    setJoinPassword('');
    setJoinError('');
    setShowJoinModal(true);
  };

  const handleOpenCreate = () => {
    setCreateName('');
    setCreatePassword('');
    setCreateCurrency('IQD');
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleJoinWithCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setJoinError('');

    if (!joinCode.trim()) {
      setJoinError(t.enterRoomCodeError);
      return;
    }

    if (!userAccount) {
      setJoinError(t.createAccountFirstError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await joinGroup(joinCode.trim(), joinPassword, {
        name: userAccount.name,
        phone: userAccount.phone,
        roomNumber: userAccount.roomNumber,
      });

      if (res.success && res.group) {
        setShowJoinModal(false);
        setJoinPassword('');
        showToast(res.group.name);
      } else if (res.retryAfterSeconds) {
        setJoinError(t.rateLimitedError(res.retryAfterSeconds));
      } else {
        setJoinError(res.message || t.enterRoomCodeError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setCreateError('');

    if (!createName.trim()) {
      setCreateError(t.enterGroupNameError);
      return;
    }
    const passCheck = validatePasswordStrength(createPassword);
    if (!passCheck.valid) {
      setCreateError(
        passCheck.reason === 'empty'
          ? t.setGroupPasswordError
          : t.passwordLengthError(MIN_GROUP_PASSWORD_LENGTH)
      );
      return;
    }

    if (!userAccount) {
      setCreateError(t.createAccountFirstError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createGroup(
        createName.trim(),
        createPassword.trim(),
        0,
        createCurrency,
        {
          name: userAccount.name,
          phone: userAccount.phone,
          roomNumber: userAccount.roomNumber,
        }
      );

      if (!result.success || !result.group) {
        setCreateError(result.message || t.setGroupPasswordError);
        return;
      }

      setShowCreateModal(false);
      setCreatePassword('');
      showToast(`${result.group.name} · ${result.group.code}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * SCREEN 1: MANDATORY ACCOUNT CREATION FIRST
   */
  if (!userAccount) {
    return (
      <div className="min-h-screen bg-background text-on-surface antialiased flex flex-col items-center justify-center p-4">
        {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-full font-medium text-xs shadow-lg flex items-center gap-2 animate-in fade-in">
            <span className="material-symbols-outlined text-[15px] text-secondary-fixed">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        )}

        {renderLanguagePill()}

        <div className="w-full max-w-md flex flex-col items-center text-center">
          {/* Logo Mark */}
          <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl tracking-tight shadow-lg shadow-primary/20 mb-3">
            RS
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            {t.appName}
          </h1>
          <p className="text-xs text-outline mt-1 max-w-[280px]">
            {t.appSubtitle}
          </p>

          {/* Account Creation Card */}
          <div className="w-full mt-6 bg-white rounded-3xl p-5 shadow-sm border border-black/[0.06] text-start">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {t.firstTimeSetup}
              </span>
              <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-surface-container font-semibold text-outline">
                {t.stepOneOfOne}
              </span>
            </div>
            <h2 className="text-base font-bold text-on-surface">
              {t.createYourAccount}
            </h2>
            <p className="text-xs text-outline mt-0.5 mb-4">
              {t.createAccountDesc}
            </p>

            {!supabaseConfigured && !accError && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-medium mb-3">
                {t.supabaseNotConfiguredError}
              </div>
            )}

            {accError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium mb-3">
                {accError}
              </div>
            )}

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.yourFullName}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.fullNamePlaceholder}
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    {t.phoneNumber}
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    placeholder="07XXXXXXXXX"
                    value={accPhone}
                    onChange={(e) => setAccPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05] text-start"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    {t.roomNumber}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.roomPlaceholder}
                    value={accRoom}
                    onChange={(e) => setAccRoom(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isAuthLoading}
                className="w-full h-11 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform mt-3 cursor-pointer disabled:opacity-60"
              >
                <span>{t.createAccountContinue}</span>
                <span className="material-symbols-outlined text-[16px] rtl:rotate-180">arrow_forward</span>
              </button>
            </form>
          </div>

          <div className="mt-8 text-center text-[11px] text-outline">
            {t.footerCredit}
          </div>
        </div>
      </div>
    );
  }

  /**
   * SCREEN 2: HOMEPAGE (USER HAS AN ACCOUNT)
   */
  return (
    <div className="min-h-screen bg-background text-on-surface antialiased flex flex-col items-center justify-center p-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-full font-medium text-xs shadow-lg flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[15px] text-secondary-fixed">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {renderLanguagePill()}

      {/* Main Container */}
      <div className="w-full max-w-md flex flex-col items-center text-center">
        {/* App Logo & Identity */}
        <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl tracking-tight shadow-lg shadow-primary/20 mb-3">
          RS
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-on-surface">
          {t.appName}
        </h1>
        <p className="text-xs text-outline mt-1 max-w-[280px]">
          {t.appSubtitle}
        </p>

        {/* User Account Badge */}
        <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-black/[0.06] shadow-xs text-start animate-in fade-in">
          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0">
            {userAccount.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 pe-1">
            <span className="text-[11px] font-semibold text-on-surface block truncate leading-tight">
              {userAccount.name}
            </span>
            <span className="text-[9.5px] text-outline block leading-tight truncate">
              {userAccount.roomNumber} · <span dir="ltr">{userAccount.phone}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAccName(userAccount.name);
              setAccPhone(userAccount.phone);
              setAccRoom(userAccount.roomNumber);
              setShowAccountModal(true);
            }}
            title={t.edit}
            className="text-[10px] font-medium text-primary hover:underline ms-1 cursor-pointer"
          >
            {t.edit}
          </button>
        </div>

        {/* TWO LARGE BEAUTIFUL OPTIONS */}
        <div className="w-full flex flex-col gap-3 mt-6">
          {/* 1. JOIN A GROUP */}
          <button
            type="button"
            onClick={handleOpenJoin}
            className="w-full p-4.5 rounded-2xl bg-white hover:bg-surface-container-low border border-black/[0.06] hover:border-primary/40 shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-start flex items-center gap-3.5 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
              <span className="material-symbols-outlined text-[22px]">vpn_key</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface tracking-wide uppercase">
                  {t.joinAGroup}
                </span>
                <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary transition-colors rtl:rotate-180">
                  arrow_forward
                </span>
              </div>
              <p className="text-[11px] text-outline mt-0.5 truncate">
                {t.joinGroupHint(userAccount.name)}
              </p>
            </div>
          </button>

          {/* 2. CREATE A GROUP */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full p-4.5 rounded-2xl bg-white hover:bg-surface-container-low border border-black/[0.06] hover:border-primary/40 shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-start flex items-center gap-3.5 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-[22px]">add_home</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface tracking-wide uppercase">
                  {t.createAGroup}
                </span>
                <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary transition-colors rtl:rotate-180">
                  arrow_forward
                </span>
              </div>
              <p className="text-[11px] text-outline mt-0.5 truncate">
                {t.createGroupHint}
              </p>
            </div>
          </button>
        </div>

        {/* Saved Rooms List on this device (strictly filtered to authorized sessions) */}
        {authorizedGroups.length > 0 && (
          <div className="w-full mt-7 pt-5 border-t border-black/[0.05] text-start">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">
                {t.savedRoomsOnDevice}
              </span>
              <span className="text-[10px] text-outline font-medium">
                {t.roomCount(authorizedGroups.length)}
              </span>
            </div>
            <div className="space-y-1.5">
              {authorizedGroups.map((grp) => (
                <div
                  key={grp.id}
                  onClick={() => switchGroup(grp.id)}
                  className="p-2.5 rounded-xl bg-white hover:bg-surface-container-low border border-black/[0.04] flex items-center justify-between cursor-pointer transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-surface-container text-on-surface text-[10px] font-bold flex items-center justify-center shrink-0">
                      {grp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-on-surface truncate">
                        {grp.name}
                      </h4>
                      <p className="text-[10px] text-outline">
                        {t.codeLabel}: <span dir="ltr" className="font-mono">{grp.code}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-primary flex items-center gap-0.5 shrink-0">
                    <span>{t.enter}</span>
                    <span className="material-symbols-outlined text-[13px] rtl:rotate-180">chevron_right</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-[11px] text-outline">
          {t.footerCredit}
        </div>
      </div>

      {/* JOIN A GROUP MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowJoinModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4.5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 border border-black/[0.06] max-h-[90vh] overflow-y-auto text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-1 mb-2 sm:hidden"></div>

            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] mb-3">
              <div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">
                  {t.roomAccess}
                </span>
                <h2 className="text-sm font-bold text-on-surface">{t.joinAGroupTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {joinError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium mb-3">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinWithCodeSubmit} className="space-y-3">
              {/* Account Confirmation */}
              <div className="p-2.5 rounded-xl bg-surface-container-low/80 border border-black/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {userAccount.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-outline block leading-none">
                      {t.joiningAs}
                    </span>
                    <span className="text-xs font-semibold text-on-surface truncate block">
                      {userAccount.name} ({userAccount.roomNumber})
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold">
                  {t.verified}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.groupCode}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  placeholder="e.g. RS-6582"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs font-mono font-bold uppercase tracking-wider text-on-surface focus:outline-none border border-black/[0.05] text-start"
                />
                <p className="text-[10px] text-outline mt-0.5">
                  {t.groupCodeHint}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.groupPassword}
                </label>
                <div className="relative">
                  <input
                    type={showJoinPass ? 'text' : 'password'}
                    placeholder={t.enterGroupPassword}
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    className="w-full h-9.5 ps-3 pe-9 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJoinPass(!showJoinPass)}
                    className="absolute end-2.5 top-2.5 text-outline hover:text-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {showJoinPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform mt-2 cursor-pointer disabled:opacity-60"
              >
                <span>{t.joinRoomEnter}</span>
                <span className="material-symbols-outlined text-[15px]">door_front</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE A GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4.5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 border border-black/[0.06] max-h-[90vh] overflow-y-auto text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-1 mb-2 sm:hidden"></div>

            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] mb-3">
              <div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-primary block">
                  {t.newRoom}
                </span>
                <h2 className="text-sm font-bold text-on-surface">{t.createAGroupTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium mb-3">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateGroupSubmit} className="space-y-3">
              {/* Admin Creator Info */}
              <div className="p-2.5 rounded-xl bg-surface-container-low/80 border border-black/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {userAccount.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-outline block leading-none">
                      {t.mainAdminCreator}
                    </span>
                    <span className="text-xs font-semibold text-on-surface truncate block">
                      {userAccount.name} ({userAccount.roomNumber})
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {t.adminBadge}
                </span>
              </div>

              {/* Group Name */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.groupName}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.groupNamePlaceholder}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                />
              </div>

              {/* Group Password */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.groupPassword} *
                </label>
                <div className="relative">
                  <input
                    type={showCreatePass ? 'text' : 'password'}
                    required
                    placeholder={t.passwordForRoommates}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="w-full h-9.5 ps-3 pe-9 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePass(!showCreatePass)}
                    className="absolute end-2.5 top-2.5 text-outline hover:text-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {showCreatePass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.currency}
                </label>
                <select
                  value={createCurrency}
                  onChange={(e) => setCreateCurrency(e.target.value as 'IQD' | 'USD' | 'EUR')}
                  className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface focus:outline-none border border-black/[0.05]"
                >
                  <option value="IQD">{t.currencyIQD}</option>
                  <option value="USD">{t.currencyUSD}</option>
                  <option value="EUR">{t.currencyEUR}</option>
                </select>
                <p className="text-[10px] text-outline mt-1">
                  {t.createGroupNote}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform mt-2 cursor-pointer disabled:opacity-60"
              >
                <span>{t.createGroupOpen}</span>
                <span className="material-symbols-outlined text-[15px]">door_front</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowAccountModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4.5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 border border-black/[0.06] text-start">
            <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-1 mb-2 sm:hidden"></div>

            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] mb-3">
              <div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-primary block">
                  {t.studentAccount}
                </span>
                <h2 className="text-sm font-bold text-on-surface">{t.yourAccountProfile}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isSubmitting) return;
                if (!accName.trim() || !accPhone.trim() || !accRoom.trim()) return;
                setIsSubmitting(true);
                try {
                  const res = await saveUserAccount(accName.trim(), accPhone.trim(), accRoom.trim());
                  if (res.success) {
                    setShowAccountModal(false);
                    showToast(t.accountUpdated);
                  } else if (res.message) {
                    showToast(res.message);
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">
                  {t.yourFullName}
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    {t.phoneNumber}
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    value={accPhone}
                    onChange={(e) => setAccPhone(e.target.value)}
                    className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05] text-start"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    {t.roomNumber}
                  </label>
                  <input
                    type="text"
                    required
                    value={accRoom}
                    onChange={(e) => setAccRoom(e.target.value)}
                    className="w-full h-9.5 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-black/[0.05]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await clearUserAccount();
                    setShowAccountModal(false);
                    showToast(t.signedOut);
                  }}
                  className="h-10 px-3.5 rounded-xl bg-surface-container text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                >
                  {t.signOut}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-60"
                >
                  <span>{t.saveChanges}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
