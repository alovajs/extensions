import { defineProperty, forEach, objectKeys } from '@/helper';
import { symbolToStringTag, undefinedValue } from '@/helper/variables';
import { AlovaCompleteEvent, Method } from 'alova';
import { SilentMethod, SQHookBehavior } from '~/typings/general';

/**
 * 创建统一的事件对象，它将承载以下事件
 * useSQRequest相关
 * 全局的：
 * 	[GlobalSQSuccessEvent]成功：behavior、silentMethod实例、queue名称、method实例、retryTimes、响应数据、虚拟数据和实际值的集合
 * 	[GlobalSQErrorEvent]失败：behavior、silentMethod实例、queue名称、method实例、retryTimes、错误对象
 * 	[GlobalSQSuccessEvent | GlobalSQErrorEvent]完成事件：behavior、silentMethod实例、queue名称、method实例、* retryTimes、[?]响应数据、[?]错误对象
 *
 * 局部的：
 * 	[ScopedSQSuccessEvent]成功：behavior、silentMethod实例、method实例、retryTimes、send参数、响应数据
 * 	[ScopedSQErrorEvent]失败：behavior、silentMethod实例、method实例、retryTimes、send参数、错误对象
 * 	[ScopedSQErrorEvent]回退：behavior、silentMethod实例、method实例、retryTimes、send参数、错误对象
 * 	[ScopedSQSuccessEvent | ScopedSQErrorEvent]完成事件：behavior、silentMethod实例、method实例、retryTimes、send参数、[?]错误对象
 *  [ScopedSQRetryEvent]重试：behavior、silentMethod实例、method实例、send参数、retryTimes、retryDelay
 * 	[ScopedSQEvent]入队列前：behavior、silentMethod实例、method实例、send参数
 * 	[ScopedSQEvent]入队列后：behavior、silentMethod实例、method实例、send参数
 *
 * useRetriableRequest相关
 * [RetriableRetryEvent]重试：method实例、sendArgs、retryTimes、retryDelay
 * [RetriableFailEvent]重试：method实例、sendArgs、错误对象、retryTimes
 */
export default <S, E, R, T, RC, RE, RH>(
  eventType: number,
  method: Method<S, E, R, T, RC, RE, RH>,
  behavior?: SQHookBehavior,
  silentMethod?: SilentMethod<S, E, R, T, RC, RE, RH>,
  queueName?: string,
  retryTimes?: number,
  retryDelay?: number,
  sendArgs?: any[],
  data?: R,
  vDataResponse?: Record<string, any>,
  error?: any,
  status?: AlovaCompleteEvent<S, E, R, T, RC, RE, RH>['status']
) => {
  const allPropsEvent = {
    /** 事件对应的请求行为 */
    behavior,

    /** 当前的method实例 */
    method,

    /** 当前的silentMethod实例，当behavior为static时没有值 */
    silentMethod,

    /** 已重试的次数，在beforePush和pushed事件中没有值 */
    retryTimes,

    /** 重试的延迟时间 */
    retryDelay,

    /** 通过send触发请求时传入的参数 */
    sendArgs,

    /** 响应数据，只在成功时有值 */
    data,

    /** 虚拟数据和实际值的集合 */
    vDataResponse,

    /** 失败时抛出的错误，只在失败时有值 */
    error,

    /** 响应状态 */
    status,

    /** silentMethod所在的队列名，全局事件有值 */
    queueName
  };
  const sqEvent: Record<string, any> = {};
  forEach(objectKeys(allPropsEvent), key => {
    allPropsEvent[key as keyof typeof allPropsEvent] !== undefinedValue &&
      (sqEvent[key] = allPropsEvent[key as keyof typeof allPropsEvent]);
  });

  // 将此类的对象重新命名，让它看上去是由不同的类生成的对象
  // 以此来对应typescript中定义的类型
  const typeName = [
    'GlobalSQEvent', // 0
    'GlobalSQSuccessEvent', // 1
    'GlobalSQErrorEvent', // 2
    'GlobalSQFailEvent', // 3
    'ScopedSQEvent', // 4
    'ScopedSQSuccessEvent', // 5
    'ScopedSQErrorEvent', // 6
    'ScopedSQCompleteEvent', // 7
    'ScopedSQRetryEvent', // 8
    'RetriableRetryEvent', // 9
    'RetriableFailEvent' // 10
  ][eventType];
  typeName && defineProperty(sqEvent, symbolToStringTag, typeName);
  return sqEvent;
};
