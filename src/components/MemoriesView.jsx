import React, { useState, useEffect } from 'react';
import { Loader2, ImagePlus } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import MemoryCard from './MemoryCard';
import TaggingModal from './TaggingModal';
import PostEditorModal from './PostEditorModal';
import Modal from './Modal';

const MemoriesView = ({ projectRef, storage, user, userProfile, readOnly, stats, participants, isCreator }) => {
  const [photos, setPhotos] = useState([]); 
  const [uploading, setUploading] = useState(false); 
  const [filesToTag, setFilesToTag] = useState(null); 
  const [editingPost, setEditingPost] = useState(null);
  
  useEffect(() => {
      const unsub = onSnapshot(query(collection(projectRef, 'photos')), s => {
          const fetchedPhotos = s.docs.map(d => ({ id: d.id, ...d.data() }));
          
          fetchedPhotos.sort((a, b) => {
              const dateA = a.memoryDate || (a.createdAt ? a.createdAt.toDate().toISOString() : null);
              const dateB = b.memoryDate || (b.createdAt ? b.createdAt.toDate().toISOString() : null);
              
              if (dateA && dateB) return dateB.localeCompare(dateA);
              if (dateA) return -1;
              if (dateB) return 1;
              return a.id.localeCompare(b.id); 
          });
          
          setPhotos(fetchedPhotos);
      });
      return unsub;
  }, [projectRef]);
  
  const handleFileSelect = (e) => {
      const files = Array.from(e.target.files); 
      if(files.length) setFilesToTag(files);
  };

  const uploadWithMetadata = async (photosData) => { 
    setUploading(true); 
    await Promise.all(photosData.map(async item => { 
        const f = item.file;
        const r = ref(storage, `photos/${projectRef.id}/${Date.now()}_${f.name}`); 
        await uploadBytes(r, f); 
        const url = await getDownloadURL(r); 
        
        await addDoc(collection(projectRef, 'photos'), { 
            url, 
            storagePath: r.fullPath,
            description: item.description,
            location: item.location,
            memoryDate: item.memoryDate || '',
            taggedUserIds: item.taggedUserIds,
            uploadedBy: user.uid, 
            uploaderName: userProfile.name, 
            createdAt: serverTimestamp() 
        }); 
    })); 
    setFilesToTag(null);
    setUploading(false);
  };

  const editPost = async (postId, newMetadata) => {
      if (readOnly) return;
      setUploading(true);
      try {
          await updateDoc(doc(collection(projectRef, 'photos'), postId), {
              description: newMetadata.description,
              location: newMetadata.location,
              memoryDate: newMetadata.memoryDate || '',
              taggedUserIds: newMetadata.taggedUserIds,
              updatedAt: serverTimestamp(),
          });
          alert("Post modificato con successo.");
          setEditingPost(null);
      } catch (e) {
          console.error("Errore modifica post:", e);
          alert("Errore durante la modifica: " + e.message);
      } finally {
          setUploading(false);
      }
  };

  const deletePost = async (photo) => {
      if (!window.confirm('Sei sicuro di voler eliminare questo post? Questa azione è irreversibile e rimuoverà la foto dal server.')) return;
      setUploading(true); 
      try {
          if (photo.storagePath) {
              const fileRef = ref(storage, photo.storagePath);
              await deleteObject(fileRef).catch(e => {
                  console.warn("File non trovato in Storage o errore eliminazione:", e.message);
              });
          }
          await deleteDoc(doc(collection(projectRef, 'photos'), photo.id));
          alert("Post eliminato con successo.");
      } catch (e) {
          console.error("Errore nell'eliminazione:", e);
          alert("Errore nell'eliminazione del post: " + e.message);
      } finally {
          setUploading(false);
      }
  };
  
  const taggableParticipants = participants.filter(p => p.id !== user.uid);
  
  return (
    <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow text-center border-b-4 border-brand-action relative overflow-hidden">
                {stats.isLoadingKm && <div className="absolute top-0 left-0 w-full h-1 bg-brand-action animate-pulse"></div>}
                <div className="text-3xl font-bold text-brand-dark font-serif">{stats.isLoadingKm ? <Loader2 className="animate-spin inline w-6 h-6"/> : stats.km}</div>
                <div className="text-xs text-brand-secondary uppercase tracking-wider">Km Stimati (Lineari)</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow text-center border-b-4 border-blue-500">
                <div className="text-3xl font-bold text-brand-dark font-serif">{stats.places}</div>
                <div className="text-xs text-brand-secondary uppercase tracking-wider">Tappe / Città</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow text-center border-b-4 border-green-500">
                <div className="text-3xl font-bold text-brand-dark font-serif">{stats.people}</div>
                <div className="text-xs text-brand-secondary uppercase tracking-wider">Compagni</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow text-center border-b-4 border-purple-500">
                <div className="text-3xl font-bold text-brand-dark font-serif">{photos.length}</div>
                <div className="text-xs text-brand-secondary uppercase tracking-wider">Foto/Post</div>
            </div>
        </div>

        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow">
            <h3 className="text-xl font-serif font-bold text-brand-dark">Bacheca Ricordi</h3>
            {!readOnly && 
                <label className={`bg-brand-action text-white px-4 py-2 rounded cursor-pointer hover:opacity-90 flex items-center gap-2 ${uploading?'opacity-50':''}`}>
                    {uploading ? <Loader2 className="animate-spin w-5 h-5"/> : <ImagePlus className="w-5 h-5"/>}
                    <span>Carica Post</span>
                    <input type="file" multiple className="hidden" onChange={handleFileSelect} disabled={uploading} accept="image/*" />
                </label>
            }
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos.map(p => (
                <MemoryCard 
                    key={p.id} 
                    photo={p} 
                    participants={participants} 
                    isCreator={isCreator}
                    isUploader={p.uploadedBy === user.uid}
                    onDelete={deletePost}
                    onEdit={setEditingPost} 
                />
            ))}
        </div>
        {photos.length === 0 && (
            <div className="text-center p-12 bg-white rounded-xl shadow text-gray-500">
                <ImagePlus className="w-10 h-10 mx-auto mb-3"/>
                <p className="font-medium">Nessun ricordo ancora pubblicato.</p>
            </div>
        )}

        {filesToTag && !uploading && 
            <TaggingModal 
                files={filesToTag} 
                participants={taggableParticipants} 
                onClose={() => setFilesToTag(null)} 
                onSave={uploadWithMetadata}
            />
        }
        
        {editingPost && 
            <PostEditorModal
                post={editingPost}
                participants={taggableParticipants}
                onClose={() => setEditingPost(null)}
                onSave={(metadata) => editPost(editingPost.id, metadata)}
            />
        }

        {uploading && (
            <Modal onClose={()=>{}} size="sm">
                <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="animate-spin w-8 h-8 text-brand-action mb-4"/>
                    <p className="text-lg font-medium text-brand-dark">Caricamento in corso...</p>
                    <p className="text-sm text-gray-500 mt-1">Non chiudere questa finestra.</p>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default MemoriesView;