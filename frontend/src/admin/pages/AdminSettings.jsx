import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, LockKeyhole, LogOut, Save, UserRound } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPreview } from '../context/AdminPreviewContext';
import { AdminPageHeading, BusyLabel, Field, FormAlert, panelClass } from '../components/AdminUI';

export default function AdminSettings() {
  usePageTitle('Admin settings');
  const { profile, run, notify } = useAdminPreview();
  const [details, setDetails] = useState({ ...profile });
  const [profileError, setProfileError] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState(0);
  async function saveProfile(event) {
    event.preventDefault();
    setProfileAttempt((attempt) => attempt + 1);
    setProfileError('');
    setProfileBusy(true);
    try {
      await run('saveProfile', details);
      notify('Preview profile updated in memory. Real account details are unchanged.');
    } catch (issue) {
      setProfileError(issue.message);
    } finally {
      setProfileBusy(false);
    }
  }
  async function passwordPreview(event) {
    event.preventDefault();
    setPasswordAttempt((attempt) => attempt + 1);
    setPasswordError('');
    setPasswordMessage('');
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setPasswordError('Complete all three password fields.');
      return;
    }
    if (passwords.next.length < 12) {
      setPasswordError('Use at least 12 characters for the new password.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError('The new password and confirmation do not match.');
      return;
    }
    setPasswordBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setPasswords({ current: '', next: '', confirm: '' });
    setPasswordBusy(false);
    setPasswordMessage(
      'Password updates are not connected. No credentials were verified, sent, or stored. The form has been cleared.',
    );
  }
  return (
    <>
      <AdminPageHeading
        title="Your workspace, your details."
        description="Preview account settings. Real account changes require backend authentication."
      />
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-sand bg-cream p-4 text-xs leading-6 text-bark">
        <FlaskConical size={18} className="mt-1 shrink-0 text-walnut" />
        <p>
          Use sample information here. The preview profile is kept only in memory. Password forms
          demonstrate validation and cannot change real credentials.
        </p>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className={panelClass}>
          <UserRound size={23} strokeWidth={1.4} className="mb-4 text-warm" />
          <h2 className="font-display text-3xl text-walnut">Profile information</h2>
          <p className="mb-6 mt-2 text-xs leading-6 text-bark">
            Personalise the display name in this preview.
          </p>
          <form noValidate onSubmit={saveProfile} className="space-y-5" aria-busy={profileBusy}>
            <FormAlert focusKey={profileAttempt}>{profileError}</FormAlert>
            <Field label="Display name" id="profile-name" required>
              <input
                id="profile-name"
                required
                maxLength={80}
                className="field rounded-md"
                value={details.name}
                disabled={profileBusy}
                onChange={(event) => setDetails({ ...details, name: event.target.value })}
              />
            </Field>
            <Field label="Email (preview only)" id="profile-email" required>
              <input
                id="profile-email"
                required
                type="email"
                autoComplete="off"
                className="field rounded-md"
                value={details.email}
                disabled={profileBusy}
                onChange={(event) => setDetails({ ...details, email: event.target.value })}
                placeholder="Sample email for this preview"
              />
            </Field>
            <button disabled={profileBusy} className="btn-primary w-full rounded-md sm:w-auto">
              <BusyLabel busy={profileBusy}>
                <Save size={16} />
                Save preview profile
              </BusyLabel>
            </button>
          </form>
        </section>
        <section className={panelClass}>
          <LockKeyhole size={23} strokeWidth={1.4} className="mb-4 text-warm" />
          <h2 className="font-display text-3xl text-walnut">Change password</h2>
          <p className="mb-6 mt-2 text-xs leading-6 text-bark">
            UI only. Test the form with sample text; do not enter your real password.
          </p>
          <form
            noValidate
            onSubmit={passwordPreview}
            className="space-y-5"
            aria-busy={passwordBusy}
          >
            <FormAlert focusKey={passwordAttempt}>{passwordError}</FormAlert>
            <FormAlert focusKey={passwordAttempt} variant="notice">
              {passwordMessage}
            </FormAlert>
            {[
              { key: 'current', label: 'Current password' },
              { key: 'next', label: 'New password' },
              { key: 'confirm', label: 'Confirm new password' },
            ].map(({ key, label }) => (
              <Field key={key} label={label} id={`settings-password-${key}`} required>
                <input
                  id={`settings-password-${key}`}
                  type="password"
                  autoComplete="off"
                  required
                  className="field rounded-md"
                  disabled={passwordBusy}
                  value={passwords[key]}
                  onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })}
                />
              </Field>
            ))}
            <p className="text-[11px] text-bark">
              New passwords must contain at least 12 characters.
            </p>
            <button disabled={passwordBusy} className="btn-outline w-full rounded-md sm:w-auto">
              <BusyLabel busy={passwordBusy} busyText="Checking form…">
                Preview password change
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
            Exit to the login preview. There is no authenticated session to end. Refreshing resets
            all preview edits.
          </p>
        </div>
        <Link
          to="/admin/login"
          aria-label="Logout (exit UI preview)"
          className="btn-outline shrink-0 rounded-md"
        >
          <LogOut size={16} />
          Exit UI preview
        </Link>
      </section>
    </>
  );
}
