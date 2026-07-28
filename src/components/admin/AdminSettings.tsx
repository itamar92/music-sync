import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useOptionalUser } from '../../hooks/useOptionalUser';
import { db } from '../../services/firebase';
import {
  migrateCollectionsToPublic,
  migratePlaylistsToPublic,
} from '../../utils/migratePublicData';
import { debugCollectionsAndPlaylists, debugDatabase } from '../../utils/debugDatabase';
import { useToast } from '../../hooks/useToast';
import { adminData } from '../../services/adminData';
import { ToastContainer } from '../ui/ToastContainer';
import { AuthStatus } from '../AuthStatus';
import { Icon, IconName } from '../nocturne/icons';

/** A titled block of settings — icon, heading, then whatever the section owns. */
const Section: React.FC<{
  icon: IconName;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ icon, title, description, children }) => (
  <section className="nc-panel" style={{ padding: 22, marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <Icon name={icon} size={16} color="var(--nc-accent-text)" />
      <h2 className="nc-h2" style={{ fontSize: 16 }}>
        {title}
      </h2>
    </div>
    {description && (
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--nc-mut)', maxWidth: 620 }}>
        {description}
      </p>
    )}
    {children}
  </section>
);

export const AdminSettings: React.FC = () => {
  const [user] = useOptionalUser();
  // Both tools below write Firestore documents directly; container mode keeps
  // its library in Postgres and has no equivalent, so they simply don't appear.
  const { grantSelfAdmin, publicDataMigration, clientDropboxAuth } = adminData.capabilities;
  const [grantingAdmin, setGrantingAdmin] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const { toasts, removeToast, showSuccess, showError, showInfo } = useToast();

  const makeSelfAdmin = async () => {
    if (!user) {
      showError('Not signed in', 'You must be logged in to grant admin access.');
      return;
    }

    setGrantingAdmin(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email,
          role: 'admin',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );

      showSuccess('Admin role granted', `${user.email} can now reach the studio. Reloading…`);
      // The admin-role hook reads once on mount, so a reload is the simplest
      // way to pick the new role up everywhere.
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error adding admin:', error);
      showError('Failed to grant admin role', 'Check the console for details.');
    } finally {
      setGrantingAdmin(false);
    }
  };

  const migrate = async () => {
    if (!user) {
      showError('Not signed in', 'You must be logged in to run the migration.');
      return;
    }

    setMigrating(true);
    showInfo('Migration started');

    try {
      await debugCollectionsAndPlaylists(user.uid);
      const collections = await migrateCollectionsToPublic(user.uid);
      const playlists = await migratePlaylistsToPublic(user.uid);
      await debugCollectionsAndPlaylists(user.uid);

      showSuccess(
        'Migration complete',
        `${collections} collections and ${playlists} playlists are now public.`
      );
    } catch (error) {
      console.error('Error running migration:', error);
      showError('Migration failed', 'Check the console for details.');
    } finally {
      setMigrating(false);
    }
  };

  const runDebug = async () => {
    if (!user) {
      showError('Not signed in', 'You must be logged in to inspect the database.');
      return;
    }

    showInfo('Inspecting database', 'Results are written to the browser console.');
    await debugCollectionsAndPlaylists(user.uid);
    await debugDatabase(user.uid);
  };

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="nc-kicker" style={{ marginBottom: 10 }}>
          Studio
        </div>
        <h1 className="nc-h1" style={{ fontSize: 30, marginBottom: 6 }}>
          Settings
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--nc-mut)' }}>
          Integrations, access and one-off maintenance.
        </p>
      </div>

      <Section
        icon="folder"
        title="Dropbox"
        description={
          clientDropboxAuth
            ? 'This browser holds the Dropbox session used to read your folders.'
            : 'The backend holds a long-lived refresh token; this browser never sees a Dropbox credential.'
        }
      >
        <AuthStatus mode="admin" />
      </Section>

      {grantSelfAdmin && (
      <Section
        icon="gear"
        title="Your access"
        description={
          user
            ? `Signed in as ${user.email}. Grant this account the admin role if it doesn't have it yet.`
            : 'Sign in to manage access.'
        }
      >
        <button
          className="nc-btn nc-btn-accent"
          onClick={makeSelfAdmin}
          disabled={grantingAdmin || !user}
        >
          {grantingAdmin ? 'Granting…' : 'Make me admin'}
        </button>
      </Section>
      )}

      {publicDataMigration && (
      <Section
        icon="refresh"
        title="Data migration"
        description="If the public site can't see your library, mark existing collections and playlists as public. Safe to run more than once."
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="nc-btn" onClick={runDebug} disabled={!user}>
            Inspect database
          </button>
          <button className="nc-btn nc-btn-accent" onClick={migrate} disabled={migrating || !user}>
            <Icon
              name="refresh"
              size={14}
              style={migrating ? { animation: 'ms-spin 0.8s linear infinite' } : undefined}
            />
            {migrating ? 'Migrating…' : 'Migrate to public access'}
          </button>
        </div>
      </Section>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
