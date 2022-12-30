import { createAlova, Method } from 'alova';
import GlobalFetch from 'alova/GlobalFetch';
import VueHook from 'alova/vue';
import { globalVirtualResponseLock, setDependentAlova } from '../../src/hooks/silent/globalVariables';
import { mergeSerializer, serializers } from '../../src/hooks/silent/serializer';
import { SerializedSilentMethod, SilentMethod } from '../../src/hooks/silent/SilentMethod';
import deserialize, { deserializedPayload2SilentMethodInstance } from '../../src/hooks/silent/storage/deserialize';
import serialize from '../../src/hooks/silent/storage/serialize';
import createVirtualResponse from '../../src/hooks/silent/virtualTag/createVirtualResponse';
import { symbolVTagId } from '../../src/hooks/silent/virtualTag/variables';
import vtagDhy from '../../src/hooks/silent/virtualTag/vtagDhy';

// 虚拟响应测试
describe('serializers', () => {
  test('merge serializers', () => {
    mergeSerializer({
      custom12: {
        forward: () => undefined,
        backward: () => undefined
      }
    });

    // 内置两个，新增一个
    expect(Object.keys(serializers)).toHaveLength(3);
  });

  test('serialized data must be the same as original data', () => {
    mergeSerializer({
      custom: {
        forward: data => (data === 'a,a' ? '2a' : undefined),
        backward: () => 'a,a'
      }
    });
    globalVirtualResponseLock.v = 0;
    const virtualResponse = createVirtualResponse({ id: 1, text: 'a,a', time: new Date('2022-10-01 00:00:00') });
    const methodInstance = new Method(
      'POST',
      createAlova({
        baseURL: 'http://xxx',
        statesHook: VueHook,
        requestAdapter: GlobalFetch()
      }),
      '/list',
      {
        params: {
          id: virtualResponse.id,
          createDate: new Date('2022-10-01 00:00:00')
        },
        localCache: {
          expire: 500000
        }
      },
      { text: virtualResponse.text, time: virtualResponse.time, others: virtualResponse.e[0] }
    );
    const silentMethodInstance = new SilentMethod(methodInstance, 'silent', () => methodInstance, undefined, /.*/, 2, {
      delay: 2000,
      multiplier: 1.5
    });
    silentMethodInstance.cache = true;
    silentMethodInstance.virtualResponse = virtualResponse;
    const serializedString = serialize(silentMethodInstance);
    expect(typeof serializedString).toBe('string');

    const serializedObj = JSON.parse(serializedString) as SerializedSilentMethod;
    expect(typeof serializedObj.id).toBe('string');

    // 序列化的内容需要和原始数据一致，包括虚拟标签id
    expect(serializedObj.behavior).toBe('silent');
    expect(serializedObj.entity.config).toEqual({
      localCache: {
        expire: 500000
      },
      params: { id: { __$k: virtualResponse.id[symbolVTagId], __$v: 1 }, createDate: ['date', 1664553600000] }
    });
    expect(serializedObj.entity.requestBody).toEqual({
      text: { __$k: virtualResponse.text[symbolVTagId], __$v: ['custom', '2a'] },
      time: { __$k: virtualResponse.time[symbolVTagId], __$v: ['date', 1664553600000] },
      others: { __$k: virtualResponse.e[0][symbolVTagId] }
    });
    expect(serializedObj.entity.url).toBe(methodInstance.url);
    expect(serializedObj.entity.context).toBeUndefined();
    expect(serializedObj.entity.type).toBe(methodInstance.type);
    expect(serializedObj.entity.baseURL).toBe(methodInstance.baseURL);
    expect(serializedObj.retryError).toStrictEqual(['regexp', '.*']);
    expect(serializedObj.maxRetryTimes).toBe(2);
    expect(serializedObj.backoff).toStrictEqual({
      delay: 2000,
      multiplier: 1.5
    });
    expect(serializedObj.virtualResponse).toEqual({
      __$k: virtualResponse[symbolVTagId],
      __$v: {},
      id: { __$k: virtualResponse.id[symbolVTagId], __$v: 1 },
      text: { __$k: virtualResponse.text[symbolVTagId], __$v: ['custom', '2a'] },
      time: { __$k: virtualResponse.time[symbolVTagId], __$v: ['date', 1664553600000] },
      e: { '0': { __$k: virtualResponse.e[0][symbolVTagId] }, __$k: virtualResponse.e[symbolVTagId] }
    });
    globalVirtualResponseLock.v = 2;
  });

  test.only('deserialized data must be the same as original data', () => {
    const alovaInst = createAlova({
      baseURL: 'http://xxx',
      statesHook: VueHook,
      requestAdapter: GlobalFetch()
    });

    mergeSerializer();
    setDependentAlova(alovaInst); // 内部重建method实例时需要依赖alova实例
    globalVirtualResponseLock.v = 0;
    const virtualResponse = createVirtualResponse({
      id: 1,
      time: new Date('2022-10-01 00:00:00'),
      matcher: /^123[a-z]+(.*?)$/g,
      extra: {
        other1: null
      }
    });
    const methodInstance = new Method(
      'POST',
      alovaInst,
      '/list',
      {
        params: {
          id: virtualResponse.id,
          content: 'I am a content',
          other: virtualResponse.extra.other1
        },
        localCache: {
          expire: new Date('2022-12-31 00:00:00'),
          mode: 0
        },
        transformData: (data: any) => data[0]
      },
      { text: virtualResponse.text, time: virtualResponse.time, others: virtualResponse.e[0] }
    );
    const silentMethodInstance = new SilentMethod(
      methodInstance,
      'silent',
      () => methodInstance,
      'abcdef',
      /.*/,
      2,
      {
        delay: 2000,
        multiplier: 1.5
      },
      undefined,
      undefined,
      undefined,
      [virtualResponse.extra.other2]
    );
    silentMethodInstance.cache = true;
    silentMethodInstance.virtualResponse = virtualResponse;
    const serializedString = serialize(silentMethodInstance);

    const deserizlizedSilentMethodInstance = deserializedPayload2SilentMethodInstance(deserialize(serializedString));

    expect(deserizlizedSilentMethodInstance.id).toBe(silentMethodInstance.id);
    expect(deserizlizedSilentMethodInstance.behavior).toBe(silentMethodInstance.behavior);
    expect(deserizlizedSilentMethodInstance.cache).toBeTruthy();
    expect(deserizlizedSilentMethodInstance.entity.url).toBe(methodInstance.url);
    expect(deserizlizedSilentMethodInstance.entity.type).toBe(methodInstance.type);
    expect(deserizlizedSilentMethodInstance.entity.baseURL).toBe(methodInstance.baseURL);

    const params = deserizlizedSilentMethodInstance.entity.config.params || {};
    expect(params.id[symbolVTagId]).toBe(virtualResponse.id[symbolVTagId]);
    expect(vtagDhy(params.id)).toBe(vtagDhy(virtualResponse.id));
    expect(params.content).toBe('I am a content');
    expect(params.other[symbolVTagId]).toBe(virtualResponse.extra.other1[symbolVTagId]);
    expect(vtagDhy(params.other)).toBe(vtagDhy(virtualResponse.extra.other1));

    expect((deserizlizedSilentMethodInstance.retryError as RegExp).source).toBe('.*');
    expect(deserizlizedSilentMethodInstance.maxRetryTimes).toBe(2);
    expect(deserizlizedSilentMethodInstance.backoff).toStrictEqual({
      delay: 2000,
      multiplier: 1.5
    });

    expect(deserizlizedSilentMethodInstance.handlerArgs?.[0][symbolVTagId]).toBe(
      virtualResponse.extra.other2[symbolVTagId]
    );
    expect(deserizlizedSilentMethodInstance.virtualResponse?.text[symbolVTagId]).toBe(
      virtualResponse.text[symbolVTagId]
    );
    expect(deserizlizedSilentMethodInstance.virtualResponse?.time[symbolVTagId]).toBe(
      virtualResponse.time[symbolVTagId]
    );
    globalVirtualResponseLock.v = 2;
  });
});
