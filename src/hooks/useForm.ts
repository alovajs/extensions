import {
  FrameworkState,
  T$,
  T$$,
  T_$,
  T_exp$,
  TonMounted$,
  Tupd$,
  TuseFlag$,
  TuseMemorizedCallback$,
  Twatch$
} from '@/framework/type';
import {
  createAssert,
  getContext,
  isNumber,
  isObject,
  isString,
  pushItem,
  runArgsHandler,
  sloughConfig
} from '@/helper';
import createSerializerPerformer from '@/helper/serializer';
import { falseValue, trueValue, undefinedValue } from '@/helper/variables';
import { Method, UseHookReturnType, getMethodKey, useRequest } from 'alova';
import { FormHookConfig, FormHookHandler, RestoreHandler, StoreDetailConfig } from '~/typings/general';

const getStoragedKey = (methodInstance: Method, id?: ID) => `alova/form-${id || getMethodKey(methodInstance)}`;
type ID = NonNullable<FormHookConfig<any, any, any, any, any, any, any, any>['id']>;
interface SharedState {
  hookReturns: UseHookReturnType<any, any, any, any, any, any, any>;
  config: FormHookConfig<any, any, any, any, any, any, any, any>;
}
const sharedStates = {} as Record<ID, SharedState>;
const assert = createAssert('useForm');
export default <S, E, R, T, RC, RE, RH, F>(
  handler: FormHookHandler<S, E, R, T, RC, RE, RH, F> | ID,
  config: FormHookConfig<S, E, R, T, RC, RE, RH, F>,
  $: T$,
  $$: T$$,
  _$: T_$,
  _exp$: T_exp$,
  upd$: Tupd$,
  watch$: Twatch$,
  onMounted$: TonMounted$,
  useFlag$: TuseFlag$,
  useMemorizedCallback$: TuseMemorizedCallback$
) => {
  // 如果第一个参数传入的是id，则获取它的初始化数据并返回
  if (isNumber(handler) || isString(handler)) {
    const id = handler as ID;
    const sharedState = sharedStates[id];
    assert(!!sharedState, `the form data of id \`${id}\` is not initial`);
    return sharedState.hookReturns;
  }

  const { id, initialForm, store, resetAfterSubmiting, immediate = falseValue, middleware } = config,
    form = $(initialForm, trueValue),
    methodHandler = handler as FormHookHandler<S, E, R, T, RC, RE, RH, F>,
    restoreHandlers: RestoreHandler[] = [],
    // 使用计算属性，避免每次执行此use hook都调用一遍methodHandler
    initialMethodInstance = $$(() => sloughConfig(methodHandler, [_$(form)]), []),
    isStoreObject = isObject(store),
    enableStore = isStoreObject ? (store as StoreDetailConfig).enable : store,
    storageContext = getContext(_$(initialMethodInstance)).storage,
    storagedKey = useFlag$(getStoragedKey(_$(initialMethodInstance), id)),
    reseting = useFlag$(falseValue),
    serializerPerformer = useFlag$(
      createSerializerPerformer(isStoreObject ? (store as StoreDetailConfig).serializers : undefinedValue)
    ),
    // 是否由当前hook发起创建的共享状态，发起创建的hook需要返回最新的状态，否则会因为在react中hook被调用，导致发起获得的hook中无法获得最新的状态
    isCreateShardState = useFlag$(false),
    // 如果config中的id也有对应的共享状态，则也会返回它
    // 继续往下执行是为了兼容react的hook执行数不能变的问题，否则会抛出"Rendered fewer hooks than expected. This may be caused by an accidental early return statement."
    sharedState = id ? sharedStates[id] : undefinedValue;

  /**
   * 重置form数据
   */
  const reset = useMemorizedCallback$(() => {
    reseting.v = trueValue;
    upd$(form, initialForm);
    enableStore && storageContext.remove(storagedKey.v);
  });

  /**
   * 更新form数据
   * @param newForm 新表单数据
   */
  const updateForm = useMemorizedCallback$((newForm: Partial<F> | ((oldForm: F) => F)) => {
    upd$(form as FrameworkState<any>, {
      ..._$(form),
      ...newForm
    });
  });
  let hookReturns = {
    form: _exp$(form),

    // 第一个参数固定为form数据
    ...useRequest((...args: any[]) => methodHandler(_$(form) as any, ...args), {
      ...config,

      // 中间件函数，也支持subscriberMiddleware
      middleware: middleware
        ? (ctx, next) =>
            middleware(
              {
                ...ctx,
                delegatingActions: { updateForm, reset }
              } as any,
              next
            )
        : undefinedValue,

      // 1. 当需要持久化时，将在数据恢复后触发
      // 2. 当已有共享状态时，表示之前已有初始化（无论有无立即发起请求），后面的不再自动发起请求，这是为了兼容多表单立即发起请求时，重复发出请求的问题
      immediate: enableStore || sharedState ? falseValue : immediate
    }),

    // 持久化数据恢复事件绑定
    onRestore(handler: RestoreHandler) {
      pushItem(restoreHandlers, handler);
    },
    updateForm,
    reset
  };

  // 有id时，才保存到sharedStates中
  // 在react中，因为更新form后会产生新的form，因此需要每次调用重新保存
  if (id) {
    // 还没有共享状态则表示当前hook是创建的hook
    if (!sharedState) {
      isCreateShardState.v = trueValue;
    }

    // 只保存创建hook的共享状态
    if (isCreateShardState.v) {
      sharedStates[id] = {
        hookReturns,
        config
      };
    }
  }

  const { send, onSuccess } = hookReturns;
  onMounted$(() => {
    // 需要持久化时更新data
    if (enableStore && !sharedState) {
      // 获取存储并更新data
      // 需要在onMounted中调用，否则会导致在react中重复被调用
      const storagedForm = serializerPerformer.v.deserialize(storageContext.get(storagedKey.v));

      // 有草稿数据时，异步恢复数据，否则无法正常绑定onRetore事件
      if (storagedForm) {
        upd$(form, storagedForm);
        // 触发持久化数据恢复事件
        runArgsHandler(restoreHandlers);
        enableStore && immediate && send();
      }
    }
  });

  // 监听变化同步存储，如果是reset触发的则不需要再序列化
  watch$([form], () => {
    if (reseting.v || !enableStore) {
      reseting.v = falseValue;
      return;
    }
    storageContext.set(storagedKey.v, serializerPerformer.v.serialize(_$(form)));
  });
  // 如果在提交后需要清除数据，则调用reset
  onSuccess(() => {
    resetAfterSubmiting && reset();
  });

  // 有已保存的sharedState，则返回它
  // 如果是当前hook创建的共享状态，则返回最新的而非缓存的
  return sharedState && !isCreateShardState.v ? sharedState.hookReturns : hookReturns;
};
