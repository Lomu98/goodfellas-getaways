import React, { useContext } from 'react';
import { LogOut, User, Edit2 } from 'lucide-react'; // Aggiungi Edit2
import { signOut } from 'firebase/auth';
import { AppContext } from '../context/AppContext.jsx'; // AGGIUNTA ESTENSIONE .jsx

const Header = ({ isAdmin, requestStatus, onRequestAdmin, onBackHome }) => {
  const { auth, userProfile } = useContext(AppContext);

  const handleLogoClick = (e) => {
    // Usiamo onBackHome per tornare alla Home Page e resettare il routing
    if (onBackHome) {
        e.preventDefault();
        onBackHome();
    }
  };

  return (
    <header className="bg-brand-dark shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            {/* Logo cliccabile per tornare alla home */}
            <a href="/" onClick={handleLogoClick} className="block group">
                <h1 className="text-2xl font-bold font-serif text-brand-light group-hover:text-white transition-colors">Goodfellas Getaways</h1>
                <p className="text-brand-accent text-xs italic">"As far back as I can remember, I always wanted to travel."</p>
            </a>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-brand-light hidden md:block">
            Ciao, <span className="font-bold">{userProfile?.name}</span>
          </span>
          
          {/* Tasto Profilo Nuovo */}
          <button 
            onClick={() => window.location.search = '?page=profile'} 
            className="flex items-center gap-2 text-xs md:text-sm text-brand-light border border-brand-light/30 px-3 py-1 rounded hover:bg-white/10 transition"
          >
            <User className="w-4 h-4" /> <span className="hidden md:inline">Profilo</span>
          </button>

          {!isAdmin && (
            <button 
              onClick={onRequestAdmin} 
              disabled={requestStatus === 'pending' || requestStatus === 'approved'} 
              className={`text-xs px-3 py-1 rounded border transition-colors ${requestStatus === 'pending' ? 'border-brand-secondary text-brand-secondary cursor-not-allowed' : 'border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-dark'}`}
            >
              {requestStatus === 'pending' ? 'In Attesa...' : 'Diventa Curatore'}
            </button>
          )}
          <button onClick={() => signOut(auth)} className="text-brand-secondary hover:text-white p-2" title="Esci">
            <LogOut className="w-5 h-5"/>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;