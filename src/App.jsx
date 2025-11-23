// App.jsx (Completo e Aggiornato)

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc, collection, query, where, getDoc, updateDoc, arrayUnion, addDoc, writeBatch, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, storage, appId, SUPER_ADMIN_UIDS } from './lib/firebase';
import { AppContext } from './context/AppContext';

// Pages
import AuthScreen from './pages/AuthScreen';
import CreateProfileScreen from './pages/CreateProfileScreen';
import HomePage from './pages/HomePage';
import ProjectView from './pages/ProjectView';
import ProfilePage from './pages/ProfilePage';

// Components
import Loader from './components/Loader';
import Header from './components/Header';

const App = () => {
  const [user, setUser] = useState(null); 
  const [userProfile, setUserProfile] = useState(null); 
  const [loading, setLoading] = useState(true); 
  
  // Gestione Navigazione
  const [currentView, setCurrentView] = useState('home'); 
  // 💡 selectedProjectData conterrà il project aggiornato
  const [selectedProjectData, setSelectedProjectData] = useState(null); 
  const [viewingUserId, setViewingUserId] = useState(null); 
  
  const [isAdmin, setIsAdmin] = useState(false); 
  const [requestStatus, setRequestStatus] = useState(null); 
  
  // Stati per Amici e Compagnie (Centralizzati)
  const [myFriends, setMyFriends] = useState([]);
  const [myCompanies, setMyCompanies] = useState([]);


  // 1. Auth Listener
  useEffect(() => { 
      return onAuthStateChanged(auth, async (u) => { 
          if(u) { 
              setUser(u); 
              let profileUnsub, adminUnsub, requestUnsub;
              
              const startListeners = () => {
                   try {
                      // Listener Profilo Utente
                      profileUnsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid), d => { 
                          if(d.exists()) setUserProfile(d.data()); 
                          else setUserProfile(null); 
                          setLoading(false); 
                      }, (error) => {
                          console.error("Accesso Denied: user profile:", error);
                          setUserProfile(null); 
                          setLoading(false);
                      }); 
                      
                      const checkAdmin = () => { 
                          if (SUPER_ADMIN_UIDS.includes(u.uid)) { setIsAdmin(true); return; } 
                          return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'admins', u.uid), d => { setIsAdmin(d.exists()); }, (error) => {
                              console.warn("Accesso Denied: Admin state check failed (Expected if not Admin user):", error);
                              setIsAdmin(false); 
                          }); 
                      }; 
                      adminUnsub = checkAdmin(); 
                      
                      requestUnsub = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'admin_requests'), where('userId', '==', u.uid)), s => { 
                          if(!s.empty) setRequestStatus(s.docs[0].data().status); 
                      }); 
                  } catch (e) {
                      console.error("Inizializzazione Listener fallita:", e);
                      setLoading(false); 
                  }
              };
              
              startListeners();
              
              return () => { 
                  if(profileUnsub) profileUnsub(); 
                  if(adminUnsub && typeof adminUnsub === 'function') adminUnsub(); 
                  if(requestUnsub) requestUnsub(); 
              }; 
          } else { 
              setUser(null); setLoading(false); setIsAdmin(false); 
          } 
      }); 
  }, []);

  // Listener per Amici e Compagnie (centralizzato in App.jsx)
  useEffect(() => {
    if (!user || !userProfile || !userProfile.friendIds) return;

    // Listener per i profili Amici
    const friendIds = userProfile.friendIds || [];
    let friendUnsub = () => {};
    if (friendIds.length > 0) {
        const qFriends = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('uid', 'in', friendIds)); 
        friendUnsub = onSnapshot(qFriends, s => {
            setMyFriends(s.docs.map(d => ({ id: d.id, ...d.data(), uid: d.id }))); 
        });
    } else {
        setMyFriends([]);
    }

    // Listener per le Mie Compagnie (fondate o a cui appartengo)
    const qCompanies = query(collection(db, 'artifacts', appId, 'public', 'data', 'companies'), 
        where('memberIds', 'array-contains', user.uid)
    );
    const companyUnsub = onSnapshot(qCompanies, s => {
        setMyCompanies(s.docs.map(d => ({ id: d.id, ...d.data(), uid: d.id })));
    });

    return () => { 
        friendUnsub(); 
        companyUnsub(); 
    };
  }, [db, user, userProfile?.friendIds]);


  // 💡 AGGIUNTO: Listener per tenere aggiornato selectedProjectData
  useEffect(() => {
    if (currentView !== 'project' || !selectedProjectData?.project?.id) return;
    
    const projectId = selectedProjectData.project.id;
    const collType = selectedProjectData.collectionType || 'projects';
    const projRef = doc(db, 'artifacts', appId, 'public', 'data', collType, projectId);
    
    // Questo listener garantisce che 'project' sia sempre aggiornato senza toccare 'currentView'
    const unsub = onSnapshot(projRef, snap => {
        if (snap.exists()) {
             // 💡 Aggiorna solo l'oggetto 'project' interno, mantenendo la stessa struttura esterna
            setSelectedProjectData(prev => {
                // Evita aggiornamenti non necessari
                if (!prev || prev.project.id !== projectId) return prev;
                return {
                    ...prev,
                    project: { id: snap.id, ...snap.data() } 
                };
            });
        } else {
            // Se il progetto viene cancellato da qualcun altro
            goHome(); 
        }
    }, (error) => {
        console.error("Errore nel listener del progetto selezionato:", error);
        // In caso di errore (es. permessi revocati), torna alla home
        goHome();
    });
    
    return unsub;

  }, [db, currentView, selectedProjectData?.project?.id]); // Rimosso collectionType dalle dipendenze

  
  // 2. URL Routing Listener
  useEffect(() => { 
      if(!loading && user && userProfile) { 
          const params = new URLSearchParams(window.location.search); 
          const pId = params.get('p'); 
          const page = params.get('page'); 

          if(pId) { 
              const projRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', pId); 
              getDoc(projRef).then(async (snap) => { 
                  if(snap.exists()) { 
                      const project = {id: snap.id, ...snap.data()}; 
                      const joinType = project.joinType || 'open'; 
                      const isMember = project.memberIds && project.memberIds.includes(user.uid); 
                      
                      if (isMember) { 
                          setSelectedProjectData({project, collectionType: 'projects'}); 
                          setCurrentView('project');
                      } else if (joinType === 'open') { 
                          await updateDoc(projRef, { memberIds: arrayUnion(user.uid) }); 
                          setSelectedProjectData({project, collectionType: 'projects'}); 
                          setCurrentView('project');
                      } 
                  } 
              }); 
          } else if (page === 'profile') {
              setCurrentView('profile');
          } else {
              setCurrentView('home');
          }
      } 
  }, [loading, user, userProfile]);

  const createProfile = async (name) => { 
// ... (omitted createProfile)
  };
  
  const handleJoinRequest = async (trip) => {
// ... (omitted handleJoinRequest)
  };

  // Funzione per tornare alla home resettando l'URL
  const goHome = () => {
      window.history.pushState({}, '', '/'); 
      setCurrentView('home');
      setSelectedProjectData(null);
      setViewingUserId(null); 
  };
  
  // Funzione per navigare ad un profilo specifico
  const onSelectUser = (userId) => {
      setViewingUserId(userId); 
      setCurrentView('profile');
  }


  if(loading) return <Loader />;

  console.log('🔍 App render:', { 
    currentView, 
    hasUser: !!user,
    hasUserProfile: !!userProfile,
    hasSelectedProject: !!selectedProjectData,
    selectedProjectId: selectedProjectData?.project?.id 
  });

  return ( 
    <AppContext.Provider value={{ db, auth, storage, userProfile, user, isAdmin }}>
        {!user ? <AuthScreen /> : 
         !userProfile ? <CreateProfileScreen onSubmit={createProfile} /> : 
         
         /* ROTTA PROFILO */
         currentView === 'profile' ? (
            <>
                <Header 
                    isAdmin={isAdmin} 
                    requestStatus={requestStatus} 
                    onBackHome={goHome} 
                />
                <ProfilePage 
                    db={db} 
                    user={user} 
                    userProfile={userProfile} 
                    storage={storage}
                    viewingUserId={viewingUserId} 
                />
            </>
         ) :

         /* ROTTA PROGETTO SINGOLO */
         currentView === 'project' && selectedProjectData ? (
            <ProjectView 
                // 💡 CHIAVE MANTENUTA: Cruciale per mantenere lo stato interno di ProjectView
                key={selectedProjectData.project.id} 
                project={selectedProjectData.project} 
                collectionType={selectedProjectData.collectionType} 
                onBack={goHome} 
                user={user} 
                userProfile={userProfile} 
                db={db} 
                storage={storage} 
                isAdmin={isAdmin} 
                onJoinRequest={handleJoinRequest} 
                myFriends={myFriends}
                myCompanies={myCompanies}
            />
         ) : 

         /* ROTTA DEFAULT (HOME) */
         (
            <HomePage 
                db={db} 
                storage={storage} 
                user={user} 
                userProfile={userProfile} 
                onSelectProject={(p, type = 'projects') => {
                    setSelectedProjectData({ project: p, collectionType: type });
                    setCurrentView('project');
                }} 
                onSelectUser={onSelectUser} 
                isAdmin={isAdmin} 
                requestStatus={requestStatus} 
                myFriends={myFriends}
                myCompanies={myCompanies}
            />
         )}
    </AppContext.Provider> 
  );
};

export default App;