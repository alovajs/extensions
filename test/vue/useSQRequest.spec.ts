import { createAlova } from 'alova';
import VueHook from 'alova/vue';
import { globalVirtualResponseLock } from '../../src/hooks/silent/globalVariables';
import { bootSilentFactory, onSilentSubmitSuccess } from '../../src/hooks/silent/silentFactory';
import { SilentMethod } from '../../src/hooks/silent/SilentMethod';
import { silentQueueMap } from '../../src/hooks/silent/silentQueue';
import loadSilentQueueMapFromStorage from '../../src/hooks/silent/storage/loadSilentQueueMapFromStorage';
import useSQRequest from '../../src/hooks/silent/useSQRequest';
import createVirtualResponse from '../../src/hooks/silent/virtualTag/createVirtualResponse';
import updateStateEffect from '../../src/hooks/silent/virtualTag/updateStateEffect';
import { symbolIsProxy, symbolVTagId } from '../../src/hooks/silent/virtualTag/variables';
import vtagDhy from '../../src/hooks/silent/virtualTag/vtagDhy';
import vtagStringify from '../../src/hooks/silent/virtualTag/vtagStringify';
import { ScopedSQErrorEvent, ScopedSQSuccessEvent, SQHookBehavior } from '../../typings';
import { mockRequestAdapter } from '../mockData';
import { untilCbCalled } from '../utils';

