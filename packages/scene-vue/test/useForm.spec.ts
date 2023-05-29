import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/vue';
import { Method, createAlova, getMethodKey } from 'alova';
import VueHook from 'alova/vue';
import { mockRequestAdapter } from '~/test/mockData';
import { untilCbCalled } from '~/test/utils';
import { FormHookConfig } from '~/typings/general';
import { accessAction, actionDelegationMiddleware, useForm } from '..';
import CompPersistentDataReset from './components/persistent-data-reset.vue';
import CompRestorePersistentData from './components/restore-persistent-data.vue';

type ID = NonNullable<FormHookConfig<any, any, any, any, any, any, any, any>['id']>;
const getStoragedKey = (methodInstance: Method, id?: ID) => `alova/form-${id || getMethodKey(methodInstance)}`;
const alovaInst = createAlova({
  baseURL: 'http://localhost:8080',
  statesHook: VueHook,
  requestAdapter: mockRequestAdapter
});
describe('vue => useForm', () => {
  test('should default not request immediately', async () => {
    const poster = (data: any) => alovaInst.Post('/saveData', data);
    const { form, send, loading, updateForm } = useForm(poster);
    expect(form.value).toBeUndefined();
    expect(loading.value).toBeFalsy();
    updateForm({ name: 'Ming' });
    updateForm({ age: '18' });

    const newForm = {
      name: 'Ming',
      age: '18'
    };
    expect(form.value).toStrictEqual(newForm);
    const res = await send(form.value);
    expect(res).toStrictEqual({
      code: 200,
      data: newForm
    });
    // 提交后表单数据不重置
    expect(form.value).toStrictEqual(newForm);
  });

  test('should get the initial form and send request immediately', async () => {
    const poster = (form: any) => alovaInst.Post('/saveData', form);
    const newForm = {
      name: 'Ming',
      age: '18'
    };
    const { form, loading, onSuccess } = useForm(poster, {
      initialForm: newForm,
      immediate: true
    });
    expect(form.value).toStrictEqual(newForm);
    expect(loading.value).toBeTruthy();

    const { data } = await untilCbCalled(onSuccess);
    // 提交后表单数据不重置
    expect(data).toStrictEqual({
      code: 200,
      data: newForm
    });
  });

  test('should reset form data when set resetAfterSubmit to true', async () => {
    const poster = (data: any) => alovaInst.Post('/saveData', data);
    const initialForm = {
      name: '',
      age: ''
    };
    const { form, loading, send } = useForm(poster, {
      initialForm,
      resetAfterSubmit: true
    });

    expect(form.value).toStrictEqual(initialForm);
    expect(loading.value).toBeFalsy();

    // 更新表单数据
    form.value.name = 'Ming';
    form.value.age = '18';

    await send(form.value);
    // 提交后表单数据后将重置数据
    expect(form.value).toStrictEqual(initialForm);
  });

  test('should persist form data when set store to true', async () => {
    const poster = (data: any) => alovaInst.Post('/saveData?d=1', data);
    const initialForm = {
      name: '',
      age: ''
    };
    const { form, send, onRestore } = useForm(poster, {
      initialForm,
      store: true,
      resetAfterSubmit: true
    });
    const restoreMockHandler = jest.fn();
    onRestore(restoreMockHandler);

    await untilCbCalled(setTimeout, 100);
    expect(restoreMockHandler).not.toBeCalled(); // 没有缓存不会触发onRestore

    // storageKey会在useForm被调用时同步生成
    const methodStorageKey = getStoragedKey(poster(initialForm));
    const getStoragedForm = () => alovaInst.storage.get(methodStorageKey);

    // 更新表单数据，并验证持久化数据
    form.value.name = 'Ming';
    await untilCbCalled(setTimeout, 100);
    expect(getStoragedForm()).toStrictEqual({
      name: 'Ming',
      age: ''
    });
    form.value.age = '18';
    await untilCbCalled(setTimeout, 100);
    expect(getStoragedForm()).toStrictEqual({
      name: 'Ming',
      age: '18'
    });

    await send(form.value);
    // 提交后表单数据后将重置数据
    expect(form.value).toStrictEqual(initialForm);
    expect(getStoragedForm()).toBeNull();
  });

  test('should send request after persistent data is restored', async () => {
    const poster = (data: any) => alovaInst.Post('/saveData?d=2', data);
    const initialForm = {
      name: '',
      age: ''
    };
    const storagedForm = {
      name: 'Hong',
      age: '22'
    };
    // 预先存储数据，模拟刷新恢复持久化数据
    const methodStorageKey = getStoragedKey(poster(initialForm));
    alovaInst.storage.set(methodStorageKey, storagedForm);

    render(CompRestorePersistentData);

    expect(screen.getByRole('form')).toHaveTextContent(JSON.stringify(initialForm)); // 缓存恢复前
    await screen.findByText('isRestore_1');
    expect(screen.getByRole('form')).toHaveTextContent(JSON.stringify(storagedForm)); // 缓存恢复后

    // 缓存恢复后才会开始发送请求
    await screen.findByText('isSuccess_1');
    expect(screen.getByRole('form')).toHaveTextContent(JSON.stringify(initialForm)); // 请求成功后重置了

    // 当有缓存数据并且immediate设置为true时，会在数据恢复后再发起提交
    expect(screen.getByRole('data')).toHaveTextContent(
      JSON.stringify({
        code: 200,
        data: storagedForm
      })
    );
  });

  test('should reset when call function reset manually', () => {
    const poster = (data: any) => alovaInst.Post('/saveData', data);
    const initialForm = {
      name: '',
      age: ''
    };
    const newForm = {
      name: 'Hong',
      age: '22'
    };
    const { form, reset, updateForm } = useForm(poster, {
      initialForm
    });

    updateForm(newForm);
    expect(form.value).toStrictEqual(newForm);

    reset();
    expect(form.value).toStrictEqual(initialForm);
  });

  test('should clear storaged data when call function reset manually', async () => {
    const poster = (data: any) => alovaInst.Post('/saveData', data);
    const initialForm = {
      date: null as Date | null,
      reg: null as RegExp | null
    };
    const { form, reset } = useForm(poster, {
      initialForm,
      store: true
    });
    const methodStorageKey = getStoragedKey(poster(initialForm));
    const dateObj = new Date('2022-10-01 00:00:00');
    const dateTimestamp = dateObj.getTime();
    const regObj = /abc_([0-9])+$/;
    form.value.date = dateObj;
    form.value.reg = regObj;
    await untilCbCalled(setTimeout, 20);
    expect(form.value).toStrictEqual({
      date: dateObj,
      reg: regObj
    });
    // 序列化自动转换date和regexp对象
    expect(alovaInst.storage.get(methodStorageKey)).toStrictEqual({
      date: ['date', dateTimestamp],
      reg: ['regexp', regObj.source]
    });

    reset();
    expect(form.value).toStrictEqual(initialForm);
    await untilCbCalled(setTimeout, 20);
    expect(alovaInst.storage.get(methodStorageKey)).toBeNull();
  });

  test('should remove storage form data when call function reset', async () => {
    const poster = (data: any) => alovaInst.Post('/saveData?d=3', data);
    const initialForm = {
      name: '',
      age: ''
    };
    const storagedForm = {
      name: 'Hong',
      age: '22'
    };

    // 预先存储数据，模拟刷新恢复持久化数据
    const methodStorageKey = getStoragedKey(poster(initialForm));
    alovaInst.storage.set(methodStorageKey, storagedForm);
    const getStoragedForm = () => alovaInst.storage.get(methodStorageKey);
    expect(getStoragedForm()).toStrictEqual(storagedForm);

    render(CompPersistentDataReset); // 渲染组件
    expect(screen.getByRole('form')).toHaveTextContent(JSON.stringify(initialForm)); // 缓存恢复前
    await screen.findByText('isRestore_1');
    expect(screen.getByRole('form')).toHaveTextContent(JSON.stringify(storagedForm)); // 缓存恢复后

    fireEvent.click(screen.getByRole('btnReset'));
    expect(getStoragedForm()).toBeNull();
  });

  test('should throw error when try to get uninitial id', () => {
    expect(() => {
      useForm('personInfo');
    }).toThrow('[alova/useForm]the form data of id `personInfo` is not initial');
  });

  test('should get cached hook returns when valid id is given', async () => {
    const initialForm = {
      name: '',
      age: ''
    };
    const poster = (data: any) => alovaInst.Post('/saveData', data);
    const formRet1 = useForm(poster, {
      initialForm,
      id: 'personInfo',
      resetAfterSubmit: true
    });
    const newForm = {
      name: 'Ming',
      age: '18'
    };

    // 直接传入id获取
    const formRet2 = useForm('personInfo');
    expect(formRet1).toBe(formRet2);

    // 传入完整参数时，有匹配到id也将使用匹配值
    const formRet3 = useForm(poster, {
      id: 'personInfo',
      initialForm: {
        tt1: '',
        tt2: ''
      },
      store: true
    });
    expect(formRet1).toBe(formRet3);

    formRet1.updateForm(newForm);
    expect(formRet2.form.value).toStrictEqual(newForm);
    expect(formRet3.form.value).toStrictEqual(newForm);

    await formRet1.send();
    // 提交后表单数据重置
    expect(formRet2.form.value).toStrictEqual(initialForm);
    expect(formRet3.form.value).toStrictEqual(initialForm);
  });

  test('should access actions by middleware actionDelegation', async () => {
    const poster = (form: any) => alovaInst.Post('/saveData', form);
    const newForm = {
      name: 'Ming',
      age: '18'
    };
    const { onSuccess, onComplete } = useForm(poster, {
      initialForm: newForm,
      immediate: true,
      middleware: actionDelegationMiddleware('test_page')
    });

    const successFn = jest.fn();
    const completeFn = jest.fn();
    onSuccess(successFn);
    onComplete(completeFn);
    await untilCbCalled(onSuccess);

    accessAction('test_page', handlers => {
      expect(handlers.send).toBeInstanceOf(Function);
      expect(handlers.abort).toBeInstanceOf(Function);
      expect(handlers.updateForm).toBeInstanceOf(Function);
      expect(handlers.reset).toBeInstanceOf(Function);
      handlers.send();
    });

    await untilCbCalled(onSuccess);
    expect(successFn).toBeCalledTimes(2);
    expect(completeFn).toBeCalledTimes(2);
  });
});
