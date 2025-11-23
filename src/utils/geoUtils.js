export const getCoordinates = async (locationName) => {
    if (!locationName) return null;
    const key = `geo_v3_${locationName.toLowerCase().trim()}`; // Bump version cache
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    try {
        // Aggiungiamo accept-language=en per avere i nomi dei paesi in Inglese (match con GeoJSON)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&addressdetails=1&limit=1&accept-language=en`);
        const data = await response.json();
        if (data && data.length > 0) {
            const result = data[0];
            const info = { 
                coords: { lat: parseFloat(result.lat), lon: parseFloat(result.lon) },
                country: result.address?.country || '' // Sarà in Inglese (es. "Italy")
            };
            sessionStorage.setItem(key, JSON.stringify(info));
            return info;
        }
    } catch (error) {
        console.error("Errore Geocoding:", error);
    }
    return null;
};

export const calculateHaversineDistance = (coords1, coords2) => {
    if (!coords1 || !coords2) return 0;
    const R = 6371; 
    const dLat = (coords2.lat - coords1.lat) * (Math.PI / 180);
    const dLon = (coords2.lon - coords1.lon) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coords1.lat * (Math.PI / 180)) * Math.cos(coords2.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};