const alovaInst = createAlova({
  baseURL: 'http://xxx',
  statesHook: VueHook,
  requestAdapter: mockRequestAdapter,
  localCache: {
    // 不设置缓存，否则有些会因为缓存而不延迟50毫秒，而导致结果不一致
    GET: 0
  }
});
beforeAll(() => {
  bootSilentFactory({
    alova: alovaInst
  });
});
// jest.setTimeout(100000);
describe('useSQRequest', () => {
  test('request immediately with queue behavior', async () => {
    const Get = alovaInst.Get<{ total: number; list: number[] }>('/list');
    const { loading, data, error, downloading, uploading, onSuccess, onComplete, onBeforePushQueue, onPushedQueue } =
      useSQRequest(() => Get);

    const beforePushMockFn = jest.fn();
    onBeforePushQueue(event => {
      beforePushMockFn();
      expect(event.behavior).toBe('queue');
      expect(event.method).toBe(Get);
      expect(event.silentMethod).toBeInstanceOf(SilentMethod);
      expect(event.sendArgs).toStrictEqual([]);
      expect(Object.keys(silentQueueMap.default)).toHaveLength(0);
    });
    const pushedMockFn = jest.fn();
    onPushedQueue(event => {
      pushedMockFn();
      expect(event.behavior).toBe('queue');
      expect(event.method).toBe(Get);
      expect(event.silentMethod).toBeInstanceOf(SilentMethod);
      expect(event.sendArgs).toStrictEqual([]);
      expect(Object.keys(silentQueueMap.default)).toHaveLength(1);
      expect(silentQueueMap.default[0]).toBe(event.silentMethod);
    });

    expect(loading.value).toBeTruthy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    // 通过decorateSuccess将成功回调参数改为事件对象了，因此强转为此对象
    const scopedSQSuccessEvent = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<
      any,
      any,
      any,
      any,
      any,
      any,
      any
    >;
    expect(loading.value).toBeFalsy();
    expect(data.value.total).toBe(300);
    expect(data.value.list).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    expect(scopedSQSuccessEvent.behavior).toBe('queue');
    expect(scopedSQSuccessEvent.method).toBe(Get);
    expect(scopedSQSuccessEvent.data.total).toBe(300);
    expect(scopedSQSuccessEvent.data.list).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(scopedSQSuccessEvent.sendArgs).toStrictEqual([]);
    expect(!!scopedSQSuccessEvent.silentMethod).toBeTruthy();

    onComplete(event => {
      expect(event.behavior).toBe('queue');
      expect(event.method).toBe(Get);
      expect(event.data.total).toBe(300);
      expect(event.data.list).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(event.sendArgs).toStrictEqual([]);
      expect(!!event.silentMethod).toBeTruthy();
    });

    expect(Object.keys(silentQueueMap.default)).toHaveLength(0);
  });

  test('use send function to request with queue behavior', async () => {
    const Get = (page: number, pageSize: number) =>
      alovaInst.Get<{ total: number; list: number[] }>('/list', {
        params: {
          page,
          pageSize
        }
      });
    const { loading, data, error, downloading, uploading, send, onSuccess, onBeforePushQueue, onPushedQueue } =
      useSQRequest((page, pageSize) => Get(page, pageSize), {
        immediate: false,
        queue: 'test_1'
      });

    const beforePushMockFn = jest.fn();
    onBeforePushQueue(event => {
      beforePushMockFn();
      expect(event.behavior).toBe('queue');
      expect(event.method.url).toBe('/list');
      expect(event.method.config.params).toStrictEqual({ page: 2, pageSize: 8 });
      expect(event.silentMethod).toBeInstanceOf(SilentMethod);
      expect(event.sendArgs).toStrictEqual([2, 8]);
    });
    const pushedMockFn = jest.fn();
    onPushedQueue(event => {
      pushedMockFn();
      expect(event.behavior).toBe('queue');
      expect(event.method.url).toBe('/list');
      expect(event.method.config.params).toStrictEqual({ page: 2, pageSize: 8 });
      expect(event.silentMethod).toBeInstanceOf(SilentMethod);
      expect(event.sendArgs).toStrictEqual([2, 8]);
    });

    expect(loading.value).toBeFalsy();
    send(2, 8); // 发送请求
    expect(loading.value).toBeTruthy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    // 通过decorateSuccess将成功回调参数改为事件对象了，因此强转为此对象
    const scopedSQSuccessEvent = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<
      any,
      any,
      any,
      any,
      any,
      any,
      any
    >;
    expect(loading.value).toBeFalsy();
    expect(data.value.total).toBe(300);
    expect(data.value.list).toStrictEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    expect(scopedSQSuccessEvent.behavior).toBe('queue');
    expect(scopedSQSuccessEvent.data.total).toBe(300);
    expect(scopedSQSuccessEvent.data.list).toStrictEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(scopedSQSuccessEvent.sendArgs).toStrictEqual([2, 8]);
    expect(!!scopedSQSuccessEvent.silentMethod).toBeTruthy();
  });

  test('should emit onError immediately while request error and never retry', async () => {
    const Get = () => alovaInst.Get<never>('/list-error');
    const { loading, data, error, onError, onComplete } = useSQRequest(Get, {
      behavior: 'queue'
    });

    // 通过decorateSuccess将成功回调参数改为事件对象了，因此强转为此对象
    const scopedSQErrorEvent = (await untilCbCalled(onError)) as unknown as ScopedSQErrorEvent<
      any,
      any,
      any,
      any,
      any,
      any,
      any
    >;
    expect(loading.value).toBeFalsy();
    expect(data.value).toBeUndefined();
    expect(error.value?.message).toBe('server error');
    expect(scopedSQErrorEvent.behavior).toBe('queue');
    expect(scopedSQErrorEvent.error.message).toBe('server error');
    expect(scopedSQErrorEvent.sendArgs).toStrictEqual([]);
    expect(scopedSQErrorEvent.silentMethod).not.toBeUndefined();
    expect(silentQueueMap.default).toHaveLength(0); // 在队列中移除了

    onComplete(event => {
      expect(event.behavior).toBe('queue');
      expect(event.error.message).toBe('server error');
      expect(event.sendArgs).toStrictEqual([]);
      expect(event.silentMethod).not.toBeUndefined();
    });
  });

  test('should be the same as useRequest when behavior is static', async () => {
    const Get = () => alovaInst.Get<never>('/list');
    const { loading, data, error, onSuccess, onBeforePushQueue, onPushedQueue } = useSQRequest(Get, {
      behavior: () => 'static',
      queue: 'a10'
    });

    const pushMockFn = jest.fn();
    onBeforePushQueue(pushMockFn);
    onPushedQueue(pushMockFn);

    await untilCbCalled(setTimeout, 0);
    // static行为模式下不会进入队列，需异步检查
    expect(silentQueueMap.a10).toBeUndefined();

    expect(loading.value).toBeTruthy();
    expect(data.value).toBeUndefined();
    // 通过decorateSuccess将成功回调参数改为事件对象了，因此强转为此对象
    const scopedSQSuccessEvent = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<
      any,
      any,
      any,
      any,
      any,
      any,
      any
    >;
    expect(pushMockFn).toBeCalledTimes(0);
    expect(loading.value).toBeFalsy();
    expect(data.value).toStrictEqual({
      total: 300,
      list: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    });
    expect(error.value).toBeUndefined();
    expect(scopedSQSuccessEvent.behavior).toBe('static');
    expect(scopedSQSuccessEvent.data).toStrictEqual({
      total: 300,
      list: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    });
    expect(scopedSQSuccessEvent.sendArgs).toStrictEqual([]);
    expect(scopedSQSuccessEvent.method).not.toBeUndefined();
    expect(scopedSQSuccessEvent.silentMethod).toBeUndefined();
  });

  test('should be persisted when has no fallbackHandlers in silent behavior', async () => {
    const Get = () => alovaInst.Get<never>('/list');
    useSQRequest(Get, {
      behavior: () => 'silent',
      queue: 'a11'
    });

    await untilCbCalled(setTimeout, 0);
    // static行为模式下不会进入队列，需异步检查
    expect(silentQueueMap.a11).toHaveLength(1);
    let persistentSilentQueueMap = loadSilentQueueMapFromStorage();
    expect(persistentSilentQueueMap.a11).toHaveLength(1);

    // 第二个请求
    const { onFallback } = useSQRequest(() => alovaInst.Get<any>('/list-error'), {
      behavior: () => 'silent',
      queue: 'a11',
      retryError: /.*/,
      maxRetryTimes: 2
    });
    onFallback(event => {
      expect(event.behavior).toBe('silent');
      expect(event.method).not.toBeUndefined();
      expect(event.silentMethod).toBeInstanceOf(SilentMethod);
      expect(event.sendArgs).toStrictEqual([]);
    });

    await untilCbCalled(setTimeout, 0);
    // static行为模式下不会进入队列，需异步检查
    expect(silentQueueMap.a11.length).toBe(2);
    persistentSilentQueueMap = loadSilentQueueMapFromStorage();
    expect(persistentSilentQueueMap.a11.length).toBe(1); // 绑定了onFallback时不会持久化
    await untilCbCalled(onFallback);
  });

  test('should be change behavior when param behavior set to a function that return different value', async () => {
    const poster = () => alovaInst.Post<any>('/detail');
    let behaviorStr: SQHookBehavior = 'silent';
    const { data, onSuccess, send } = useSQRequest(poster, {
      behavior: () => behaviorStr
    });
    let event: ScopedSQSuccessEvent<any, any, any, any, any, any, any> = await untilCbCalled(onSuccess);
    expect(data.value[symbolIsProxy]).toBeTruthy();
    expect(event.data[symbolIsProxy]).toBeTruthy();
    expect(event.behavior).toBe('silent');
    expect(event.sendArgs).toStrictEqual([]);

    behaviorStr = 'static';
    send(1, 2, 3);
    event = await untilCbCalled(onSuccess);
    expect(data.value).toStrictEqual({ id: 1 });
    expect(event.data).toStrictEqual({ id: 1 });
    expect(event.behavior).toBe('static');
    expect(event.sendArgs).toStrictEqual([1, 2, 3]);
  });

  test('should be intercpeted when has virtual tag in method instance', async () => {
    const virtualResponse = createVirtualResponse(undefined);
    globalVirtualResponseLock.v = 0;
    const vtagId = virtualResponse.id;
    globalVirtualResponseLock.v = 2;

    const poster = (id: number) => alovaInst.Post<any>('/detail', { id });
    const { data, onSuccess } = useSQRequest(() => poster(vtagId), {
      behavior: 'queue',
      vtagCaptured(method) {
        expect(method.url).toBe('/detail');
        expect(method.type).toBe('POST');
        expect((method.requestBody as any).id).toBe(vtagId);
        return {
          localData: 'abc'
        };
      }
    });

    let event: ScopedSQSuccessEvent<any, any, any, any, any, any, any> = await untilCbCalled(onSuccess);
    expect(event.data).toStrictEqual({ localData: 'abc' });
    expect(data.value).toStrictEqual({ localData: 'abc' });

    // 第二：测试未设置vtagCaptured的情况，将发送请求
    const { data: data2, onSuccess: onSuccess2 } = useSQRequest(() => poster(vtagId), {
      behavior: 'queue'
    });
    event = await untilCbCalled(onSuccess2);
    expect(event.data).toStrictEqual({ id: 1 });
    expect(data2.value).toStrictEqual({ id: 1 });
  });

  test('should be intercpeted when has vtag id string in method instance', async () => {
    const virtualResponse = createVirtualResponse(undefined);
    globalVirtualResponseLock.v = 0;
    const vtagId = virtualResponse.id;
    globalVirtualResponseLock.v = 2;

    const poster = (id: number) =>
      alovaInst.Post<any>('/detail', {
        id: 'id is ' + vtagStringify(id)
      });
    const { data, onSuccess } = useSQRequest(() => poster(vtagId), {
      behavior: 'static', // vtagCaptured在任何行为模式下都有效
      vtagCaptured() {
        return {
          localData: 'abc'
        };
      }
    });

    let event: ScopedSQSuccessEvent<any, any, any, any, any, any, any> = await untilCbCalled(onSuccess);
    expect(event.data).toStrictEqual({ localData: 'abc' });
    expect(data.value).toStrictEqual({ localData: 'abc' });
  });

  test('should be intercpeted when use vtag to calculate in method instance', async () => {
    const virtualResponse = createVirtualResponse(undefined);
    globalVirtualResponseLock.v = 0;
    const vtagId = virtualResponse.id;
    const obj = { vtagId };
    globalVirtualResponseLock.v = 2;

    const poster = (o: { vtagId: any }) =>
      alovaInst.Post<any>('/detail', {
        status: vtagDhy(o.vtagId) ? 1 : 0
      });
    const { data, onSuccess } = useSQRequest(() => poster(obj), {
      behavior: 'queue',
      vtagCaptured() {
        return {
          localData: 'abc'
        };
      }
    });

    let event: ScopedSQSuccessEvent<any, any, any, any, any, any, any> = await untilCbCalled(onSuccess);
    expect(event.data).toStrictEqual({ localData: 'abc' });
    expect(data.value).toStrictEqual({ localData: 'abc' });
  });

  test('the onSuccess should be emit immediately with virtualResponse, perhaps has default response', async () => {
    const poster = () => alovaInst.Post<any>('/detail');
    const { data, onSuccess } = useSQRequest(poster, {
      behavior: 'silent'
    });

    const event: ScopedSQSuccessEvent<any, any, any, any, any, any, any> = await untilCbCalled(onSuccess);
    expect(event.behavior).toBe('silent');
    expect(event.method).not.toBeUndefined();
    expect(event.silentMethod).not.toBeUndefined();
    expect(event.sendArgs).toStrictEqual([]);
    expect(data.value[symbolIsProxy]).toBeTruthy();
    expect(vtagDhy(event.data)).toBeUndefined();
    expect(vtagDhy(data.value)).toBeUndefined();

    const { data: data2, onSuccess: onSuccess2 } = useSQRequest(poster, {
      behavior: 'silent',
      silentDefaultResponse: () => ({
        a: 1,
        b: 2
      })
    });
    const event2: ScopedSQSuccessEvent<any, any, any, any, any, any, any> = await untilCbCalled(onSuccess2);
    expect(data2.value[symbolIsProxy]).toBeTruthy();
    expect(data2.value.a).toBe(1);
    expect(data2.value.b).toBe(2);

    expect(vtagDhy(event2.data)).toStrictEqual({ a: 1, b: 2 });
    expect(vtagDhy(data2.value)).toStrictEqual({ a: 1, b: 2 });
  });

  test('should be delay update states when call `updateStateEffect` in onSuccess handler', async () => {
    // 获取列表
    const getter = () => alovaInst.Get<any>('/info-list');
    const { data: listData, onSuccess } = useSQRequest(getter);
    await untilCbCalled(onSuccess);
    expect(listData.value).toStrictEqual([
      {
        id: 10,
        text: 'a'
      },
      {
        id: 20,
        text: 'b'
      },
      {
        id: 30,
        text: 'c'
      }
    ]);

    // 提交数据并立即更新
    const poster = () => alovaInst.Post<any>('/detail');
    const { data: postRes, onSuccess: onPostSuccess } = useSQRequest(poster, {
      behavior: 'silent',
      silentDefaultResponse: () => ({
        id: '--'
      })
    });
    onPostSuccess(({ data }: ScopedSQSuccessEvent<any, any, any, any, any, any, any>) => {
      expect(postRes.value[symbolVTagId]).toBeTruthy(); // 此时还是虚拟响应数据

      // 调用updateStateEffect后将首先立即更新虚拟数据到listData中
      // 等到请求响应后再次更新实际数据到listData中
      updateStateEffect(getter(), listDataRaw => {
        listDataRaw.push({
          id: data.id,
          text: 'abc'
        });
        return listDataRaw;
      });

      const listDataLastItem = listData.value[listData.value.length - 1];
      expect(vtagStringify(listDataLastItem?.id)).toBe(vtagStringify(data.id));
      expect(vtagDhy(listDataLastItem?.id)).toBe('--'); // 虚拟标签默认值
      expect(listDataLastItem?.text).toBe('abc');
    });

    await untilCbCalled(onSilentSubmitSuccess);
    // 已替换为实际数据
    expect(postRes.value).toStrictEqual({ id: 1 });
    expect(postRes.value).toStrictEqual({ id: 1 });

    // listData也被替换为实际数据
    expect(listData.value).toStrictEqual([
      {
        id: 10,
        text: 'a'
      },
      {
        id: 20,
        text: 'b'
      },
      {
        id: 30,
        text: 'c'
      },
      {
        id: 1,
        text: 'abc'
      }
    ]);
  });

  test.skip('should replace virtual tag to real value that method instance after requesting method instance', async () => {
    // 提交数据并立即更新
    const poster = () => alovaInst.Post<any>('/detail');
    const { onSuccess: onPostSuccess } = useSQRequest(poster, {
      behavior: 'silent',
      silentDefaultResponse: () => ({
        id: '--',
        status: true
      })
    });

    let vtagId: number | void;
    let vtagStatus: boolean | void;
    onPostSuccess(({ data }: ScopedSQSuccessEvent<any, any, any, any, any, any, any>) => {
      vtagId = data.id;
      vtagStatus = data.status;
    });

    await untilCbCalled(onPostSuccess);
    const deleter = () =>
      alovaInst.Delete<any>(`/detail/${vtagStringify(vtagId)}`, {
        status: vtagStatus,
        statusCode: vtagStatus == true ? 1 : 0
      });
    useSQRequest(deleter, {
      behavior: 'silent'
    });

    // 使用全局事件来检查上面的请求数据
    onSilentSubmitSuccess(event => {
      if (event.method.type === 'DELETE' && event.behavior === 'queue') {
        expect(event.method.url).toBe('/detail/1');
        expect((event.method.requestBody as any).status).toBeTruthy();
        expect((event.method.requestBody as any).statusCode).toBe(1);
      }
    });

    const { onSuccess: onDeleteSuccess } = useSQRequest(deleter, {
      behavior: 'queue'
    });
    const resRaw = await untilCbCalled(onDeleteSuccess);
    expect(resRaw.data).toStrictEqual({
      params: {
        id: 1
      },
      data: {
        status: true,
        statusCode: 1
      }
    });
  });
});
