export const formatDateRange = (start, end) => { 
  if (!start) return null;
  const toDate = (str) => new Date(str).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  const hasTime = start.includes('T');
  try {
    if (!hasTime) { 
      const sDate = toDate(start); 
      if (!end || start === end) return sDate; 
      const eDate = toDate(end); 
      return sDate === eDate ? sDate : `${sDate} - ${eDate}`; 
    }
    const sDate = toDate(start);
    if (!end || start === end) return sDate; 
    const eDate = toDate(end);
    if (sDate === eDate) return sDate;
    return `${sDate} - ${eDate}`;
  } catch (e) { return start; }
};

export const getSimpleTime = (isoString) => { 
  if (!isoString || !isoString.includes('T')) return ''; 
  return new Date(isoString).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); 
};

export const sortTripsByDate = (trips) => { 
  const today = new Date().toISOString(); 
  const upcoming = []; 
  const past = []; 
  trips.forEach(t => { 
    const endDate = t.dateEnd || t.dateStart; 
    if (endDate < today) past.push(t); 
    else upcoming.push(t); 
  }); 
  upcoming.sort((a, b) => (a.dateStart || '').localeCompare(b.dateStart || '')); 
  past.sort((a, b) => (b.dateStart || '').localeCompare(a.dateStart || '')); 
  return [...upcoming, ...past]; 
};