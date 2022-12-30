import { instanceOf, isArray, isFn, JSONStringify, len, objectKeys, walkObject } from '../../../helper';
import { falseValue, trueValue, undefinedValue } from '../../../helper/variables';
import { globalVirtualResponseLock } from '../globalVariables';
import { serializers } from '../serializer';
import { symbolVTagId } from '../virtualTag/variables';
import vtagDhy from '../virtualTag/vtagDhy';
import { vtagKey, vtagValueKey } from './helper';

/**
 * 序列化静默方法实例
 * 如果序列化值有被转换，它将记录转换的序列化器名字供反序列化时使用
 * @param silentMethodInstance 请求方法实例
 * @returns 请求方法的序列化实例
 */
export default (object: any) => {
  // 序列化时需要解锁，否则将访问不到虚拟响应数据内的虚拟标签id
  const prevResponseLockValue = globalVirtualResponseLock.v;
  globalVirtualResponseLock.v = 1;
  const transformedData = walkObject({ ...object }, (value, key, parent) => {
    // 表示已经是被处理成虚拟标签的了，不需要再处理的
    if (key === vtagValueKey && parent[vtagKey]) {
      return value;
    }

    // 不需要序列化alova实例
    if (key === 'context' && value?.constructor?.name === 'Alova') {
      return undefinedValue;
    }

    // methodHandler序列化
    if (key === 'methodHandler' && isFn(value)) {
      return value.toString();
    }

    const virtualTagId = value?.[symbolVTagId];
    let primitiveValue = vtagDhy(value);
    let finallyApplySerializer = undefinedValue as string | undefined;
    // 找到匹配的序列化器并进行值的序列化，未找到则返回原值
    primitiveValue = objectKeys(serializers).reduce((currentValue, serializerName) => {
      if (!finallyApplySerializer) {
        const serializedValue = serializers[serializerName].forward(currentValue);
        if (serializedValue !== undefinedValue) {
          finallyApplySerializer = serializerName;
          currentValue = serializedValue;
        }
      }
      return currentValue;
    }, primitiveValue);

    // 需要用原始值判断，否则像new Number(1)等包装类也会是[object Object]
    const toStringTag = toString.call(primitiveValue);
    let isExpanded = trueValue;
    if (toStringTag === '[object Object]') {
      value = { ...value };
      primitiveValue = {};
    } else if (isArray(value)) {
      value = [...value];
      primitiveValue = [];
    } else {
      isExpanded = falseValue;
    }

    if (virtualTagId) {
      const valueWithVTag = {
        [vtagKey]: virtualTagId,

        // 对于对象和数组来说，它内部的属性会全部通过`...value`放到外部，因此内部的不需要再进行遍历转换了
        // 因此将数组或对象置空，这样既避免了重复转换，又避免了污染原对象
        [vtagValueKey]:
          finallyApplySerializer !== undefinedValue ? [finallyApplySerializer, primitiveValue] : primitiveValue,
        ...value
      };
      // 如果是String类型，将会有像数组一样的如0、1、2为下标，值为字符的项，需将他们过滤掉
      if (instanceOf(value, String)) {
        for (let i = 0; i < len(value as string); i++) {
          delete valueWithVTag?.[i];
        }
      }
      // 如果转换成了虚拟标签，则将转换值赋给它内部，并在下面逻辑中统一由value处理
      value = valueWithVTag;
    } else if (!isExpanded) {
      value = finallyApplySerializer !== undefinedValue ? [finallyApplySerializer, primitiveValue] : primitiveValue;
    }

    return value;
  });
  const serializedString = JSONStringify(transformedData);
  globalVirtualResponseLock.v = prevResponseLockValue; // 恢复原值，需要先序列化json串后再锁定
  return serializedString;
};
