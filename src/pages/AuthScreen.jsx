import React, { useState, useContext } from 'react';
import { Briefcase, Mail, KeyRound, User, Loader2 } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore'; // <-- AGGIUNTO
import { AppContext } from '../context/AppContext';
import { db, appId } from '../lib/firebase'; // <-- AGGIUNTO db e appId

// --- LOGICA DI CREAZIONE/INIZIALIZZAZIONE PROFILO ---
const initializeUserProfile = async (uid, userName, userEmail) => {
    
    // Riferimento al documento con ID = UID dell'utente
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
    
    const profileData = {
        uid: uid,              // <-- ESSENZIALE: campo richiesto per la query amici
        name: userName,
        email: userEmail,
        createdAt: serverTimestamp(),
        friendIds: [],         // Inizializza gli amici
        wishlist: [],
        // Puoi aggiungere altri campi di default qui
    };

    try {
        await setDoc(userRef, profileData, { merge: true });
        console.log("Profilo utente creato con successo, incluso il campo uid.");
    } catch (error) {
        console.error("Errore durante la creazione del profilo:", error);
        throw new Error("Errore durante la creazione del profilo utente.");
    }
};
// -----------------------------------------------------

const AuthScreen = () => {
  const { auth } = useContext(AppContext);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => { 
      setLoading(true); setError(null); 
      try { 
          // Per Google, l'utente è creato in Auth, ma il profilo Firestore è spesso
          // gestito nel componente principale per reindirizzare a CreateProfileScreen
          await signInWithPopup(auth, new GoogleAuthProvider()); 
      } catch (e) { setError(e.message); } 
      setLoading(false); 
  };
  
  const handleEmail = async (e) => { 
      e.preventDefault(); setLoading(true); setError(null); 
      try { 
          if (isLogin) {
              await signInWithEmailAndPassword(auth, email, password); 
          } else { 
              if(!name) throw new Error("Nome richiesto"); 
              
              const userCredential = await createUserWithEmailAndPassword(auth, email, password); 
              
              // **NOVITÀ**: Inizializza il profilo subito dopo la registrazione (Email)
              await initializeUserProfile(userCredential.user.uid, name, email);

          } 
      } catch (e) { 
          setError(e.message); 
      } 
      setLoading(false); 
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-dark text-white p-4">
        <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-2xl text-brand-dark">
            <div className="text-center mb-6">
                <Briefcase className="w-10 h-10 text-brand-action mx-auto mb-2"/>
                <h1 className="text-3xl font-serif font-bold">{isLogin ? "Accedi" : "Registrati"}</h1>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm font-medium">{error}</div>}

            <form onSubmit={handleEmail} className="space-y-4">
                {!isLogin && <div className="relative"><User className="absolute left-3 top-3.5 w-5 h-5 text-brand-secondary"/><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Tuo Nome" className="w-full pl-10 p-3 rounded-lg border" required /></div>}
                <div className="relative"><Mail className="absolute left-3 top-3.5 w-5 h-5 text-brand-secondary"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full pl-10 p-3 rounded-lg border" required /></div>
                <div className="relative"><KeyRound className="absolute left-3 top-3.5 w-5 h-5 text-brand-secondary"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full pl-10 p-3 rounded-lg border" required /></div>
                
                <button type="submit" disabled={loading} className="w-full bg-brand-action text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin w-6 h-6"/>} {isLogin ? "Accedi" : "Registrati"}
                </button>
            </form>

            <div className="my-4 text-center text-brand-secondary">oppure</div>
            
            <button onClick={handleGoogle} disabled={loading} className="w-full bg-white border py-3 rounded-lg flex justify-center gap-2 font-semibold text-brand-dark hover:bg-gray-50">
                {loading ? <Loader2 className="animate-spin w-6 h-6"/> : <span>Accedi con Google</span>}
            </button>
            
            <button onClick={()=>setIsLogin(!isLogin)} className="mt-6 text-brand-secondary hover:text-brand-dark transition text-sm font-medium w-full">
                {isLogin ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
        </div>
    </div>
  );
};
export default AuthScreen;