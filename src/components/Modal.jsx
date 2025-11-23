import React from 'react';
import { XCircle } from 'lucide-react';

const Modal = ({ children, onClose, size = 'lg', customClass = '' }) => ( // AGGIUNTO customClass
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 fade-in" onClick={onClose}>
    <div 
      className={`bg-[#EFEBE0] w-full rounded-xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto ${size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-lg' : size === 'xl' ? 'max-w-2xl' : 'max-w-3xl'} ${customClass}`} 
      onClick={e => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-[#7A8C99] hover:text-[#222A3A]">
        <XCircle className="w-7 h-7" />
      </button>
      {children}
    </div>
  </div>
);

export default Modal;