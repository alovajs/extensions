import { $, $$, upd$, watch, _$, _exp$, _expBatch$ } from '@/framework/svelte';
import usePagination_unified from '@/hooks/pagination/usePagination';
import useSQRequest_unified from '@/hooks/silent/useSQRequest';
import useCaptcha_unified from '@/hooks/useCaptcha';
import useForm_unified from '@/hooks/useForm';
import useRetriableRequest_unified from '@/hooks/useRetriableRequest';

export const usePagination = (handler, config = {}) =>
  usePagination_unified(handler, config, $, $$, upd$, _$, _exp$, _expBatch$, watch);

// 已通过 hooks/silent/useSQRequest 导入测试
/* c8 ignore start */
export const useSQRequest = (handler, config = {}) => useSQRequest_unified(handler, config);
export {
  bootSilentFactory,
  onBeforeSilentSubmit,
  onSilentSubmitBoot,
  onSilentSubmitError,
  onSilentSubmitFail,
  onSilentSubmitSuccess
} from '@/hooks/silent/silentFactory';
export { silentQueueMap } from '@/hooks/silent/silentQueue';
export { default as dehydrateVData } from '@/hooks/silent/virtualResponse/dehydrateVData';
export { default as equals } from '@/hooks/silent/virtualResponse/equals';
export { filterSilentMethods, getSilentMethod } from '@/hooks/silent/virtualResponse/filterSilentMethods';
export { default as isVData } from '@/hooks/silent/virtualResponse/isVData';
export { default as stringifyVData } from '@/hooks/silent/virtualResponse/stringifyVData';
export { default as updateStateEffect } from '@/hooks/silent/virtualResponse/updateStateEffect';
export { accessAction, actionDelegationMiddleware } from '@/middlewares/actionDelegation'; // 导出actionDelegation中间件

// 导出useCaptcha
export const useCaptcha = (handler, config = {}) => useCaptcha_unified(handler, config, $, upd$, _$, _exp$);

// 导出useForm
export const useForm = (handler, config = {}) => useForm_unified(handler, config, $, _$, _exp$, upd$, watch);

// 导出useRetriableRequest
export const useRetriableRequest = (handler, config = {}) => useRetriableRequest_unified(handler, config, _$);
