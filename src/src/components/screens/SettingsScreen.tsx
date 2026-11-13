import React, { useState } from 'react';
import { useRoomSplit } from '../../data/store';
import { useLanguage } from '../../i18n';
import { canEditGroupSettings } from '../../utils/permissions';
import { MIN_GROUP_PASSWORD_LENGTH, validatePasswordStrength } from '../../utils/security';

interface SettingsScreenProps {
  onClose: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
  const {
    activeGroup,
    currentMember,
    updateMemberProfile,
    updateGroupSettings,
    addCoAdmin,
    removeCoAdmin,
    leaveGroup,
    resetToDefaultData,
  } = useRoomSplit();
  const { language, setLanguage, t } = useLanguage();

  // Profile edit states
  const [name, setName] = useState(currentMember?.name || '');
  const [phone, setPhone] = useState(currentMember?.phone || '');
  const [roomNumber, setRoomNumber] = useState(currentMember?.roomNumber || '');

  // Group settings edit states (Admin only) - never pre-fill stored password/hash
  const [groupName, setGroupName] = useState(activeGroup?.name || '');
  const [groupDesc, setGroupDesc] = useState(activeGroup?.description || '');
  const [groupPassword, setGroupPassword] = useState('');
  const [expectedContrib, setExpectedContrib] = useState<number>(
    activeGroup?.expectedContributionPerMember || 10000
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!activeGroup || !currentMember) return null;

  const isMainAdmin = canEditGroupSettings(currentMember);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const roleBadgeLabel =
    currentMember.role === 'main_admin'
      ? t.mainAdminLabel
      : currentMember.role === 'co_admin'
      ? t.coAdminLabel
      : t.roommateMemberLabel;

