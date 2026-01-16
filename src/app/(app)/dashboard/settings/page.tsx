/**
 * User Settings Page
 * Profile information and account preferences
 */

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, Mail, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile } = useAuth();

  return (
    <div className="px-6 py-8 md:pt-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-cinzel mb-2">Settings</h1>
          <p className="text-gray-400">Manage your account and preferences</p>
        </div>

        {/* Profile Section */}
        <div className="glass-panel p-6 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-violet-spectral/20 flex items-center justify-center border border-violet-spectral/30">
              <span className="text-violet-spectral font-bold text-2xl">
                {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {profile?.full_name || profile?.username || 'User'}
              </h2>
              <p className="text-gray-400">@{profile?.username || 'username'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-charcoal/50 rounded-lg border border-graphite">
              <User className="w-5 h-5 text-violet-spectral mt-0.5" />
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-400">Username</label>
                <p className="text-white">{profile?.username || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-charcoal/50 rounded-lg border border-graphite">
              <Mail className="w-5 h-5 text-violet-spectral mt-0.5" />
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-400">Email</label>
                <p className="text-white">{user?.email || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-charcoal/50 rounded-lg border border-graphite">
              <Shield className="w-5 h-5 text-violet-spectral mt-0.5" />
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-400">Account Status</label>
                <div className="flex items-center gap-2">
                  <p className="text-white">
                    {user?.email_confirmed_at ? 'Verified' : 'Pending Verification'}
                  </p>
                  {user?.email_confirmed_at && (
                    <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
                      Verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Section */}
        {profile?.default_project_id && (
          <div className="glass-panel p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Default Project</h2>
            <div className="p-4 bg-charcoal/50 rounded-lg border border-graphite">
              <p className="text-white font-medium">{profile.username}-knowledge-base</p>
              <p className="text-sm text-gray-400 mt-1">
                Your personal knowledge base for Quoth documentation
              </p>
            </div>
          </div>
        )}

        {/* Account Actions */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-bold mb-4">Account</h2>
          <div className="space-y-4">
            <div className="p-4 bg-charcoal/50 rounded-lg border border-graphite">
              <h3 className="font-medium text-white mb-2">Export Data</h3>
              <p className="text-sm text-gray-400 mb-4">
                Download all your documentation and settings
              </p>
              <Button variant="outline" disabled>
                Export Data (Coming Soon)
              </Button>
            </div>

            <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
              <h3 className="font-medium text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-400 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button variant="outline" className="text-red-400 border-red-500/20 hover:bg-red-500/10" disabled>
                Delete Account (Coming Soon)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
