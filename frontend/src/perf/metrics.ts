import { onCLS, onFID, onINP, onLCP, onTTFB, Metric } from 'web-vitals';

export type ReportHandler = (metric: Metric) => void;

function sendToAnalytics(metric: Metric) {
  if (typeof window !== 'undefined' && 'sendBeacon' in navigator) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      timestamp: Date.now(),
      url: window.location.href,
    });
    navigator.sendBeacon('/api/analytics/vitals', body);
  }
}

export function reportWebVitals(onReport?: ReportHandler) {
  const handler = onReport ?? sendToAnalytics;

  onCLS(handler);
  onFID(handler);
  onINP(handler);
  onLCP(handler);
  onTTFB(handler);
}

export function getWebVitals(): Promise<Metric[]> {
  return new Promise((resolve) => {
    const metrics: Metric[] = [];
    const handler = (metric: Metric) => {
      metrics.push(metric);
    };

    onCLS(handler);
    onFID(handler);
    onINP(handler);
    onLCP(handler);
    onTTFB(handler);

    setTimeout(() => resolve(metrics), 5000);
  });
}