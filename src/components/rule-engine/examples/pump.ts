import type { Draft } from '@/api/rule-engine/client';

const pump: Draft = {
  name: '冷却泵高温监测',
  description: '泵温达到 80°C 并持续一分钟确认高温，降到 72°C 并持续半分钟确认恢复。',
  definition: {
    settings: {
      definitionVersion: 2,
      scope: {
        productIds: [],
        deviceIds: ['pump-01'],
        deviceGroupIds: [],
        sourceSpacePolicy: 'PRODUCTION_ONLY',
      },
      effectivePeriod: {
        startsAt: null,
        endsAt: null,
        daysOfWeek: [],
        dailyWindows: [],
        zoneId: 'Asia/Shanghai',
      },
      executionPolicy: {
        maxEventAgeMs: 120000,
        cooldownMs: 0,
        maxHops: 8,
        maxTargets: 10,
      },
      dependencies: [],
    },
    entryNodeId: 'report',
    nodes: [
      {
        nodeId: 'report',
        name: '接收温度上报',
        x: 32,
        y: 112,
        config: {
          kind: 'TRIGGER',
          trigger: {
            type: 'DOMAIN_EVENT',
            eventTypes: ['deviceMessage.propertyReport'],
            eventIdentifiers: [],
          },
        },
      },
      {
        nodeId: 'temperature',
        name: '判断高温与恢复',
        x: 336,
        y: 112,
        config: {
          kind: 'CONDITION',
          condition: {
            type: 'detection',
            assertion: {
              type: 'stateful',
              stateName: 'hot',
              stateType: 'DURATION',
              predicate: {
                type: 'predicate',
                left: {
                  type: 'field',
                  source: 'sourceEvent',
                  path: 'temperature',
                },
                operator: 'GE',
                right: {
                  type: 'constant',
                  value: {
                    type: 'number',
                    value: 80,
                  },
                },
              },
              durationMs: 60000,
              requiredCount: 3,
              maxGapMs: 35000,
            },
            recovery: {
              type: 'stateful',
              stateName: 'cool',
              stateType: 'DURATION',
              predicate: {
                type: 'predicate',
                left: {
                  type: 'field',
                  source: 'sourceEvent',
                  path: 'temperature',
                },
                operator: 'LE',
                right: {
                  type: 'constant',
                  value: {
                    type: 'number',
                    value: 72,
                  },
                },
              },
              durationMs: 30000,
              requiredCount: 2,
              maxGapMs: 35000,
            },
            channelPath: null,
            maxAgeMs: 120000,
          },
        },
      },
      {
        nodeId: 'high',
        name: '标记高温',
        x: 640,
        y: 32,
        config: {
          kind: 'TRANSFORM',
          transform: {
            type: 'mapping',
            mappings: {
              pumpStatus: {
                type: 'constant',
                value: {
                  type: 'text',
                  value: 'HIGH',
                },
              },
            },
          },
        },
      },
      {
        nodeId: 'recovered',
        name: '标记恢复',
        x: 640,
        y: 192,
        config: {
          kind: 'TRANSFORM',
          transform: {
            type: 'mapping',
            mappings: {
              pumpStatus: {
                type: 'constant',
                value: {
                  type: 'text',
                  value: 'RECOVERED',
                },
              },
            },
          },
        },
      },
    ],
    relations: [
      {
        fromNodeId: 'report',
        fromPort: 'NEXT',
        toNodeId: 'temperature',
      },
      {
        fromNodeId: 'temperature',
        fromPort: 'ASSERT',
        toNodeId: 'high',
      },
      {
        fromNodeId: 'temperature',
        fromPort: 'RESOLVE',
        toNodeId: 'recovered',
      },
    ],
  },
};

export default pump;
