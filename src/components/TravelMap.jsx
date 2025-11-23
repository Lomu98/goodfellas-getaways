import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { VisitedIcon, UpcomingIcon, WishlistIcon } from '../utils/mapIcons';
import { formatDateRange } from '../utils/dateUtils';

const TravelMap = ({ trips, wishlistLocations = [], onToggleWishlistCountry }) => {
  const [geoJsonData, setGeoJsonData] = useState(null);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
      .then(response => response.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error("Errore caricamento GeoJSON:", err));
  }, []);

  // Funzione per determinare lo stato di un paese
  const getCountryStatus = (countryName) => {
    if (!countryName) return 'neutral';
    const normalizedName = countryName.toLowerCase();

    // Helper per verificare se un viaggio appartiene a questo paese
    const belongsToCountry = (t) => {
        // Verifica prioritaria sul campo 'country' normalizzato (ora in inglese grazie a geoUtils)
        if (t.country && t.country.toLowerCase() === normalizedName) return true;
        // Fallback sulla stringa location completa
        if (t.location && t.location.toLowerCase().includes(normalizedName)) return true;
        return false;
    };

    // 1. VISITATO
    const isVisited = trips.some(t => {
        const isPast = t.dateEnd && new Date(t.dateEnd) < new Date();
        return isPast && belongsToCountry(t);
    });
    if (isVisited) return 'visited';

    // 2. IN PROGRAMMA
    const isUpcoming = trips.some(t => {
        const isFuture = !t.dateEnd || new Date(t.dateEnd) >= new Date();
        return isFuture && belongsToCountry(t);
    });
    if (isUpcoming) return 'upcoming';

    // 3. WISHLIST
    // Controlla sia il nome del paese che la località specifica
    const inWishlist = wishlistLocations.some(w => {
        const wName = w.name.toLowerCase();
        const wCountry = w.country ? w.country.toLowerCase() : '';
        return wName === normalizedName || wCountry === normalizedName;
    });
    if (inWishlist) return 'wishlist';

    return 'neutral';
  };

  const styleCountry = (feature) => {
    const status = getCountryStatus(feature.properties.name);
    let fillColor = 'transparent';
    let opacity = 0.1;

    switch (status) {
        case 'visited': fillColor = '#22c55e'; opacity = 0.5; break; // Verde
        case 'upcoming': fillColor = '#3b82f6'; opacity = 0.5; break; // Blu
        case 'wishlist': fillColor = '#eab308'; opacity = 0.5; break; // Oro
        default: fillColor = '#f1f5f9'; opacity = 0.1;
    }

    return {
      fillColor: fillColor,
      weight: 1,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: status === 'neutral' ? 0.1 : 0.6
    };
  };

  const onEachCountry = (feature, layer) => {
    const countryName = feature.properties.name;
    layer.bindTooltip(countryName, { sticky: true }); 
    
    layer.on({
      click: () => {
        const status = getCountryStatus(countryName);
        
        if (status === 'visited') {
            alert(`Hai già visitato ${countryName}!`);
            return;
        }
        if (status === 'upcoming') {
            alert(`Hai già un viaggio in programma in ${countryName}!`);
            return;
        }

        const action = status === 'wishlist' ? 'rimuovere' : 'aggiungere';
        if (confirm(`Vuoi ${action} ${countryName} alla tua Wishlist?`)) {
            onToggleWishlistCountry(countryName);
        }
      },
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({ weight: 2, color: '#666', dashArray: '' });
        layer.bringToFront();
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle({ weight: 1, color: 'white', dashArray: '3' });
      }
    });
  };

  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-lg border-4 border-white z-0 relative bg-blue-50">
      <MapContainer center={[41.9028, 12.4964]} zoom={3} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OSM' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        
        {geoJsonData && (
            <GeoJSON data={geoJsonData} style={styleCountry} onEachFeature={onEachCountry} />
        )}

        {trips.map(trip => {
            if (!trip.coords) return null;
            
            const today = new Date().toISOString().split('T')[0];
            const isPast = trip.dateEnd && trip.dateEnd < today;
            const IconToUse = isPast ? VisitedIcon : UpcomingIcon;
            const statusLabel = isPast ? "Visitato" : "In Programma";

            return (
                <Marker key={trip.id} position={[trip.coords.lat, trip.coords.lon]} icon={IconToUse}>
                    <Popup>
                        <div className="text-center">
                            <strong className="block text-brand-dark font-serif">{trip.name}</strong>
                            <span className="text-xs uppercase tracking-wider text-brand-secondary">{statusLabel}</span>
                            <div className="text-xs mt-1">{formatDateRange(trip.dateStart, trip.dateEnd)}</div>
                        </div>
                    </Popup>
                </Marker>
            );
        })}

        {wishlistLocations.map((item, idx) => {
            if (!item.coords) return null;
            return (
                <Marker key={`wish-${idx}`} position={[item.coords.lat, item.coords.lon]} icon={WishlistIcon}>
                     <Popup>
                        <div className="text-center">
                            <strong className="block text-brand-dark font-serif">{item.name}</strong>
                            <span className="text-xs uppercase tracking-wider text-yellow-600">Nella Wishlist</span>
                        </div>
                    </Popup>
                </Marker>
            );
        })}
      </MapContainer>
      
      <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded shadow-md text-xs z-[400] flex flex-col gap-1">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500 opacity-50 border border-green-600"></span> Visitato</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500 opacity-50 border border-blue-600"></span> In Programma</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-yellow-500 opacity-50 border border-yellow-600"></span> Wishlist</div>
      </div>
    </div>
  );
};

export default TravelMap;