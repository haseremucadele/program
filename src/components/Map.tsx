'use client';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet.heat';

// Fix Leaflet marker icons
const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

// Custom Icons
const createIcon = (colorUrl: string) => new L.Icon({
    iconUrl: colorUrl,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = createIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png');
const greenIcon = createIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png');
const orangeIcon = createIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png');
const blueIcon = createIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'); // Default/New

interface Location {
    id: number | string;
    lat: number;
    lng: number;
    title: string;
    type?: string; // Source Type (e.g. District)
    subType?: string; // Physical Source Type
    status?: 'active' | 'expiring' | 'expired' | 'new'; // Status for coloring
    last_action_date?: string;
}

interface MapProps {
    locations?: Location[];
    showHeatmap?: boolean;
    onMapClick?: (latlng: L.LatLng) => void;
    onMarkerClick?: (location: Location) => void;
    onDeleteClick?: (id: number | string) => void;
    selectedIds?: (number | string)[];
}

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng);
        },
    });
    return null;
}

export default function MapComponent({
    locations = [],
    showHeatmap = false,
    onMapClick,
    onMarkerClick,
    onDeleteClick,
    selectedIds = []
}: MapProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Client-side only fix for icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl,
            iconUrl,
            shadowUrl,
        });
        setMounted(true);
    }, []);

    // Heatmap Layer Effect
    const HeatmapLayer = ({ points }: { points: number[][] }) => {
        const map = useMapEvents({});

        useEffect(() => {
            if (!map) return;
            const heat = (L as any).heatLayer(points, {
                radius: 25,
                blur: 15,
                maxZoom: 17,
            }).addTo(map);

            return () => {
                map.removeLayer(heat);
            };
        }, [map, points]);

        return null;
    };

    if (!mounted) return <div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl" />;

    const heatmapPoints = locations.map(l => [l.lat, l.lng]);

    // Determine Icon based on status or selection
    const getIcon = (loc: Location) => {
        // If selected, force Green (Active/Treated)
        if (selectedIds.includes(loc.id)) {
            return greenIcon;
        }

        switch (loc.status) {
            case 'active': return greenIcon;
            case 'expiring': return orangeIcon; // Orange for warning
            case 'expired': return redIcon;     // Red for expired/new
            case 'new': return redIcon;
            default: return redIcon;
        }
    };

    return (
        <MapContainer
            center={[39.6484, 27.8826]} // Balıkesir default
            zoom={9}
            scrollWheelZoom={true}
            className="w-full h-full rounded-2xl shadow-inner z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

            {showHeatmap && <HeatmapLayer points={heatmapPoints} />}

            {!showHeatmap && locations.map((loc) => (
                <Marker
                    key={loc.id}
                    position={[loc.lat, loc.lng]}
                    icon={getIcon(loc)}
                    eventHandlers={{
                        click: () => onMarkerClick && onMarkerClick(loc)
                    }}
                    opacity={selectedIds.includes(loc.id) ? 1.0 : 0.8} // Dim unselected if there is a selection interaction? kept simple for now
                >
                    <Popup>
                        <div className="min-w-[150px]">
                            <div className="font-semibold text-sm">{loc.title}</div>

                            <div className="flex items-center justify-between mt-1">
                                <div className="flex flex-col">
                                    {loc.type && <div className="text-xs text-indigo-600 font-medium">{loc.type}</div>}
                                    {loc.subType && <div className="text-xs text-slate-500 font-medium">{loc.subType}</div>}
                                </div>
                                {onDeleteClick && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteClick(loc.id);
                                        }}
                                        className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-0.5 border border-red-200 rounded hover:bg-red-50 ml-2"
                                    >
                                        Sil
                                    </button>
                                )}
                            </div>

                            <div className="text-xs text-gray-500 mt-1">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</div>
                            {loc.status === 'active' && <div className="text-xs text-green-600 font-bold mt-1">İlaçlama Etkili {loc.last_action_date ? ` - ${loc.last_action_date}` : ''}</div>}
                            {loc.status === 'expiring' && (
                                <div className="text-xs text-orange-600 font-bold mt-1">
                                    Etki Süresi Bitiyor {loc.last_action_date ? `(İ.T.-${loc.last_action_date})` : ''}
                                </div>
                            )}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}

