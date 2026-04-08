import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api';
import { UserPlus, Lock, User, AtSign } from 'lucide-react';
import { motion } from 'framer-motion';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', { username, email, password });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base-300 relative overflow-hidden">
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[100px]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-md bg-base-100 shadow-2xl border border-white/5"
      >
        <div className="card-body gap-6">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold brand tracking-tighter mb-2">Create Account</h1>
            <p className="text-base-content/60 text-sm">Join the community of collaborative tasking</p>
          </div>

          {error && (
            <div className="alert alert-error text-sm rounded-xl py-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-bold opacity-70">Username</span></label>
              <div className="join w-full">
                <div className="join-item bg-base-200 flex items-center px-4 border border-base-content/10"><User size={18} /></div>
                <input
                  type="text"
                  placeholder="johndoe"
                  className="input input-bordered join-item w-full focus:input-primary"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-bold opacity-70">Email Address</span></label>
              <div className="join w-full">
                <div className="join-item bg-base-200 flex items-center px-4 border border-base-content/10"><AtSign size={18} /></div>
                <input
                  type="email"
                  placeholder="john@example.com"
                  className="input input-bordered join-item w-full focus:input-primary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-bold opacity-70">Password</span></label>
              <div className="join w-full">
                <div className="join-item bg-base-200 flex items-center px-4 border border-base-content/10"><Lock size={18} /></div>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="input input-bordered join-item w-full focus:input-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="card-actions mt-6">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-block text-lg font-bold shadow-lg shadow-primary/20"
              >
                {loading ? <span className="loading loading-spinner"></span> : <UserPlus size={20} />}
                {loading ? 'Processing...' : 'Register'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm opacity-60">
            Already have an account?{' '}
            <Link to="/login" className="link link-primary font-bold no-underline hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
