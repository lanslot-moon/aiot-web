import { useEffect, useRef, useState } from 'react';
import { OpenPlatformApiError } from '@/api/iam/client';
import {
  simulationRequest,
  type PropertyReportReceipt,
  type SimulationInstance,
  type ValueMap,
} from '@/api/device/simulation';

const RECEIPT_QUERY_LIMIT = 20;
const RECEIPT_QUERY_INTERVAL_MS = 500;

/** 管理一次上报的提交和回执查询，结果未知时只查询原操作。 */
export function usePropertyReport(projectId: string) {
  const [working, setWorking] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function clearFeedback() {
    setMessage('');
    setError(null);
  }

  async function queryUntilSettled(path: string) {
    for (let attempt = 0; attempt < RECEIPT_QUERY_LIMIT; attempt++) {
      const receipt = await simulationRequest<PropertyReportReceipt>(projectId, path);
      if (!mounted.current) return;

      switch (receipt.status) {
        case 'QUEUED':
          setPendingPath(null);
          setMessage(receipt.message);
          return;
        case 'FAILED':
          setPendingPath(null);
          throw new Error(receipt.message);
        case 'ACCEPTED':
          setMessage(receipt.message);
          break;
      }

      await new Promise(resolve => setTimeout(resolve, RECEIPT_QUERY_INTERVAL_MS));
      if (!mounted.current) return;
    }

    setMessage('上报仍在处理，请查询结果；不会自动重复发送。');
  }

  // 提交和查询共享同一把交互锁；卸载后保留服务端操作，不再更新页面状态。
  async function run(operation: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setWorking(true);
    clearFeedback();

    try {
      await operation();
    } catch (failure) {
      if (mounted.current) {
        setMessage('');
        setError(failure instanceof Error ? failure : new Error('单次上报未完成。'));
      }
    } finally {
      locked.current = false;
      if (mounted.current) setWorking(false);
    }
  }

  async function submit(instance: SimulationInstance, properties: ValueMap) {
    await run(async () => {
      const requestId = crypto.randomUUID();
      const collectionPath = `instances/${encodeURIComponent(instance.instanceId)}/property-reports`;
      const receiptPath = `${collectionPath}/${encodeURIComponent(requestId)}`;
      const body = {
        requestId,
        sessionId: instance.activeSessionId,
        generation: instance.generation,
        properties,
      };

      // 先记录查询位置，POST 响应丢失时不重新发送设备消息。
      setPendingPath(receiptPath);
      try {
        await simulationRequest<PropertyReportReceipt>(projectId, collectionPath, 'POST', body);
      } catch (failure) {
        if (mounted.current && isDefiniteRejection(failure)) setPendingPath(null);
        throw failure;
      }

      if (mounted.current) await queryUntilSettled(receiptPath);
    });
  }

  async function queryPending() {
    const receiptPath = pendingPath;
    if (!receiptPath) return;
    await run(() => queryUntilSettled(receiptPath));
  }

  return { working, pending: !!pendingPath, message, error, submit, queryPending, clearFeedback };
}

function isDefiniteRejection(failure: unknown): boolean {
  if (!(failure instanceof OpenPlatformApiError)) return false;
  const rejectedByClientError = failure.status >= 400 && failure.status < 500;
  const mayAlreadyBeAccepted = failure.code === 'IDEMPOTENT_REQUEST_IN_PROGRESS';
  return rejectedByClientError && !mayAlreadyBeAccepted;
}
