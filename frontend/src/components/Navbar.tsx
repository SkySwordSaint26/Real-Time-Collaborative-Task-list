import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, LayoutDashboard, CheckSquare, Palette } from 'lucide-react';

const Navbar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const themes = ["dark", "luxury", "emerald", "cupcake"];

  return (
    <div className="navbar bg-base-100/50 backdrop-blur-md sticky top-0 z-50 border-b border-white/5 px-4 mb-4">
      <div className="navbar-start">
        <div className="dropdown">
          <label tabIndex={0} className="btn btn-ghost lg:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /></svg>
          </label>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-200 rounded-box w-52">
            <li><Link to="/"><LayoutDashboard size={18}/> Dashboard</Link></li>
            <li><Link to="/profile"><User size={18}/> Profile</Link></li>
          </ul>
        </div>
        <Link to="/" className="flex items-center gap-2 px-2 hover:opacity-80 transition-opacity">
          <div className="bg-primary p-2 rounded-xl text-primary-content">
            <CheckSquare size={20} />
          </div>
          <span className="brand text-xl font-bold tracking-tight hidden sm:block">CollabTask</span>
        </Link>
      </div>

      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1 gap-2">
          <li><Link to="/" className="font-medium"><LayoutDashboard size={18}/> Dashboard</Link></li>
          <li><Link to="/profile" className="font-medium"><User size={18}/> Profile</Link></li>
        </ul>
      </div>

      <div className="navbar-end gap-2">
        {/* Theme Switcher */}
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle">
            <Palette size={20} />
          </label>
          <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-2xl bg-base-200 rounded-box w-52 border border-white/5">
            <li className="menu-title">Select Theme</li>
            {themes.map(t => (
              <li key={t}>
                <button 
                  data-set-theme={t} 
                  className="capitalize"
                  onClick={() => document.documentElement.setAttribute('data-theme', t)}
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
              <img src={`https://ui-avatars.com/api/?name=${user?.unique_name || 'User'}&background=random`} alt="avatar" />
            </div>
          </label>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-2xl bg-base-200 rounded-box w-52 border border-white/5">
            <li className="menu-title">{user?.unique_name || 'Account'}</li>
            <li><Link to="/profile">Profile Settings</Link></li>
            <li><button onClick={handleLogout} className="text-error">Logout</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
