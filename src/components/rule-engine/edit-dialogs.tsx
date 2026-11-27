import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Modal } from '@/components/ota/shared';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { Draft, JsonObject, NodeConfig } from '@/api/rule-engine/client';
import { durationConfig, isObject, kinds, newConfig, parseObject, type FlowNode } from './graph';
import {
  Choice,
  ListField,
  MappingFields,
  PredicateFields,
  TextField,
  TriggerFields,
} from './node-fields';

function ConfigDialog({
  title,
  initial,
  children,
  fields,
  onApply,
  onClose,
}: {
  title: string;
  initial: JsonObject;
  children: ReactNode;
  fields: (config: JsonObject, change: (value: JsonObject) => void) => ReactNode;
  onApply: (config: JsonObject) => void;
  onClose: () => void;
}) {
  const formId = useId();
  const [config, setConfig] = useState(initial);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState('');
  function switchMode(mode: unknown) {
    if (mode === (source === null ? 'form' : 'json')) return;
    try {
      if (source === null) setSource(JSON.stringify(config, null, 2));
      else {
        setConfig(parseObject(source));
        setSource(null);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '配置格式无效');
    }
  }
  return (
    <Modal
      title={title}
      open
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form={formId}>
            应用配置
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="grid min-w-0 gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onApply(source === null ? config : parseObject(source));
          } catch (err) {
            setError(err instanceof Error ? err.message : '配置无效');
          }
        }}
      >
        {children}
        <Tabs
          className="grid min-w-0 grid-cols-1 gap-3"
          value={source === null ? 'form' : 'json'}
          onValueChange={switchMode}
        >
          <TabsList aria-label="配置方式" className="w-fit justify-self-start p-0.5 group-data-horizontal/tabs:h-7">
            <TabsTrigger value="form" className="px-1 text-xs">表单</TabsTrigger>
            <TabsTrigger value="json" className="px-1 text-xs">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="form" className="grid gap-4">
            {source === null && fields(config, setConfig)}
          </TabsContent>
          <TabsContent value="json">
            <Textarea
              aria-label="JSON 配置"
              spellCheck={false}
              className="min-h-52 font-mono text-xs"
              value={source ?? ''}
              onChange={(e) => setSource(e.target.value)}
            />
          </TabsContent>
        </Tabs>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function NodeDialog({
  node,
  onSave,
  onClose,
}: {
  node: FlowNode;
  onSave: (name: string, config: NodeConfig) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(node.data.name);
  const kind = node.data.config.kind;
  return (
    <ConfigDialog
      title={'配置' + kinds[kind]}
      initial={node.data.config}
      onClose={onClose}
      onApply={(config) => {
        if (!name.trim() || config.kind !== kind) throw new Error('请填写节点名称并保留节点类型。');
        if (
          isObject(config.trigger) &&
          config.trigger.type === 'DOMAIN_EVENT' &&
          (!Array.isArray(config.trigger.eventTypes) || !config.trigger.eventTypes.length)
        )
          throw new Error('请至少选择一个订阅事件。');
        if (
          isObject(config.action) &&
          config.action.type === 'DEVICE_COMMAND' &&
          (!Array.isArray(config.action.targets) || !config.action.targets.length)
        )
          throw new Error('请填写目标设备。');
        if (
          isObject(config.transform) &&
          config.transform.type === 'mapping' &&
          (!isObject(config.transform.mappings) || !Object.keys(config.transform.mappings).length)
        )
          throw new Error('请至少添加一个输出字段。');
        onSave(name.trim(), config as NodeConfig);
      }}
      fields={(config, change) => {
        const { trigger, condition, transform, action } = config;
        if (kind === 'TRIGGER' && isObject(trigger))
          return (
            <TriggerFields value={trigger} change={(trigger) => change({ ...config, trigger })} />
          );
        if (kind === 'CONDITION' && isObject(condition))
          return (
            <>
              <Choice
                label="判断模式"
                value={condition.type}
                options={{
                  ...(!['predicate', 'detection'].includes(String(condition.type))
                    ? { [String(condition.type)]: '自定义条件' }
                    : {}),
                  predicate: '单次阈值',
                  detection: '持续异常与恢复',
                }}
                change={(type) =>
                  change(type === 'predicate' ? newConfig('CONDITION', node.id) : durationConfig())
                }
              />
              {condition.type === 'predicate' ? (
                <PredicateFields
                  value={condition}
                  change={(condition) => change({ ...config, condition })}
                />
              ) : condition.type === 'detection' ? (
                (['assertion', 'recovery'] as const).map((branch) => {
                  const state = condition[branch];
                  if (
                    !isObject(state) ||
                    state.stateType !== 'DURATION' ||
                    !isObject(state.predicate)
                  )
                    return (
                      <p key={branch} className="text-sm">
                        此检测分支可在高级配置中编辑。
                      </p>
                    );
                  function update(patch: JsonObject) {
                    change({
                      ...config,
                      condition: {
                        ...(condition as JsonObject),
                        [branch]: { ...(state as JsonObject), ...patch },
                      },
                    });
                  }
                  return (
                    <fieldset
                      key={branch}
                      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                    >
                      <legend className="px-1 text-sm font-medium">
                        {branch === 'assertion' ? '确认异常' : '确认恢复'}
                      </legend>
                      <PredicateFields
                        value={state.predicate}
                        change={(predicate) => update({ predicate })}
                      />
                      {Object.entries({
                        durationMs: '持续时间（毫秒）',
                        requiredCount: '最少样本数',
                        maxGapMs: '最大间隔（毫秒）',
                      }).map(([key, label]) => (
                        <TextField
                          key={key}
                          numeric
                          min={1}
                          label={label}
                          value={state[key]}
                          change={(v) => update({ [key]: v })}
                        />
                      ))}
                    </fieldset>
                  );
                })
              ) : null}
            </>
          );
        if (kind === 'TRANSFORM' && isObject(transform) && isObject(transform.mappings))
          return (
            <MappingFields
              value={transform.mappings}
              change={(mappings) => change({ ...config, transform: { ...transform, mappings } })}
            />
          );
        if (kind === 'ACTION' && isObject(action) && action.type === 'DEVICE_COMMAND')
          return (
            <>
              <ListField
                required
                label="目标设备 ID"
                value={action.targets}
                change={(targets) => change({ ...config, action: { ...action, targets } })}
              />
              <TextField
                label="设备指令标识"
                value={action.identifier}
                change={(identifier) => change({ ...config, action: { ...action, identifier } })}
              />
              <h4 className="text-sm font-medium">指令参数</h4>
              {isObject(action.parameters) && (
                <MappingFields
                  value={action.parameters}
                  change={(parameters) => change({ ...config, action: { ...action, parameters } })}
                />
              )}
            </>
          );
        return <p className="text-sm text-muted-foreground">此配置可在 JSON 标签页中编辑。</p>;
      }}
    >
      <Field title="节点名称" required>
        <Input
          aria-label="节点名称"
          required
          value={name}
          maxLength={128}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
    </ConfigDialog>
  );
}

export function SettingsDialog({
  draft,
  onSave,
  onClose,
}: {
  draft: Draft;
  onSave: (name: string, description: string, settings: JsonObject) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description ?? '');
  return (
    <ConfigDialog
      title="规则设置"
      initial={draft.definition.settings}
      onClose={onClose}
      onApply={(settings) => {
        if (!name.trim()) throw new Error('请输入规则名称。');
        onSave(name.trim(), description, settings);
      }}
      fields={(settings, change) => {
        const { scope, executionPolicy } = settings;
        return (
          <>
            {isObject(scope) && (
              <fieldset className="grid gap-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">适用范围</legend>
                {Object.entries({
                  productIds: '产品 ID',
                  deviceIds: '设备 ID',
                  deviceGroupIds: '设备分组 ID',
                }).map(([key, label]) => (
                  <ListField
                    key={key}
                    label={label}
                    value={scope[key]}
                    change={(ids) => change({ ...settings, scope: { ...scope, [key]: ids } })}
                  />
                ))}
              </fieldset>
            )}
            {isObject(executionPolicy) && (
              <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <legend className="px-1 text-sm font-medium">执行限制</legend>
                {Object.entries({
                  maxEventAgeMs: '事件有效期（毫秒）',
                  cooldownMs: '冷却时间（毫秒）',
                  maxHops: '最大跳数',
                  maxTargets: '最大目标数',
                }).map(([key, label]) => (
                  <TextField
                    key={key}
                    label={label}
                    numeric
                    min={key === 'cooldownMs' ? 0 : 1}
                    value={executionPolicy[key]}
                    change={(v) =>
                      change({ ...settings, executionPolicy: { ...executionPolicy, [key]: v } })
                    }
                  />
                ))}
              </fieldset>
            )}
          </>
        );
      }}
    >
      <Field title="规则名称" required>
        <Input
          aria-label="规则名称"
          required
          maxLength={128}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field title="说明">
        <Input
          aria-label="说明"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
    </ConfigDialog>
  );
}
