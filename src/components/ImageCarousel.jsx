import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

const ImageCarousel = ({ images, name }) => {
  const [idx, setIdx] = useState(0);
  const imgs = images ? images.filter(i => i) : [];

  if (!imgs.length) {
    return (
      <div className="h-full w-full bg-brand-dark flex items-center justify-center">
        <ImageIcon className="w-12 h-12 text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="h-full w-full relative group bg-brand-dark">
      <img 
        src={imgs[idx]} 
        alt={name} 
        className="w-full h-full object-cover" 
        onError={e => e.currentTarget.src="https://placehold.co/600x400?text=Errore"} 
      />
      {imgs.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); setIdx(i => i === 0 ? imgs.length - 1 : i - 1); }} 
            className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIdx(i => i === imgs.length - 1 ? 0 : i + 1); }} 
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
};

export default ImageCarousel;