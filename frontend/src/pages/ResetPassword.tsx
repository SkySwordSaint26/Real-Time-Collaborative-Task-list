import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const ResetPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: Token & New Password
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/auth/password-reset/initiate', { email });
      setMessage({ type: 'success', text: 'Reset token sent to your email!' });
      setStep(2);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data || 'Failed to initiate reset' });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/auth/password-reset/complete', { token, newPassword });
      setMessage({ type: 'success', text: 'Password reset successful! Redirecting to login...' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data || 'Failed to reset password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
      >
        <div className="card bg-base-200/50 backdrop-blur-xl border border-white/5 shadow-2xl overflow-hidden">
          <div className="p-8 sm:p-10">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-primary/20 rounded-2xl text-primary ring-1 ring-primary/20">
                <KeyRound size={32} />
              </div>
            </div>

            <h1 className="text-3xl font-black text-center mb-2 tracking-tight">
              {step === 1 ? 'Reset Password' : 'New Password'}
            </h1>
            <p className="text-center opacity-60 text-sm mb-8 font-medium">
              {step === 1 
                ? "Enter your email and we'll send you a reset link." 
                : "Enter the token you received and your new password."}
            </p>

            {message.text && (
              <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} mb-6 border-none text-xs font-bold uppercase tracking-wider`}>
                {message.type === 'success' ? <CheckCircle2 size={16}/> : <Mail size={16}/>}
                <span>{message.text}</span>
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleInitiate} className="space-y-4">
                <div className="form-control">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input
                      type="email"
                      placeholder="Email address"
                      className="input input-bordered w-full pl-12 bg-base-100/50"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  className={`btn btn-primary w-full ${loading ? 'loading' : ''} shadow-lg shadow-primary/20`}
                  disabled={loading}
                >
                  Send Reset Link
                </button>
              </form>
            ) : (
              <form onSubmit={handleComplete} className="space-y-4">
                <div className="form-control">
                  <input
                    type="text"
                    placeholder="Reset Token"
                    className="input input-bordered w-full bg-base-100/50"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                   <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input
                      type="password"
                      placeholder="New Password"
                      className="input input-bordered w-full pl-12 bg-base-100/50"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  className={`btn btn-primary w-full ${loading ? 'loading' : ''} shadow-lg shadow-primary/20`}
                  disabled={loading}
                >
                  Complete Reset
                </button>
                <button 
                  type="button" 
                  className="btn btn-ghost w-full btn-sm"
                  onClick={() => setStep(1)}
                >
                  Back to email
                </button>
              </form>
            )}

            <div className="mt-8 pt-8 border-t border-white/5 text-center">
              <Link to="/login" className="text-sm font-bold flex items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
