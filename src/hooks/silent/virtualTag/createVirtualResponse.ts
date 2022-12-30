import { includes, isFn, newInstance, uuid } from '../../../helper';
import { nullValue, symbolToPrimitive, symbolToStringTag, trueValue, undefinedValue } from '../../../helper/variables';
import { globalVirtualResponseLock } from '../globalVariables';
import { vTagCollectUnified } from './helper';
import { symbolIsProxy, symbolOriginalValue, symbolVTagId } from './variables';
import VTag, { VTagInterface } from './VTag';

/**
 * 创建虚拟标签
 * @returns 虚拟响应数据代理实例
 */
const createVirtualResponse = (defaults: any, vTagId = uuid()): any => {
  const vtagInstance = newInstance(VTag, defaults, vTagId);
  return newInstance(Proxy, vtagInstance, {
    get(target: VTagInterface, key): any {
      const originalValue = target[symbolOriginalValue];
      // 判断是否为proxy实例
      if (key === symbolIsProxy) {
        return trueValue;
      }
      // 获取原始值
      if (key === symbolOriginalValue) {
        return originalValue;
      }
      // 获取虚拟标签id
      let subTargetValue = target[key];
      if (symbolVTagId === key) {
        return subTargetValue;
      }

      const subOriginalValue = originalValue?.[key];
      // 将method实例序列化成字符串时触发
      // 此时返回该值的原始值
      if (
        includes(
          [
            'toJSON',
            'then', // 包裹在promise中时触发
            // 以下为vue3转转换为ref值时触发
            '__v_isRef',
            '__v_isShallow',
            '__v_raw',
            '__v_isReadonly',
            '__v_skip',
            symbolToStringTag
          ],
          key
        )
      ) {
        return subOriginalValue;
      }

      let ret = isFn(subOriginalValue) ? subOriginalValue.bind(originalValue) : subOriginalValue;
      if (globalVirtualResponseLock.v === 2) {
        if (includes([undefinedValue, nullValue], originalValue)) {
          ret = symbolToPrimitive === key ? subTargetValue : originalValue[key];
        }
        vTagCollectUnified(target);
      } else if (globalVirtualResponseLock.v === 1) {
        ret = subTargetValue;
      } else if (globalVirtualResponseLock.v === 0) {
        // 如果已经是代理对象了则不再创建
        ret = subTargetValue?.[symbolIsProxy]
          ? subTargetValue
          : (target[key] = createVirtualResponse(subOriginalValue));
      }
      return ret;
    }
  });
};

export default createVirtualResponse;
