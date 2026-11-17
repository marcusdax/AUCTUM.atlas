/**
 * Map Data API Routes — TypeScript port from Atlas Helios
 * Serves GeoJSON, storm markers, radar overlays, and tile server configs
 * Used by RoofPro CRM for map-based storm tracking and property visualization
 */
import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import noaaService, { SEVERITY_COLORS } from '../services/NOAAWeatherService';

const router = Router();
router.use(authMiddleware);

/**
 * GET /maps/alerts-geojson — Get weather alerts as GeoJSON
 */
router.get('/alerts-geojson', async (req: AuthRequest, res, next) => {
  try {
    const { severity, event } = req.query;
    let alerts: { alerts: any[] } = { alerts: [] };
    try {
      alerts = await noaaService.getActiveAlerts({
        ...(severity && { severity: severity as string }),
        ...(event && { event: event as string }),
        limit: 100,
      });
    } catch (apiError) {
      console.log('NOAA API error:', (apiError as Error).message);
    }

    const geojson = {
      type: 'FeatureCollection',
      features: alerts.alerts
        .filter((alert) => alert.geometry)
        .map((alert) => ({
          type: 'Feature',
          geometry: alert.geometry,
          properties: {
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            urgency: alert.urgency,
            headline: alert.headline,
            description: alert.description,
            effective: alert.effective,
            expires: alert.expires,
            area: alert.area,
          },
        })),
    };

    res.json(geojson);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /maps/storm-markers — Get storm locations as map markers
 */
router.get('/storm-markers', async (req: AuthRequest, res, next) => {
  try {
    let alerts: { alerts: any[] } = { alerts: [] };
    try {
      alerts = await noaaService.getActiveAlerts({ limit: 100 });
    } catch (apiError) {
      console.log('NOAA API error:', (apiError as Error).message);
    }

    const markers = alerts.alerts
      .filter((alert) => alert.geometry)
      .map((alert) => {
        let lat: number | undefined;
        let lon: number | undefined;

        if (alert.geometry.type === 'Point') {
          [lon, lat] = alert.geometry.coordinates;
        } else if (alert.geometry.type === 'Polygon') {
          const coords = alert.geometry.coordinates[0];
          const sumLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0);
          const sumLon = coords.reduce((sum: number, c: number[]) => sum + c[0], 0);
          lat = sumLat / coords.length;
          lon = sumLon / coords.length;
        }

        return {
          id: alert.id,
          lat,
          lon,
          type: alert.type,
          severity: alert.severity,
          urgency: alert.urgency,
          headline: alert.headline,
          expires: alert.expires,
          icon: getStormIcon(alert.type),
          color: SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.Unknown,
        };
      });

    res.json({ markers, count: markers.length, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /maps/radar-overlay — Get radar overlay information
 */
router.get('/radar-overlay', async (req: AuthRequest, res, next) => {
  try {
    let stations: any[] = [];
    try {
      const allStations = await noaaService.getRadarStations();
      stations = allStations.filter(
        (s) =>
          s.status === 'Operational' &&
          s.location.lon < -60 &&
          s.location.lon > -130
      );
    } catch (apiError) {
      console.log('Radar stations API error:', (apiError as Error).message);
    }

    res.json({
      stations,
      tileServers: [
        {
          name: 'NWS Base Reflectivity',
          url: 'https://radar.weather.gov/ridge/standard/{z}/{x}/{y}_0.png',
          attribution: 'NOAA National Weather Service',
        },
      ],
      count: stations.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /maps/us-bounds — US map bounds
 */
router.get('/us-bounds', (_req: AuthRequest, res) => {
  res.json({
    bounds: {
      sw: { lat: 24.396308, lon: -124.848974 },
      ne: { lat: 49.384358, lon: -66.885444 },
    },
    center: { lat: 39.8283, lon: -98.5795 },
    zoom: 4,
  });
});

/**
 * GET /maps/tile-servers — Available map tile servers
 */
router.get('/tile-servers', (_req: AuthRequest, res) => {
  res.json({
    baseMaps: [
      {
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      },
      {
        name: 'CartoDB Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
      {
        name: 'CartoDB Light',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
      {
        name: 'ESRI Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18,
      },
    ],
    overlayMaps: [
      {
        name: 'NWS Radar',
        url: 'https://radar.weather.gov/ridge/standard/{z}/{x}/{y}_0.png',
        attribution: 'NOAA',
        opacity: 0.6,
      },
      {
        name: 'NWS Warnings',
        url: 'https://warnings.cod.edu/wwa/{z}/{x}/{y}.png',
        attribution: 'College of DuPage',
        opacity: 0.5,
      },
    ],
  });
});

function getStormIcon(type: string): string {
  if (!type) return 'circle';
  const iconMap: Record<string, string> = {
    Tornado: 'tornado',
    'Tornado Warning': 'tornado',
    'Severe Thunderstorm': 'bolt',
    'Severe Thunderstorm Warning': 'bolt',
    Flash: 'water',
    'Flash Flood': 'water',
    'Flash Flood Warning': 'water',
    Hurricane: 'hurricane',
    'Hurricane Warning': 'hurricane',
    'Tropical Storm': 'wind',
    Winter: 'snowflake',
    Blizzard: 'snowflake',
  };
  for (const [key, icon] of Object.entries(iconMap)) {
    if (type.includes(key)) return icon;
  }
  return 'exclamation-circle';
}

export default router;
