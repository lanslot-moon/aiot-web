import type { ThingModelProperty } from '@/types/apps/open-platform';
import type { TelemetryPoint } from './telemetry';

function schemaObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Telemetry stores object leaves by dotted path; arrays remain a single field. */
export function telemetryProperties(properties: ThingModelProperty[]): ThingModelProperty[] {
  return properties.flatMap(property => {
    const schema = schemaObject(property.schema);
    if (schema.type !== 'object') return [property];
    const required = Array.isArray(schema.required) ? schema.required : [];
    const children = Object.entries(schemaObject(schema.properties)).map(([key, child]) => ({
      ...property, code: `${property.code}.${key}`, schema: child,
      title: `${property.title} · ${typeof schemaObject(child).title === 'string' ? schemaObject(child).title : key}`,
      required: required.includes(key),
    }));
    return telemetryProperties(children);
  });
}

/** Reassemble latest leaf values for the object controls; missing leaves stay absent. */
export function latestPropertyValue(property: ThingModelProperty, points: Record<string, TelemetryPoint>): TelemetryPoint {
  const schema = schemaObject(property.schema);
  if (schema.type !== 'object') return points[property.code] ?? { value: null, timestamp: null };
  const children = Object.entries(schemaObject(schema.properties)).map(([key, child]) => ({
    key, point: latestPropertyValue({ ...property, code: `${property.code}.${key}`, schema: child }, points),
  })).filter(child => child.point.value !== null && child.point.value !== undefined);
  if (!children.length) return { value: null, timestamp: null };
  const timestamps = children.flatMap(child => child.point.timestamp === null ? [] : [child.point.timestamp]);
  return {
    value: Object.fromEntries(children.map(child => [child.key, child.point.value])),
    timestamp: timestamps.length ? Math.max(...timestamps) : null,
  };
}
