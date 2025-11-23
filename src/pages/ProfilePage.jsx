import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapPin, Calendar, Users, Trophy, Star, Edit2, Clock, Plus, Search, Plane, Car, Globe, User, ScrollText, Bell, Check, X } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore'; 
import { getCoordinates } from '../utils/geoUtils'; 
import TravelMap from '../components/TravelMap';
import Loader from '../components/Loader'; // 👈 ORA IMPORTATO CORRETTAMENTE
import EditProfileModal from '../components/EditProfileModal';
import { appId } from '../lib/firebase';
import { formatDateRange } from '../utils/dateUtils';


// Helper per calcolare l'età
const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const diffMs = Date.now() - new Date(birthdate).getTime();
    const ageDt = new Date(diffMs); 
    return Math.abs(ageDt.getUTCFullYear() - 1970);
};

// Componente helper per il Badge Livello (include la logica al click)
const LevelBadge = ({ stats, onClick, showLevelInfo }) => {
    const isMax = stats.nextRankName === 'Leggenda (MAX)';
    const totalProgress = Math.min(100, stats.progressPercent);
    const accentColor = '#C6A875'; // Brand accent color

    // Stili dinamici: Riempimento proporzionale del badge Livello (da opaco a vivido)
    const dynamicStyle = {
        // Riempie il badge con il colore ACCENTO proporzionalmente al progresso
        backgroundImage: isMax 
            ? `linear-gradient(to right, ${accentColor} 100%, ${accentColor} 0%)` 
            : `linear-gradient(to right, ${accentColor} ${totalProgress}%, rgba(198, 168, 117, 0.3) ${totalProgress}%)`,
        border: `1px solid ${accentColor}`,
        backgroundColor: 'transparent',
    };

    return (
        <div className="relative z-50 flex gap-2" onClick={onClick}> 
            {/* Badge Livello (Nome) */}
            <div 
                className={`relative px-3 py-1 rounded-full text-sm font-bold uppercase tracking-widest flex items-center gap-1 cursor-pointer overflow-hidden transition-shadow hover:shadow-lg`}
                title={isMax ? "Livello Massimo" : `Prossimo: ${stats.nextRankName}`}
                style={dynamicStyle}
            >
                {/* Testo sempre leggibile */}
                <span className="relative z-10 flex items-center gap-1 text-brand-dark drop-shadow-sm"> 
                    <Trophy className="w-4 h-4 text-brand-dark" /> 
                    {stats.rank} 
                </span>
            </div>

            {/* Badge XP Separato */}
            <div 
                className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-widest flex items-center gap-1 cursor-pointer bg-white/20`}
            >
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> 
                {stats.xp} XP
            </div>
            
            {/* Banner Informativo */}
            {showLevelInfo && !isMax && (
                <div className="absolute top-full mt-2 right-0 bg-white text-brand-dark p-4 rounded-xl shadow-2xl text-xs z-50 w-64 border border-gray-100 animate-fade-in whitespace-normal origin-top-right">
                    <div className="flex justify-between items-center mb-2 border-b pb-2 border-gray-100">
                        <span className="font-bold text-brand-action text-sm">Progresso Livello</span>
                    </div>
                    <p className="mb-2 text-gray-600">
                        Sei al <strong>{stats.progressPercent.toFixed(0)}%</strong> del livello corrente.
                    </p>
                    <div className="bg-brand-light/50 p-2 rounded text-center">
                        <span className="block text-brand-secondary mb-1">Obiettivo</span>
                        <strong className="text-brand-dark">+{stats.pointsToNext} XP</strong> per raggiungere <span className="text-brand-accent font-bold">{stats.nextRankName}</span>
                    </div>
                </div>
            )}
        </div>
    );
};


const ProfilePage = ({ db, user, userProfile, storage, viewingUserId, onSelectUser }) => { 
  // ----------------------------------------------------
  // STATI
  // ----------------------------------------------------
  const [targetUser, setTargetUser] = useState(user); 
  const [targetProfile, setTargetProfile] = useState(userProfile); 
  const [myTrips, setMyTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]); 
  const [localFriendIds, setLocalFriendIds] = useState([]); 
  const [wishlistRaw, setWishlistRaw] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  const [isEditing, setIsEditing] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const [showFriends, setShowFriends] = useState(false); 
  
  // Wishlist
  const [wishlistLocations, setWishlistLocations] = useState([]);
  const [newWishItem, setNewWishItem] = useState('');
  
  // Determina l'ID utente da usare
  const currentUserId = viewingUserId || user.uid; 
  const isMyProfile = currentUserId === user.uid; 


  // ----------------------------------------------------
  // 1. DATA LISTENERS
  // ----------------------------------------------------
  
  // Listener 0: Caricamento Dati Utente Target
  useEffect(() => {
    if (!currentUserId) return;
    setLoading(true);

    // Se stiamo guardando il nostro profilo, usiamo i dati iniziali passati (per immediatezza)
    if (isMyProfile) {
        setTargetProfile(userProfile);
        setLocalFriendIds(userProfile.friendIds || []);
        setWishlistRaw(userProfile.wishlist || []);
        setTargetUser(user);
    }

    const targetUserRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUserId);
    const unsubTarget = onSnapshot(targetUserRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTargetProfile(data); 
        setLocalFriendIds(data.friendIds || []); 
        setWishlistRaw(data.wishlist || []); 
        setTargetUser({ uid: currentUserId, email: data.email, name: data.name }); 
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching target user profile:", error);
        setLoading(false);
    });

    return unsubTarget;
  }, [db, currentUserId, isMyProfile, user, userProfile]);

  // Listener 1: Viaggi (Ora per l'utente target)
  useEffect(() => {
    if (!currentUserId) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), where('memberIds', 'array-contains', currentUserId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const rawTrips = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Geocoding dei viaggi
        const tripsWithGeo = await Promise.all(rawTrips.map(async (t) => {
            if (t.coords && t.country) return t;
            if (!t.location || t.location.trim() === '') return { ...t, coords: null, country: '' };
            
            const geoData = await getCoordinates(t.location);
            return { 
                ...t, 
                coords: geoData?.coords || null,
                country: geoData?.country || ''
            };
        }));
        
        setMyTrips(tripsWithGeo);
    });
    return unsubscribe;
  }, [db, currentUserId]);

  // Listener 2b: Richieste di Amicizia in Entrata (SOLO per il PROFILO PROPRIO)
  useEffect(() => {
    if (!isMyProfile) {
        setPendingRequests([]);
        return; 
    }
    const qRequests = query(collection(db, 'artifacts', appId, 'public', 'data', 'friend_requests'), 
                            where('receiverId', '==', user.uid), 
                            where('status', '==', 'pending'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
        setPendingRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsubRequests;
  }, [db, user.uid, isMyProfile]);


  // Listener 3: Lista Amici Confermato (Ora dipende da localFriendIds)
  useEffect(() => {
      const friendIdsToQuery = localFriendIds || [];
      
      // Se non ci sono ID, resettiamo e usciamo.
      if (!friendIdsToQuery.length) {
          setFriends([]);
          return;
      }

      // **CORREZIONE**: Rimuovo il .slice(0, 10) e uso l'array completo. 
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), 
                      where('uid', 'in', friendIdsToQuery)
      );
      
      const unsub = onSnapshot(q, (snapshot) => {
          // Filtriamo l'utente loggato se presente per errore nel fallback
          const friendList = snapshot.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(f => f.uid !== currentUserId); 
            
          setFriends(friendList);
      });

      return unsub;
  }, [db, currentUserId, localFriendIds]); 


  // 3. Geocodifica Wishlist (Locali e Paesi)
  useEffect(() => {
      const enrichWishlist = async () => {
          const enriched = await Promise.all(wishlistRaw.map(async (name) => {
              const geoData = await getCoordinates(name);
              return { 
                  name, 
                  coords: geoData?.coords || null,
                  country: geoData?.country || name 
              };
          }));
          setWishlistLocations(enriched.filter(item => item.coords));
      };
      if (wishlistRaw.length > 0) enrichWishlist();
      else setWishlistLocations([]);
  }, [wishlistRaw]);

  // ----------------------------------------------------
  // 4. LOGICA E CALCOLI / AZIONI UTENTE
  // ----------------------------------------------------
  
  // Queste azioni sono disponibili solo se isMyProfile è vero
  const updateWishlist = async (newList) => {
      if (!isMyProfile) return;
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
      await updateDoc(userRef, { wishlist: newList });
  };

  const handleToggleWishlistCountry = (countryName) => {
      if (!isMyProfile) return;
      
      let newList;
      const normalizedName = countryName.toLowerCase();
      const exists = wishlistRaw.some(w => w.toLowerCase() === normalizedName);
      if (exists) {
          newList = wishlistRaw.filter(c => c.toLowerCase() !== normalizedName);
      } else {
          const status = stats.getCountryStatus(countryName); 
          if (status === 'visited' || status === 'upcoming') {
              console.error(`Il paese ${countryName} è già segnato come ${status === 'visited' ? 'VISITATO' : 'IN PROGRAMMA'}!`);
              return;
          }
          newList = [...wishlistRaw, countryName];
      }
      updateWishlist(newList);
  };

  const handleAddCustomLocation = async (e) => {
      e.preventDefault();
      if (!isMyProfile) return;
      
      if (!newWishItem.trim()) return;
      const item = newWishItem.trim();
      const isDuplicate = wishlistRaw.some(i => i.toLowerCase() === item.toLowerCase());
      if (isDuplicate) {
          console.error("È già nella tua lista!");
          return;
      }
      const tempStatus = stats.getCountryStatus(item);
      if (tempStatus === 'visited' || tempStatus === 'upcoming') {
          console.error(`La località o il paese è già segnato come ${tempStatus === 'visited' ? 'VISITATO' : 'IN PROGRAMMA'}!`);
          return;
      }

      const newList = [...wishlistRaw, item];
      await updateWishlist(newList);
      setNewWishItem('');
  };
  
  const handleLevelBadgeClick = (e) => {
      e.stopPropagation();
      setShowLevelInfo(prev => !prev);
  }

  // --- LOGICA AMICIZIA (funzione non modificata, usa writeBatch) ---
  const handleRequestAction = useCallback(async (request, accept) => {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'friend_requests', request.id);
      
      // 1. Aggiorna lo stato della richiesta
      batch.update(requestRef, { status: accept ? 'accepted' : 'rejected' });
      
      if (accept) {
          // 2. Aggiorna il profilo del mittente (aggiungi me)
          const senderRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', request.senderId);
          // Usiamo arrayUnion per aggiungere l'ID dell'utente corrente (io) all'array friendIds del mittente
          batch.update(senderRef, { friendIds: arrayUnion(user.uid) });

          // 3. Aggiorna il mio profilo (aggiungi il mittente)
          const receiverRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
          // Usiamo arrayUnion per aggiungere l'ID del mittente all'array friendIds del ricevente (me)
          batch.update(receiverRef, { friendIds: arrayUnion(request.senderId) });
      }

      try {
          await batch.commit();
      } catch (error) {
          console.error("Errore nell'azione richiesta:", error);
      }
  }, [db, user.uid]);


  const stats = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      
      let totalXP = 0;
      let totalKm = 0;

      const visited = myTrips.filter(t => t.dateEnd && t.dateEnd < today);
      const upcoming = myTrips.filter(t => !t.dateEnd || t.dateEnd >= today);
      const organized = myTrips.filter(t => t.createdBy === currentUserId && !t.basedOn); 
      
      // Funzione di utilità per la mappa (usata anche per i controlli lato client)
      const getCountryStatus = (locationName) => {
          const normalizedName = locationName.toLowerCase();
          const belongsToCountry = (t) => {
              if (t.country && t.country.toLowerCase() === normalizedName) return true;
              if (t.location && t.location.toLowerCase().includes(normalizedName)) return true;
              return false;
          };
          
          const isVisited = myTrips.some(t => {
              const isPast = t.dateEnd && new Date(t.dateEnd) < new Date();
              return isPast && belongsToCountry(t);
          });
          if (isVisited) return 'visited';

          const isUpcoming = myTrips.some(t => {
              const isFuture = !t.dateEnd || new Date(t.dateEnd) >= new Date();
              return isFuture && belongsToCountry(t);
          });
          if (isUpcoming) return 'upcoming';
          
          const inWishlist = wishlistRaw.some(w => w.toLowerCase() === normalizedName);
          if (inWishlist) return 'wishlist';

          return 'neutral';
      };

      // Calcolo XP dettagliato
      visited.forEach(t => {
          const isOrganizer = organized.some(o => o.id === t.id);
          
          let tripKm = Number(t.totalKm || 0); 
          totalKm += tripKm;

          let xp = isOrganizer ? 250 : 50;
          if (isOrganizer) {
              const numParticipants = (t.memberIds?.length || 1) - 1;
              xp += numParticipants * 10;
          }
          xp += Math.floor(tripKm / 100);
          totalXP += xp;
      });

      totalXP += wishlistRaw.length * 10;

      const levels = [
          { name: "Novizio", threshold: 0 },
          { name: "Esploratore", threshold: 200 },
          { name: "Viaggiatore Esperto", threshold: 500 },
          { name: "Goodfella", threshold: 1000 },
          { name: "Boss dei Cieli", threshold: 2000 },
          { name: "Leggenda", threshold: 5000 }
      ];

      let currentLevelIndex = 0;
      for(let i=0; i<levels.length; i++) {
          if (totalXP >= levels[i].threshold) currentLevelIndex = i;
          else break;
      }
      
      const currentRank = levels[currentLevelIndex];
      const nextRank = levels[currentLevelIndex + 1];
      
      let progressPercent = 100;
      let pointsToNext = 0;

      if (nextRank) {
          const range = nextRank.threshold - currentRank.threshold;
          const currentProgress = totalXP - currentRank.threshold;
          progressPercent = Math.min(Math.max((currentProgress / range) * 100, 5), 100); 
          pointsToNext = nextRank.threshold - totalXP;
      }

      return { 
          visited, upcoming, organized, wishlistRaw, 
          xp: totalXP, 
          totalKm: Math.round(totalKm), 
          rank: currentRank.name, 
          progressPercent, 
          pointsToNext, 
          nextRankName: nextRank ? nextRank.name : "Leggenda (MAX)",
          getCountryStatus 
      };
  }, [myTrips, currentUserId, wishlistRaw]);


  // ----------------------------------------------------
  // 5. RENDER
  // ----------------------------------------------------
  const profile = targetProfile || {}; 
  const targetUserData = targetUser || {}; 
  const residence = profile.residence || '';
  const nationality = profile.nationality || '';
  const birthdate = profile.birthdate || '';
  const description = profile.description || 'Nessuna descrizione';
  const age = birthdate ? calculateAge(birthdate) : null;
  const userAge = age;


  if (loading) return <Loader text={`Caricamento profilo ${isMyProfile ? "" : profile.name}...`} />;

  return (
    <div className="min-h-screen bg-brand-light pb-20 relative" onClick={() => setShowLevelInfo(false)}>
      
      {/* 1. FASCIA BLU SCURA */}
      <div className="bg-brand-dark text-white pt-10 pb-40 px-6 rounded-b-[3rem] shadow-2xl relative overflow-hidden z-0">
         {/* Effetti di sfondo */}
         <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-brand-accent blur-3xl"></div>
             <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full bg-blue-500 blur-3xl"></div>
         </div>
         
         <div className="max-w-7xl mx-auto relative z-10">
             <div className="flex flex-col md:flex-row justify-between items-start gap-8">

                {/* INFO UTENTE E AVATAR (SINISTRA) */}
                <div className="flex items-start gap-6 w-full md:w-auto">
                    
                    {/* Avatar e Tasto Modifica */}
                    <div className="relative group shrink-0 mt-2">
                        <div className="w-24 h-24 rounded-full border-4 border-brand-accent shadow-xl overflow-hidden bg-white flex items-center justify-center text-3xl font-bold text-brand-dark">
                            {profile.photoUrl ? (
                                <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                profile.name?.charAt(0).toUpperCase() || targetUserData.email?.charAt(0).toUpperCase()
                            )}
                        </div>
                        {isMyProfile && (
                            <button onClick={() => setIsEditing(true)} className="absolute bottom-0 right-0 bg-white text-brand-dark p-1.5 rounded-full shadow-lg hover:bg-gray-100 transition">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Dettagli Testuali */}
                    <div className="text-left w-full">
                        <h1 className="text-3xl font-serif font-bold mb-2">{profile.name}</h1>
                        
                        <div className="space-y-1 text-sm text-gray-300">
                            {nationality && (<p className="flex items-center gap-2"><Globe className="w-4 h-4 text-brand-accent"/> {nationality}</p>)}
                            {residence && (<p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-accent"/> Residente a {residence}</p>)}
                            {birthdate && (<p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-accent"/> {userAge} anni</p>)}
                        </div>

                        {description !== 'Nessuna descrizione' && (
                            <p className="text-sm mt-3 text-gray-200 italic max-w-md line-clamp-2">{description}</p>
                        )}
                    </div>
                </div>

                {/* METRICHE E LIVELLO (DESTRA) */}
                <div className="w-full md:w-auto mt-8 md:mt-0">
                    
                    {/* Badge Livello Interattivo */}
                    <div className="flex justify-end relative z-50 w-full mb-4">
                         <LevelBadge 
                            stats={stats} 
                            onClick={handleLevelBadgeClick} 
                            showLevelInfo={showLevelInfo} 
                         />
                    </div>

                    {/* Contenitore Metriche (Griglia 2x2) */}
                    <div className="flex justify-end">
                        <div className="grid grid-cols-2 gap-3" style={{ width: '240px' }}> 
                            
                            {/* Box 1: Visitati */}
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm hover:bg-white/20 transition flex flex-col justify-center items-center">
                                <div className="text-2xl font-bold font-serif">{stats.visited.length}</div>
                                <div className="text-[10px] uppercase text-gray-300 tracking-wider">Visitati</div>
                            </div>

                            {/* Box 2: In Programma */}
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm hover:bg-white/20 transition flex flex-col justify-center items-center">
                                <div className="text-2xl font-bold font-serif">{stats.upcoming.length}</div>
                                <div className="text-[10px] uppercase text-gray-300 tracking-wider">In Programma</div>
                            </div>
                            
                            {/* Box 3: Wishlist */}
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm hover:bg-white/20 transition flex flex-col justify-center items-center">
                                <div className="text-2xl font-bold font-serif">{stats.wishlistRaw.length}</div>
                                <div className="text-[10px] uppercase text-gray-300 tracking-wider">Wishlist</div>
                            </div>
                            
                            {/* Box 4: Organizzati */}
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm hover:bg-white/20 transition flex flex-col justify-center items-center">
                                <div className="text-2xl font-bold font-serif">{stats.organized.length}</div>
                                <div className="text-[10px] uppercase text-gray-300 tracking-wider">Organizzati</div>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
         </div>
      </div>

      {/* 2. CONTENUTO PAGINA (SOTTO) */}
      <div className="max-w-7xl mx-auto px-6 -mt-24 space-y-8 relative z-10">
          
          {/* Mappa del Mondo */}
          <div className="bg-white p-2 rounded-2xl shadow-xl">
              <div className="flex justify-between items-center px-4 py-2">
                  <div>
                    <h3 className="font-bold text-brand-dark flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-action"/> Il tuo Mondo</h3>
                    <p className="text-[10px] text-gray-400">{isMyProfile ? "Clicca sui paesi per aggiungerli alla Wishlist" : "Paesi visitati e desiderati dall'utente."}</p>
                  </div>
              </div>
              <TravelMap 
                trips={myTrips} 
                wishlistLocations={wishlistLocations} 
                onToggleWishlistCountry={isMyProfile ? handleToggleWishlistCountry : () => {}} 
              />
          </div>

          {/* Timeline Attività */}
          {/* Ristrutturazione GRIGLIA PRINCIPALE SOTTO LA MAPPA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
              {/* COLONNA SINISTRA (Timeline) - OCCUPA 2/3 DELLO SPAZIO */}
              <div className="md:col-span-2 space-y-6">
                
                  {/* TIMELINE */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-xl font-serif font-bold text-brand-dark mb-6 flex items-center gap-2"><Clock className="w-5 h-5 text-brand-secondary"/> Timeline</h3>
                      <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:h-full before:w-0.5 before:bg-gray-200 pl-8">
                          {/* INSERISCI QUI TUTTO IL CONTENUTO DELLA VECCHIA TIMELINE */}
                          {[...stats.upcoming, ...stats.visited].map((trip, idx) => {
                              const isPast = stats.visited.includes(trip);
                              return (
                                  <div key={trip.id} className="relative">
                                      <div className={`absolute -left-[30px] w-5 h-5 rounded-full border-4 border-white ${isPast ? 'bg-gray-400' : 'bg-brand-action'} shadow-sm`}></div>
                                      <div className={`p-4 rounded-lg border ${isPast ? 'bg-gray-50 border-gray-100 opacity-80' : 'bg-white border-brand-accent/30 shadow-sm'}`}>
                                          <div className="flex justify-between items-start">
                                              <h4 className="font-bold text-brand-dark">{trip.name}</h4>
                                              {isPast && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Concluso</span>}
                                              {!isPast && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">In Programma</span>}
                                          </div>
                                          <p className="text-xs text-brand-secondary flex items-center gap-1 mt-1"><Calendar className="w-3 h-3"/> {trip.dateStart.split('T')[0]} {trip.country && `• ${trip.country}`}</p>
                                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{trip.description}</p>
                                      </div>
                                  </div>
                              );
                          })}
                          {myTrips.length === 0 && <p className="text-gray-500 text-sm">Nessun viaggio. Inizia a creare ricordi!</p>}
                      </div>
                  </div>
            </div>

            {/* COLONNA DESTRA (Metriche Extra e Amici) - OCCUPA 1/3 DELLO SPZIO */}
            <div className="space-y-6 md:col-span-1">
                
                {/* BOX KM PERCORSI */}
                <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-center text-center border-b-4 border-brand-accent">
                    <Car className="w-10 h-10 text-brand-accent mx-auto mb-2"/>
                    <div className="text-3xl font-serif font-bold text-brand-dark">
                        {stats.totalKm.toLocaleString('it-IT')}
                    </div>
                    <div className="text-xs uppercase text-brand-secondary tracking-wider mt-1">
                        Km Totali Percorsi (Stimati)
                    </div>
                </div>

                {/* BOX WISHLIST LOCALI */}
                <div className={`bg-white rounded-xl shadow-lg p-6 ${!isMyProfile ? 'opacity-70' : ''}`}>
                    <h3 className="text-lg font-serif font-bold text-brand-dark mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500"/> Wishlist Locali</h3>
                    {isMyProfile && (
                        <form onSubmit={handleAddCustomLocation} className="flex gap-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400"/>
                                <input type="text" placeholder="Aggiungi città, attrazione..." value={newWishItem} onChange={e => setNewWishItem(e.target.value)} className="w-full pl-8 p-2 border rounded-lg text-sm" />
                            </div>
                            <button type="submit" className="bg-brand-dark text-white p-2 rounded-lg hover:bg-brand-accent transition"><Plus className="w-4 h-4"/></button>
                        </form>
                    )}
                    <div className="max-h-24 overflow-y-auto pr-1">
                        <div className="flex flex-wrap gap-2">
                            {stats.wishlistRaw.length > 0 ? stats.wishlistRaw.map((item, idx) => (
                                <span key={idx} className="px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                                    {item}
                                    {isMyProfile && <button onClick={() => handleToggleWishlistCountry(item)} className="hover:text-red-500 ml-1 leading-none">×</button>}
                                </span>
                            )) : <p className="text-xs text-gray-400 italic">Clicca sulla mappa o scrivi per aggiungere!</p>}
                        </div>
                    </div>
                </div>
                
                {/* BOX AMICI E RICHIESTE (Ex Compagnia) */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-serif font-bold text-brand-dark flex items-center gap-2"><Users className="w-5 h-5 text-brand-action"/> Amici</h3>
                        <div className="flex items-center gap-3">
                            {isMyProfile && pendingRequests.length > 0 && (
                                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 animate-pulse" title="Richieste di amicizia in attesa">
                                    <Bell className="w-3 h-3"/> {pendingRequests.length}
                                
                                </span>
                            )}
                            <span className="bg-brand-dark text-white text-xs font-bold px-2 py-1 rounded-full">{friends.length} amici</span>
                        </div>
                    </div>

                    {/* Richieste in Sospeso */}
                    {isMyProfile && pendingRequests.length > 0 && (
                        <div className="border border-red-200 bg-red-50 p-3 rounded-lg mb-4 space-y-2">
                            <h4 className="font-bold text-red-700 flex items-center gap-2"><Bell className="w-4 h-4"/> Richieste in Arrivo ({pendingRequests.length})</h4>
                            {pendingRequests.map(req => (
                                <div key={req.id} className="flex justify-between items-center bg-white p-2 rounded-md shadow-sm">
                                    <span className="text-sm font-medium text-brand-dark">{req.senderName}</span>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => handleRequestAction(req, true)} 
                                            className="p-1 rounded-full text-green-600 hover:bg-green-100 transition"
                                            title="Accetta"
                                        >
                                            <Check className="w-4 h-4"/>
                                        </button>
                                        <button 
                                            onClick={() => handleRequestAction(req, false)} 
                                            className="p-1 rounded-full text-red-600 hover:bg-red-100 transition"
                                            title="Rifiuta"
                                        >
                                            <X className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}


                    {/* Lista Amici */}
                    <div 
                        className={`space-y-3 overflow-hidden transition-all duration-500 ${showFriends ? 'max-h-96' : 'max-h-20'}`}
                        onClick={() => setShowFriends(prev => !prev)}
                    >
                        {friends.length > 0 ? friends.map((f, i) => (
                            <div 
                                key={i} 
                                className="flex items-center gap-3 p-2 hover:bg-brand-light rounded-lg cursor-pointer" 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    // Naviga solo se non è il profilo che sto già guardando
                                    if (onSelectUser && currentUserId !== f.uid) { 
                                        onSelectUser(f.uid); 
                                    } else {
                                        // Toggle espansione se è il mio profilo o se è già l'utente corrente
                                        setShowFriends(prev => !prev); 
                                    }
                                }}>
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{(f.name || f.email).charAt(0).toUpperCase()}</div>
                                <span className="text-sm font-medium text-brand-dark">{f.name || f.email}</span>
                            </div>
                        )) : <p className="text-sm text-gray-400 italic">Nessun amico confermato. Cerca dalla Home!</p>}
                    </div>
                    {friends.length > 2 && !showFriends && <div className="text-center text-xs text-brand-action mt-2 font-bold cursor-pointer">... Mostra tutti</div>}
                </div>
            </div>
        </div>
      </div>
      
      {isEditing && (
          <EditProfileModal 
            user={user} db={db} storage={storage}
            currentProfileData={profile} 
            onClose={() => setIsEditing(false)} 
          />
      )}
    </div>
  );
};

export default ProfilePage;