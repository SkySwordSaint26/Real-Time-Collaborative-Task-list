import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { User, Mail, Save, Loader2, CheckCircle, AtSign, Users as UsersIcon, Key, UserCog } from 'lucide-react';
// import { motion } from 'framer-motion';

const Profile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data);
      setName(response.data.name || response.data.Name || '');
      setEmail(response.data.email || response.data.Email || '');
      
      const role = response.data.role || response.data.Role;
      if (role === 'Admin') {
        fetchAllUsers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await api.get('/users');
      setAllUsers(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/profile', { name, email });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const initiatePasswordReset = async () => {
    setResetLoading(true);
    try {
      await api.post('/auth/password-reset/initiate', { email });
      alert('Password reset token has been generated! (Check server logs in this mock setup)');
    } catch (err) {
      alert('Failed to initiate reset');
    } finally {
      setResetLoading(false);
    }
  };

  const handleRoleAssign = async (userId: number, newRole: string) => {
    try {
      await api.post('/auth/roles/assign', { userId, role: newRole });
      fetchAllUsers();
    } catch (err) {
      alert('Failed to assign role');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-20">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Account Workspace</h1>
        <p className="opacity-60">Manage your profile, security, and administrative tasks.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="space-y-6">
          <div className="card bg-base-100 shadow-xl border border-white/5 h-fit">
            <div className="card-body items-center text-center py-10">
              <div className="avatar placeholder mb-4">
                <div className="bg-primary text-primary-content rounded-full w-24 ring ring-primary ring-offset-base-100 ring-offset-4 font-black text-4xl">
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </div>
              </div>
              <h2 className="card-title text-2xl font-black">{name}</h2>
              <div className="badge badge-primary badge-outline font-black tracking-widest uppercase mt-1">
                {profile?.role || profile?.Role || 'User'}
              </div>
              <div className="divider opacity-10"></div>
              <div className="flex items-center gap-3 text-sm opacity-70">
                <Mail size={16} />
                <span>{email}</span>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-white/5">
            <div className="card-body gap-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Key size={18} className="text-primary" />
                Security
              </h3>
              <p className="text-sm opacity-60">Need to change your password? We can send a reset link to your email.</p>
              <button 
                onClick={initiatePasswordReset}
                disabled={resetLoading}
                className="btn btn-outline btn-block mt-2"
              >
                {resetLoading && <span className="loading loading-spinner"></span>}
                Reset Password
              </button>
            </div>
          </div>
        </div>

        {/* Edit Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card bg-base-100 shadow-xl border border-white/5">
            <div className="card-body gap-8">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <UserCog size={24} className="text-primary" />
                Personal Information
              </h3>
              
              <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label"><span className="label-text font-bold opacity-70 text-[10px] uppercase tracking-widest">Full Name</span></label>
                  <div className="join w-full">
                    <div className="join-item bg-base-200 flex items-center px-4 border border-base-content/10"><User size={18} /></div>
                    <input type="text" className="input input-bordered join-item w-full" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-bold opacity-70 text-[10px] uppercase tracking-widest">Email Address</span></label>
                  <div className="join w-full">
                    <div className="join-item bg-base-200 flex items-center px-4 border border-base-content/10"><AtSign size={18} /></div>
                    <input type="email" className="input input-bordered join-item w-full" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="col-span-full flex justify-end">
                  <button type="submit" disabled={saving} className={`btn btn-primary px-10 ${success ? 'btn-success' : ''}`}>
                    {saving ? <Loader2 className="animate-spin" /> : success ? <CheckCircle size={20} /> : <Save size={20} />}
                    {saving ? 'Saving...' : success ? 'Saved!' : 'Save Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Admin Section */}
          {(profile?.role || profile?.Role) === 'Admin' && (
            <div className="card bg-base-100 shadow-xl border border-white/5">
              <div className="card-body gap-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <UsersIcon size={24} className="text-secondary" />
                  User Management (Admin)
                </h3>
                <div className="overflow-x-auto">
                  <table className="table table-zebra bg-base-200/50 rounded-xl">
                    <thead>
                      <tr className="opacity-50 uppercase text-[10px] tracking-widest">
                        <th>User</th>
                        <th>Role</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="avatar placeholder">
                                <div className="bg-neutral text-neutral-content rounded-full w-8">
                                  <span>{(u.name || u.Name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                              </div>
                              <div>
                                <div className="font-bold">{u.name || u.Name || 'Unknown'}</div>
                                <div className="text-xs opacity-50">ID: {u.id || u.Id}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                             <span className={`badge badge-sm font-bold ${(u.role || u.Role) === 'Admin' ? 'badge-secondary' : 'badge-ghost'}`}>{u.role || u.Role}</span>
                          </td>
                          <td>
                            <div className="dropdown dropdown-end">
                              <label tabIndex={0} className="btn btn-ghost btn-xs">Change Role</label>
                              <ul tabIndex={0} className="dropdown-content z-[2] menu p-2 shadow bg-base-200 rounded-box w-32 border border-white/5">
                                <li><button onClick={() => handleRoleAssign(u.id, 'User')}>User</button></li>
                                <li><button onClick={() => handleRoleAssign(u.id, 'Admin')}>Admin</button></li>
                              </ul>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
