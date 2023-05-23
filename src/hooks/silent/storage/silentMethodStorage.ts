import { len, objectKeys, pushItem, splice } from '@/helper';
import { SilentMethod } from '../SilentMethod';
import {
  SerializedSilentMethodIdQueueMap,
  silentMethodIdQueueMapStorageKey,
  silentMethodStorageKeyPrefix,
  storageGetItem,
  storageRemoveItem,
  storageSetItem
} from './helper';

/**
 * 序列化并保存silentMethod实例
 * @param silentMethodInstance silentMethod实例
 */
export const persistSilentMethod = <S, E, R, T, RC, RE, RH>(
  silentMethodInstance: SilentMethod<S, E, R, T, RC, RE, RH>
) => {
  storageSetItem(silentMethodStorageKeyPrefix + silentMethodInstance.id, silentMethodInstance);
};

/**
 * 将静默请求的配置信息放入对应storage中
 * 逻辑：通过构造一个key，并用这个key将静默方法的配置信息放入对应storage中，然后将key存入统一管理key的存储中
 * @param silentMethod SilentMethod实例
 * @param queue 操作的队列名
 */
export const push2PersistentSilentQueue = <S, E, R, T, RC, RE, RH>(
  silentMethodInstance: SilentMethod<S, E, R, T, RC, RE, RH>,
  queueName: string
) => {
  persistSilentMethod(silentMethodInstance);
  // 将silentMethod实例id保存到queue存储中
  const silentMethodIdQueueMap = (storageGetItem(silentMethodIdQueueMapStorageKey) ||
    {}) as SerializedSilentMethodIdQueueMap;
  const currentQueue = (silentMethodIdQueueMap[queueName] = silentMethodIdQueueMap[queueName] || []);
  pushItem(currentQueue, silentMethodInstance.id);
  storageSetItem(silentMethodIdQueueMapStorageKey, silentMethodIdQueueMap);
};

/**
 * 对缓存中的silentMethod实例移除或替换
 * @param queue 操作的队列名
 * @param targetSilentMethodId 目标silentMethod实例id
 * @param newSilentMethod 替换的新silentMethod实例，未传则表示删除
 */
export const spliceStorageSilentMethod = (
  queueName: string,
  targetSilentMethodId: string,
  newSilentMethod?: SilentMethod
) => {
  // 将silentMethod实例id从queue中移除
  const silentMethodIdQueueMap = (storageGetItem(silentMethodIdQueueMapStorageKey) ||
    {}) as SerializedSilentMethodIdQueueMap;
  const currentQueue = silentMethodIdQueueMap[queueName] || [];
  const index = currentQueue.findIndex(id => id === targetSilentMethodId);
  if (index >= 0) {
    if (newSilentMethod) {
      splice(currentQueue, index, 1, newSilentMethod.id);
      persistSilentMethod(newSilentMethod);
    } else {
      splice(currentQueue, index, 1);
    }

    storageRemoveItem(silentMethodStorageKeyPrefix + targetSilentMethodId);
    // 队列为空时删除此队列
    len(currentQueue) <= 0 && delete silentMethodIdQueueMap[queueName];
    if (len(objectKeys(silentMethodIdQueueMap)) > 0) {
      storageSetItem(silentMethodIdQueueMapStorageKey, silentMethodIdQueueMap);
    } else {
      // 队列集合为空时移除它
      storageRemoveItem(silentMethodIdQueueMapStorageKey);
    }
  }
};
