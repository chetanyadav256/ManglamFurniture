import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, LockKeyhole, LogOut, Save, UserRound } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { changeAdminPassword } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminPageHeading, BusyLabel, Field, FormAlert, panelClass } from '../components/AdminUI';

export default function AdminSettings() {
  usePageTitle('Admin settings');
  const { admin, token, logout, updateProfileName } = useAdminAuth();
  const navigate = useNavigate();
  const [draftName, setDraftName] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const saving = useRef(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  async function saveProfile(event) {
    event.preventDefault();
    if (saving.current || !admin) return;
    setProfileAttempt((value) => value + 1);
    setProfileError('');
    setProfileMessage('');
    const name = (draftName ?? admin.name ?? '').trim();
    if (!name || name.length > 80) { setProfileError('Name must contain 1–80 characters.'); return; }
    saving.current = true;
    setProfileBusy(true);
    try {
      await updateProfileName(name);
      setDraftName(null);
      setProfileMessage('Display name updated.');
    } catch (error) {
      setProfileError(error.message || 'Unable to save your display name. Please try again.');
    } finally {
      saving.current = false;
      setProfileBusy(false);
    }
  }
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const passwordSaving = useRef(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState(0);
  async function savePassword(event) {
    event.preventDefault();
    if (passwordSaving.current || !admin) return;
    setPasswordAttempt((attempt) => attempt + 1);
    setPasswordError('');
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setPasswordError('Complete all three password fields.');
      return;
    }
    if ([...passwords.next].length < 12) {
      setPasswordError('Use at least 12 characters for the new password.');
      return;
    }
    if (new TextEncoder().encode(passwords.next).length > 72) {
      setPasswordError('The new password must not exceed 72 UTF-8 bytes.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError('The new password and confirmation do not match.');
      return;
    }
    passwordSaving.current = true;
    setPasswordBusy(true);
    try {
      await changeAdminPassword(passwords.current, passwords.next, token);
      setPasswords({ current: '', next: '', confirm: '' });
      logout('passwordChanged');
      navigate('/admin/login', { replace: true });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setPasswords({ current: '', next: '', confirm: '' });
        logout();
        navigate('/admin/login', { replace: true });
      } else if (error.status === 429) {
        setPasswordError('Too many password-change attempts. Please wait before trying again.');
      } else if (!error.status || error.status >= 500) {
        setPasswordError('Unable to confirm whether your password changed. You may need to sign out and sign in again to verify the result.');
      } else {
        setPasswordError(error.message || 'Unable to change your password. Please try again.');
      }
    } finally {
      passwordSaving.current = false;
      setPasswordBusy(false);
    }
  }
  return (
    <>
      <AdminPageHeading
        title="Your workspace, your details."
        description="Your authenticated account details. Update your display name here."
      />
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-sand bg-cream p-4 text-xs leading-6 text-bark">
        <FlaskConical size={18} className="mt-1 shrink-0 text-walnut" />
        <p>
          Your profile shows your signed-in account. You can update your display name; your login email remains read-only.
          After changing your password, sign in again with your new password.
        </p>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className={panelClass}>
          <UserRound size={23} strokeWidth={1.4} className="mb-4 text-warm" />
          <h2 className="font-display text-3xl text-walnut">Profile information</h2>
          <p className="mb-6 mt-2 text-xs leading-6 text-bark">
            Update your display name. Your login email cannot be changed here.
          </p>
          <form noValidate onSubmit={saveProfile} className="space-y-5" aria-busy={profileBusy || !admin}>
            <FormAlert variant="notice">{!admin && 'Authenticated profile information is not available. Please sign in again.'}</FormAlert>
            <FormAlert focusKey={profileAttempt}>{profileError}</FormAlert>
            <FormAlert focusKey={profileAttempt} variant="notice">{profileMessage}</FormAlert>
            <Field label="Display name" id="profile-name" required>
              <input
                id="profile-name"
                required
                maxLength={80}
                className="field rounded-md"
                value={draftName ?? admin?.name ?? ''}
                onChange={(event) => { setDraftName(event.target.value); setProfileMessage(''); }}
                disabled={profileBusy || !admin}
              />
            </Field>
            <Field label="Email (login identifier)" id="profile-email" required>
              <input
                id="profile-email"
                required
                type="email"
                autoComplete="off"
                className="field rounded-md"
                value={admin?.email ?? ''}
                readOnly
              />
            </Field>
            <button type="submit" disabled={profileBusy || !admin} className="btn-primary w-full rounded-md sm:w-auto">
              <BusyLabel busy={profileBusy} busyText="Saving…">
                <Save size={16} />
                Save profile
              </BusyLabel>
            </button>
          </form>
        </section>
        <section className={panelClass}>
          <LockKeyhole size={23} strokeWidth={1.4} className="mb-4 text-warm" />
          <h2 className="font-display text-3xl text-walnut">Change password</h2>
          <p className="mb-6 mt-2 text-xs leading-6 text-bark">
            Enter your current password to choose a new one. You will need to sign in again.
          </p>
          <form
            noValidate
            onSubmit={savePassword}
            className="space-y-5"
            aria-busy={passwordBusy}
          >
            <FormAlert focusKey={passwordAttempt}>{passwordError}</FormAlert>
            {[
              { key: 'current', label: 'Current password' },
              { key: 'next', label: 'New password' },
              { key: 'confirm', label: 'Confirm new password' },
            ].map(({ key, label }) => (
              <Field key={key} label={label} id={`settings-password-${key}`} required>
                <input
                  id={`settings-password-${key}`}
                  type="password"
                  autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                  required
                  className="field rounded-md"
                  disabled={passwordBusy}
                  value={passwords[key]}
                  onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })}
                />
              </Field>
            ))}
            <p className="text-[11px] text-bark">
              New passwords must contain at least 12 characters and no more than 72 UTF-8 bytes.
            </p>
            <button disabled={passwordBusy} className="btn-outline w-full rounded-md sm:w-auto">
              <BusyLabel busy={passwordBusy} busyText="Changing password…">
                Change password
              </BusyLabel>
            </button>
          </form>
        </section>
      </div>
      <section
        className={`${panelClass} mt-5 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center`}
      >
        <div>
          <h2 className="font-display text-2xl text-walnut">Done for now?</h2>
          <p className="mt-2 max-w-lg text-xs leading-6 text-bark">
            Sign out of the admin workspace. Saved catalog changes remain in the database.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/admin/login', { replace: true });
          }}
          aria-label="Logout"
          className="btn-outline shrink-0 rounded-md"
        >
          <LogOut size={16} />
          Logout
        </button>
      </section>
    </>
  );
}
