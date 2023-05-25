import { accessAction, actionDelegationMiddleware } from '@/middlewares/actionDelegation';
import { createAlova, FetcherType, useFetcher, useRequest, useWatcher } from 'alova';
import VueHook from 'alova/vue';
import { ref } from 'vue';
import { mockRequestAdapter } from '~/test/mockData';
import { untilCbCalled } from '~/test/utils';

const alovaInst = createAlova({
  baseURL: 'http://localhost:8080',
  statesHook: VueHook,
  requestAdapter: mockRequestAdapter
});
describe('vue => subscriber middleware', () => {
  test('should send by notification with keyword string', async () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    const { loading, data, onSuccess, onComplete } = useRequest(methodInstance, {
      middleware: actionDelegationMiddleware('abc')
    });
    const successFn = jest.fn();
    const completeFn = jest.fn();
    expect(loading.value).toBeTruthy();
    onSuccess(successFn);
    onComplete(completeFn);

    await untilCbCalled(onSuccess);
    expect(loading.value).toBeFalsy();
    expect(data.value).toStrictEqual({ id: 10 });
    expect(successFn).toBeCalledTimes(1);
    expect(completeFn).toBeCalledTimes(1);

    await new Promise<void>(resolve => {
      accessAction('abc', async ({ send }) => {
        resolve(send({ name: 'aa' }));
      });
    });
    expect(data.value).toStrictEqual({ id: 10, name: 'aa' });
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);
  });

  test('should send by notification with keyword symbol', async () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    const sym = Symbol('test');
    const { loading, data, onSuccess, onComplete } = useRequest(methodInstance, {
      middleware: actionDelegationMiddleware(sym)
    });
    const successFn = jest.fn();
    const completeFn = jest.fn();
    expect(loading.value).toBeTruthy();
    onSuccess(successFn);
    onComplete(completeFn);

    await untilCbCalled(onSuccess);
    expect(loading.value).toBeFalsy();
    expect(data.value).toStrictEqual({ id: 10 });
    expect(successFn).toBeCalledTimes(1);
    expect(completeFn).toBeCalledTimes(1);

    await new Promise<void>(resolve => {
      accessAction(sym, async ({ send }) => {
        resolve(send({ name: 'aa' }));
      });
    });
    expect(data.value).toStrictEqual({ id: 10, name: 'aa' });
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);
  });

  test('should send by notification with keyword number', async () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    const num = 123;
    const { loading, data, onSuccess, onComplete } = useRequest(methodInstance, {
      middleware: actionDelegationMiddleware(num)
    });
    const successFn = jest.fn();
    const completeFn = jest.fn();
    expect(loading.value).toBeTruthy();
    onSuccess(successFn);
    onComplete(completeFn);

    await untilCbCalled(onSuccess);
    expect(loading.value).toBeFalsy();
    expect(data.value).toStrictEqual({ id: 10 });
    expect(successFn).toBeCalledTimes(1);
    expect(completeFn).toBeCalledTimes(1);

    await new Promise<void>(resolve => {
      accessAction(num, async ({ send }) => {
        resolve(send({ name: 'aa' }));
      });
    });
    expect(data.value).toStrictEqual({ id: 10, name: 'aa' });
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);
  });

  test('should send multiple request by notification', async () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    const str = 'zzz';
    const state1 = useRequest(methodInstance, {
      middleware: actionDelegationMiddleware(str)
    });
    const state2 = useRequest(methodInstance, {
      middleware: actionDelegationMiddleware(str)
    });
    const successFn = jest.fn();
    const completeFn = jest.fn();
    state1.onSuccess(successFn);
    state1.onComplete(completeFn);
    state2.onSuccess(successFn);
    state2.onComplete(completeFn);

    await Promise.all([untilCbCalled(state1.onSuccess), untilCbCalled(state2.onSuccess)]);
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);

    const senders = [] as Promise<any>[];
    accessAction(str, async ({ send }, index) => {
      senders.push(send({ name: 'aa' + index }));
    });
    await Promise.all(senders);
    expect(state1.data.value).toStrictEqual({ id: 10, name: 'aa0' });
    expect(state2.data.value).toStrictEqual({ id: 10, name: 'aa1' });
    expect(successFn).toBeCalledTimes(4);
    expect(completeFn).toBeCalledTimes(4);
  });

  test('should send multiple request by notification', async () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    const state1 = useRequest(methodInstance, {
      middleware: actionDelegationMiddleware('aaa-1')
    });
    const state2 = useRequest(methodInstance, {
      middleware: actionDelegationMiddleware('aaa-2')
    });
    const successFn = jest.fn();
    const completeFn = jest.fn();
    state1.onSuccess(successFn);
    state1.onComplete(completeFn);
    state2.onSuccess(successFn);
    state2.onComplete(completeFn);

    await Promise.all([untilCbCalled(state1.onSuccess), untilCbCalled(state2.onSuccess)]);
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);

    const senders = [] as Promise<any>[];
    accessAction(/^aaa/, async ({ send }, index) => {
      senders.push(send({ name: 'aa' + index }));
    });
    await Promise.all(senders);
    expect(state1.data.value).toStrictEqual({ id: 10, name: 'aa0' });
    expect(state2.data.value).toStrictEqual({ id: 10, name: 'aa1' });
    expect(successFn).toBeCalledTimes(4);
    expect(completeFn).toBeCalledTimes(4);
  });

  test('should throws a error when not match any handler', () => {
    expect(() => {
      accessAction('not_match', () => {});
    }).toThrow('[alova/subscriber]not match handlers which id is `not_match`');
  });

  test("should throws a error when hasn't send request", () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    useRequest(methodInstance, {
      middleware: actionDelegationMiddleware('not_match2'),
      immediate: false
    });
    expect(() => {
      accessAction('not_match2', () => {});
    }).toThrow('[alova/subscriber]not match handlers which id is `not_match2`');
  });

  test('should send by notification when use useWatcher', async () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    const num = ref(1);
    const { loading, data, onSuccess, onComplete } = useWatcher(methodInstance, [num], {
      middleware: actionDelegationMiddleware('watcher-aaa'),
      immediate: true
    });
    const successFn = jest.fn();
    const completeFn = jest.fn();
    expect(loading.value).toBeTruthy();
    onSuccess(successFn);
    onComplete(completeFn);

    await untilCbCalled(onSuccess);
    expect(loading.value).toBeFalsy();
    expect(data.value).toStrictEqual({ id: 10 });
    expect(successFn).toBeCalledTimes(1);
    expect(completeFn).toBeCalledTimes(1);

    await new Promise<void>(resolve => {
      accessAction('watcher-aaa', async ({ send }) => {
        resolve(send({ name: 'watcher-aaa' }));
      });
    });
    expect(data.value).toStrictEqual({ id: 10, name: 'watcher-aaa' });
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);
  });

  test('should fetch data by notification when use useFetcher', async () => {
    const methodInstance = (data: any) =>
      alovaInst.Post('/detail2', data, {
        localCache: 0
      });

    const { fetch, onSuccess, onComplete } = useFetcher<FetcherType<typeof alovaInst>>({
      middleware: actionDelegationMiddleware('fetcher-aaa')
    });

    const successFn = jest.fn();
    const completeFn = jest.fn();
    onSuccess(successFn);
    onComplete(completeFn);
    fetch(methodInstance({ fetch: 1 }));

    await untilCbCalled(onSuccess);
    expect(successFn).toBeCalledTimes(1);
    expect(completeFn).toBeCalledTimes(1);

    accessAction('fetcher-aaa', async ({ fetch }) => {
      fetch({ fetch: 'fetcher-aaa' });
    });

    await untilCbCalled(onSuccess);
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);
  });
});