  const roleAccessDesc =
    currentMember.role === 'main_admin'
      ? t.adminAccessDesc
      : currentMember.role === 'co_admin'
      ? t.coAdminAccessDesc
      : t.memberAccessDesc;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !roomNumber.trim()) {
      showToast(t.accountFieldsError);
      return;
    }
    const res = await updateMemberProfile(name.trim(), phone.trim(), roomNumber.trim());
    if (res.success) {
      showToast(t.profileUpdatedToast);
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleSaveGroupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSettings) return;
    if (!isMainAdmin) {
      showToast(t.onlyMainAdminSettingsToast);
      return;
    }

    if (groupPassword.trim().length > 0) {
      const passCheck = validatePasswordStrength(groupPassword);
      if (!passCheck.valid) {
        showToast(t.passwordLengthError(MIN_GROUP_PASSWORD_LENGTH));
        return;
      }
    }

    setIsSavingSettings(true);
    try {
      const result = await updateGroupSettings({
        name: groupName.trim(),
        description: groupDesc.trim(),
        newPassword: groupPassword.trim() || undefined,
        expectedContributionPerMember: expectedContrib,
      });
      if (result.success) {
        setGroupPassword('');
        showToast(t.groupSettingsUpdatedToast);
      } else {
        showToast(result.message || t.unauthorizedActionError);
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl p-3.5 shadow-xl flex flex-col max-h-[90vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200 space-y-3 border-t border-black/[0.05]">
        {/* Drag handle */}
        <div className="w-8 h-1 bg-surface-container-highest rounded-full mx-auto -mt-0.5 mb-0.5"></div>

        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
          <div>
            <span className="text-[9px] font-semibold uppercase text-primary tracking-wider block">
              {t.memberSettings}
            </span>
            <h2 className="text-sm font-semibold text-on-surface">{t.profileGroupAdmin}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6.5 h-6.5 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="p-2.5 rounded-xl bg-inverse-surface text-inverse-on-surface text-xs font-medium flex items-center gap-1.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* LANGUAGE SWITCHER CARD */}
        <div className="p-2.5 rounded-xl bg-surface-container-low border border-black/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[16px]">translate</span>
            <span className="text-xs font-semibold text-on-surface">{t.languageLabel}</span>
          </div>
          <div className="inline-flex items-center p-0.5 rounded-xl bg-white border border-black/[0.05]">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all ${
                language === 'en'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              {t.english}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ar')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all ${
                language === 'ar'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              {t.arabic}
            </button>
          </div>
        </div>

        {/* CURRENT ROLE & ACCESS SUMMARY */}
        <div className="p-2.5 rounded-xl bg-surface-container-low border border-black/[0.04] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface">
              {t.memberPermissionsTitle}
            </span>
            <span
              className={`text-[8.5px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                currentMember.role === 'main_admin'
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentMember.role === 'co_admin'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {roleBadgeLabel}
            </span>
          </div>
          <p className="text-[10px] text-on-surface-variant leading-relaxed">
            {roleAccessDesc}
          </p>
        </div>

        {/* MEMBER PROFILE FORM */}
        <form onSubmit={handleSaveProfile} className="space-y-2 p-3 rounded-xl bg-white border border-black/[0.04] shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">badge</span>
              <h3 className="text-xs font-semibold text-on-surface">{t.personalProfile}</h3>
            </div>
            <span className="text-[9.5px] text-outline font-normal">{t.noEmailRequired}</span>
          </div>

          <div>
            <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
              {t.yourFullName}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                {t.phoneNumber}
              </label>
              <input
                type="tel"
                dir="ltr"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXXX"
                className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                {t.roomNumber}
              </label>
              <input
                type="text"
                required
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder={t.roomPlaceholder}
                className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-8 rounded-xl bg-surface-container text-primary hover:bg-surface-container-high text-xs font-medium flex items-center justify-center gap-1 active:scale-98 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">save</span>
            <span>{t.updateProfile}</span>
          </button>
        </form>

        {/* GROUP SETTINGS & CO-ADMINS (Main Admin Only — dropped for members & co-admins) */}
        {isMainAdmin && (
          <div className="p-3 rounded-xl bg-white border border-black/[0.04] shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">admin_panel_settings</span>
                <h3 className="text-xs font-semibold text-on-surface">{t.groupAdminControls}</h3>
              </div>
              <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container font-semibold uppercase">
                {t.mainAdminLabel}
              </span>
            </div>
            <form onSubmit={handleSaveGroupSettings} className="space-y-2">
              <div>
                <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                  {t.groupName}
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                  {t.descriptionDormHall}
                </label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface outline-none border border-black/[0.04]"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                    {t.groupPassword}
                  </label>
                  <input
                    type="password"
                    dir="ltr"
                    placeholder={t.newGroupPasswordPlaceholder}
                    value={groupPassword}
                    onChange={(e) => setGroupPassword(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs font-mono text-on-surface outline-none border border-black/[0.04]"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-semibold text-on-surface block mb-0.5">
                    {t.targetContrib} ({activeGroup.currency})
                  </label>
                  <input
                    type="number"
                    dir="ltr"
                    min="1000"
                    step="500"
                    value={expectedContrib}
                    onChange={(e) => setExpectedContrib(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface outline-none border border-black/[0.04]"
                  />
                </div>
              </div>

              {/* Co-Admin Appointment Section */}
              <div className="pt-1.5 border-t border-black/[0.03] space-y-1.5">
                <span className="text-[10.5px] font-semibold text-on-surface block">
                  {t.memberRolesSection}
                </span>
                <div className="space-y-1">
                  {activeGroup.members.filter((m) => m.id !== activeGroup.mainAdminId).length === 0 ? (
                    <p className="text-[10px] text-outline italic py-1">
                      {t.noOtherMembersJoined(activeGroup.code)}
                    </p>
                  ) : (
                    activeGroup.members
                      .filter((m) => m.id !== activeGroup.mainAdminId)
                      .map((m) => {
                        const isCo = activeGroup.coAdminIds?.includes(m.id);
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-surface-container-low"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-5.5 h-5.5 rounded-full bg-surface-container text-on-surface flex items-center justify-center text-[9px] font-bold shrink-0">
                                {m.name.substring(0, 2).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <span className="text-xs text-on-surface block truncate">{m.name}</span>
                                <span className="text-[9px] text-outline block">
                                  {isCo ? t.coAdminLabel : t.memberRoleLabel}
                                </span>
                              </div>
                            </div>

                            {isCo ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await removeCoAdmin(m.id);
                                  if (ok) showToast(t.nowMemberToast(m.name));
                                }}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-tertiary font-medium hover:bg-error-container shrink-0 cursor-pointer"
                              >
                                {t.makeMember}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await addCoAdmin(m.id);
                                  if (ok) showToast(t.appointedCoAdminToast(m.name));
                                }}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-primary-fixed text-primary font-medium hover:bg-primary-fixed-dim shrink-0 cursor-pointer"
                              >
                                {t.makeCoAdmin}
                              </button>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full h-8.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1 active:scale-98 transition-transform shadow-xs disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[14px]">save</span>
                <span>{t.saveGroupSettings}</span>
              </button>
            </form>
          </div>
        )}

        {/* DATA & STORAGE (Main Admin Only) or LEAVE ROOM (Member/Co-Admin) */}
        {isMainAdmin ? (
          <div className="p-3 rounded-xl bg-surface-container-low border border-black/[0.04] space-y-1.5">
            <span className="text-[11px] font-semibold text-on-surface block">
              {t.dataAndStorage}
            </span>
            <div>
              <button
                type="button"
                onClick={async () => {
                  await resetToDefaultData();
                  showToast(t.resetDataToast);
                  onClose();
                }}
                className="w-full p-2 rounded-xl bg-white text-start text-xs hover:bg-surface-container transition-colors border border-black/[0.03] flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-semibold text-rose-700 block truncate">{t.resetRoomSplitData}</span>
                  <span className="text-[9.5px] text-outline block">
                    {t.clearsLocalStorage}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[15px] text-rose-700">delete</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onClose();
              leaveGroup();
            }}
            className="w-full h-8.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 border border-black/[0.04] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] rtl:rotate-180">logout</span>
            <span>{t.leaveRoomBtn}</span>
          </button>
        )}

        {/* Creator Attribution */}
        <footer className="pt-1 text-center text-[10px] text-outline pb-1">
          <span>{t.footerCreditFull}</span>
        </footer>
      </div>
    </div>
  );
};
