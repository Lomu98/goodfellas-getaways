import React, { useState } from 'react';
import { Star } from 'lucide-react';
import Modal from './Modal';

const ReviewModal = ({ onClose, onSave, tripName, initialRating = 5, initialComment = '' }) => {
  const [rating, setRating] = useState(initialRating); 
  const [comment, setComment] = useState(initialComment); 
  
  return ( 
    <Modal onClose={onClose} size="sm">
        <div className="text-center">
            <h3 className="text-xl font-serif font-bold text-brand-dark mb-2">Valuta {tripName}</h3>
            <p className="text-sm text-brand-secondary mb-4">Che voto dai a questa esperienza?</p>
            <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110 focus:outline-none">
                        <Star className={`w-8 h-8 ${star <= rating ? 'text-brand-accent fill-brand-accent' : 'text-gray-300'}`} />
                    </button>
                ))}
            </div>
            <textarea 
                placeholder="Il tuo ricordo più bello... (opzionale)" 
                className="w-full p-3 border rounded-lg mb-4 text-sm focus:ring-2 focus:ring-brand-accent focus:outline-none bg-white" 
                rows="3" 
                value={comment} 
                onChange={e => setComment(e.target.value)} 
            />
            <button onClick={() => onSave(rating, comment)} className="w-full bg-brand-dark text-white py-3 rounded-lg font-bold hover:bg-opacity-90 shadow-lg">
                {initialComment || initialRating !== 5 ? "Aggiorna Valutazione" : "Invia Valutazione"}
            </button>
        </div>
    </Modal> 
  );
};

export default ReviewModal;