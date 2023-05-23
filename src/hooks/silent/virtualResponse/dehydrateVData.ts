import { instanceOf, isPlainOrCustomObject, walkObject } from '@/helper';
import { BooleanCls, nullValue, NumberCls, StringCls, trueValue, undefinedValue } from '@/helper/variables';
import { isArray } from '@vue/shared';
import { vDataCollectUnified } from './helper';
import Null from './Null';
import Undefined from './Undefined';
import { symbolOriginal, symbolVDataId } from './variables';

/**
 * 获取带虚拟数据变量的原始值
 * 此函数也将会进行vData收集
 * @param target 目标值
 * @param deepDehydrate 是否深度脱水值
 * @returns 具有原始类型的目标值
 */
export const dehydrateVDataUnified = <T>(target: T, deepDehydrate = trueValue): T => {
  const dehydrateItem = (value: any) => {
    vDataCollectUnified(value);
    if (value?.[symbolVDataId]) {
      if (instanceOf(value, Undefined)) {
        value = undefinedValue;
      } else if (instanceOf(value, Null)) {
        value = nullValue;
      } else if (instanceOf(value, NumberCls) || instanceOf(value, StringCls) || instanceOf(value, BooleanCls)) {
        value = (value as any)[symbolOriginal];
      }
    }
    return value;
  };

  const newTarget = dehydrateItem(target);
  // 如果是对象或数组，需要深度遍历获取虚拟数据值
  if (deepDehydrate && (isPlainOrCustomObject(newTarget) || isArray(newTarget))) {
    walkObject(newTarget, value => dehydrateItem(value));
  }
  return newTarget;
};

/**
 * 上面函数deepDehydrate为true的版本
 */
export default <T>(target: T): T => dehydrateVDataUnified(target);
