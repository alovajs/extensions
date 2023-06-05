import { mockRequestAdapter, setMockListData, setMockListWithSearchData, setMockShortListData } from '#/mockData';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createAlova, queryCache } from 'alova';
import ReactHook from 'alova/react';
import React, { ReactElement, useState } from 'react';
import { generateContinuousNumbers, untilCbCalled } from '~/test/utils';
import { usePagination } from '..';

interface ListResponse {
  total: number;
  list: number[];
}
interface SearchListResponse {
  total: number;
  list: { id: number; word: string }[];
}

// jest.setTimeout(1000000);
// reset data
beforeEach(() => setMockListData());
beforeEach(() => setMockListWithSearchData());
beforeEach(() => setMockShortListData());
const createMockAlova = () =>
  createAlova({
    baseURL: 'http://localhost:8080',
    statesHook: ReactHook,
    requestAdapter: mockRequestAdapter
  });
describe('react => usePagination', () => {
  // 分页相关测试
  test('load paginated data and change page/pageSize', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize, setPageSize],
        isLastPage
      } = usePagination(getter, {
        total: res => res.total,
        data: res => res.list,
        initialData: {
          list: [],
          total: 0
        }
      });
      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="setPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="setPageSize"
            onClick={() => setPageSize(20)}>
            btn2
          </button>
          <button
            role="setLastPage"
            onClick={() => setPage(pageCount || 1)}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 1,
      pageSize = 10;
    await waitFor(() => {
      expect(screen.getByRole('page')).toHaveTextContent('1');
      expect(screen.getByRole('pageSize')).toHaveTextContent('10');
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(9)));
      expect(screen.getByRole('total')).toHaveTextContent('300');
      expect(screen.getByRole('pageCount')).toHaveTextContent('30');
      expect(screen.getByRole('isLastPage')).toHaveTextContent('false');
    });

    // 检查预加载缓存
    await waitFor(() => {
      let cache = queryCache(getter(page + 1, pageSize));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(19, 10));
      cache = queryCache(getter(page - 1, pageSize));
      expect(cache).toBeUndefined();
    });

    fireEvent.click(screen.getByRole('setPage'));
    await waitFor(() => {
      expect(screen.getByRole('page')).toHaveTextContent('2');
      expect(screen.getByRole('pageSize')).toHaveTextContent('10');
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(19, 10)));
      expect(screen.getByRole('total')).toHaveTextContent('300');
      expect(screen.getByRole('pageCount')).toHaveTextContent('30');
      expect(screen.getByRole('isLastPage')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('setPageSize'));
    await waitFor(() => {
      expect(screen.getByRole('page')).toHaveTextContent('2');
      expect(screen.getByRole('pageSize')).toHaveTextContent('20');
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(39, 20)));
      expect(screen.getByRole('total')).toHaveTextContent('300');
      expect(screen.getByRole('pageCount')).toHaveTextContent('15');
      expect(screen.getByRole('isLastPage')).toHaveTextContent('false');
    });

    // 检查预加载缓存
    await waitFor(() => {
      let cache = queryCache(getter(3, 20));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(59, 40));
      cache = queryCache(getter(1, 20));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(19));
    });

    // 最后一页
    fireEvent.click(screen.getByRole('setLastPage'));
    await waitFor(() => {
      expect(screen.getByRole('isLastPage')).toHaveTextContent('true');
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(299, 280)));
      let cache = queryCache(getter(16, 20));
      expect(cache).toBeUndefined();
      cache = queryCache(getter(14, 20));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(279, 260));
    });
  });

  test('should throw error when got wrong array', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    function Page() {
      const { error } = usePagination(getter, {
        data: ({ wrongList }: any) => wrongList
      });
      return <span role="error">{error?.message}</span>;
    }

    render((<Page />) as ReactElement<any, any>);
    await waitFor(() => {
      expect(screen.getByRole('error')).toHaveTextContent(
        '[alova/usePagination]Got wrong array, did you return the correct array of list in `data` function'
      );
    });
  });

  // 不立即发送请求
  test('should not load paginated data when set `immediate` to false', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    function Page() {
      const {
        loading,
        pageSize: [pageSize, setPageSize],
        page: [page, setPage],
        data,
        total,
        pageCount,
        isLastPage
      } = usePagination(getter, {
        total: res => res.total,
        data: res => res.list,
        immediate: false
      });
      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="setPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="setPageSize"
            onClick={() => setPageSize(20)}>
            btn2
          </button>
          <button
            role="setLastPage"
            onClick={() => setPage(pageCount || 1)}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    await waitFor(() => {
      expect(screen.getByRole('page')).toHaveTextContent('1');
      expect(screen.getByRole('pageSize')).toHaveTextContent('10');
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([]));
      expect(screen.getByRole('total')).toHaveTextContent('');
      expect(screen.getByRole('pageCount')).toHaveTextContent('');
      expect(screen.getByRole('isLastPage')).toHaveTextContent('true');
    });

    fireEvent.click(screen.getByRole('setPage'));
    await waitFor(() => {
      expect(screen.getByRole('page')).toHaveTextContent('2');
      expect(screen.getByRole('pageSize')).toHaveTextContent('10');
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(19, 10)));
      expect(screen.getByRole('total')).toHaveTextContent('300');
      expect(screen.getByRole('pageCount')).toHaveTextContent('30');
      expect(screen.getByRole('isLastPage')).toHaveTextContent('false');
    });
  });

  test('paginated data with conditions search', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number, keyword: string) =>
      alovaInst.Get<SearchListResponse>('/list-with-search', {
        params: {
          page,
          pageSize,
          keyword
        }
      });

    function Page() {
      const [keyword, setKeyword] = useState('');
      const {
        loading,
        pageSize: [pageSize, setPageSize],
        pageCount,
        isLastPage,
        page: [page, setPage],
        data,
        total
      } = usePagination((p, ps) => getter(p, ps, keyword), {
        watchingStates: [keyword],
        total: res => res.total,
        data: res => res.list
      });
      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="setPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="setPageSize"
            onClick={() => setPageSize(20)}>
            btn2
          </button>
          <button
            role="setKeyword"
            onClick={() => setKeyword('bbb')}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(
          generateContinuousNumbers(9, 0, i => {
            let n = i % 3;
            return {
              id: i,
              word: ['aaa', 'bbb', 'ccc'][n]
            };
          })
        )
      );
      expect(screen.getByRole('total')).toHaveTextContent('300');
    });

    fireEvent.click(screen.getByRole('setPage'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(
          generateContinuousNumbers(19, 10, i => {
            let n = i % 3;
            return {
              id: i,
              word: ['aaa', 'bbb', 'ccc'][n]
            };
          })
        )
      );
      expect(screen.getByRole('total')).toHaveTextContent('300');
    });

    fireEvent.click(screen.getByRole('setKeyword'));
    await waitFor(() => {
      JSON.parse(screen.getByRole('response').textContent || '[]').forEach(({ word }: any) => expect(word).toBe('bbb'));
      expect(screen.getByRole('total')).toHaveTextContent('100');
    });
  });

  test('paginated data refersh page', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    function Page() {
      const {
        loading,
        data,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize, setPageSize],
        isLastPage,
        refresh
      } = usePagination(getter, {
        total: res => res.total,
        data: res => res.list,
        initialPage: 3
      });
      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="setPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="setPageSize"
            onClick={() => setPageSize(20)}>
            btn2
          </button>
          <button
            role="refresh1"
            onClick={() => refresh(1)}>
            btn3
          </button>
          <button
            role="refresh3"
            onClick={() => refresh(3)}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    setMockListData(data => {
      // 修改第3页第1条数据
      data.splice(20, 1, 200);
      return data;
    });

    fireEvent.click(screen.getByRole('refresh3'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(generateContinuousNumbers(29, 20, i => (i === 20 ? 200 : i)))
      );
    });

    // 修改第1页数据
    setMockListData(data => {
      data.splice(0, 1, 100);
      return data;
    });
    fireEvent.click(screen.getByRole('refresh1')); // 在翻页模式下，不是当前页会使用fetch
    await waitFor(() => {
      const cache = queryCache(getter(1, 10));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(9, 0, i => (i === 0 ? 100 : i)));
    });
  });

  test('paginated data insert item with preload', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize, setPageSize],
        isLastPage,
        insert,
        onFetchSuccess
      } = usePagination(getter, {
        data: res => res.list,
        initialPage: 2 // 默认从第2页开始
      });
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="setPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="setPageSize"
            onClick={() => setPageSize(20)}>
            btn2
          </button>
          <button
            role="insert300"
            onClick={() => insert(300, 0)}>
            btn3
          </button>
          <button
            role="batchInsert"
            onClick={() => {
              insert(400);
              insert(500, 2);
              insert(600, pageSize - 1);
            }}>
            btn3
          </button>
        </div>
      );
    }
    render((<Page />) as ReactElement<any, any>);

    let page = 2,
      pageSize = 10,
      total = 300;
    // 检查预加载缓存
    await waitFor(() => {
      let cache = queryCache(getter(page + 1, pageSize));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(29, 20));
      cache = queryCache(getter(page - 1, pageSize));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(9));
      expect(fetchMockFn).toBeCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('insert300'));
    setMockListData(data => {
      data.splice(10, 0, 300);
      return data;
    });
    total++;
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(generateContinuousNumbers(18, 9, { 9: 300 }))
      );
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());

      // 检查当前页缓存
      let cache = queryCache(getter(page, pageSize));
      expect(cache?.list).toStrictEqual([300, ...generateContinuousNumbers(18, 10)]);

      // 检查是否重新fetch了后一页的数据
      expect(fetchMockFn).toBeCalledTimes(3);
      cache = queryCache(getter(page + 1, pageSize));
      // insert时会将缓存末尾去掉，因此还是剩下10项
      expect(cache?.list).toEqual(generateContinuousNumbers(28, 19));
    });

    fireEvent.click(screen.getByRole('batchInsert'));
    total += 3;
    await waitFor(() => {
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
      const curData = [400, 300, 500, ...generateContinuousNumbers(15, 10), 600];
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(curData));

      // 当前页缓存要保持一致
      const cache = queryCache(getter(page, pageSize));
      expect(cache?.list).toStrictEqual(curData);

      expect(fetchMockFn).toBeCalledTimes(4);
    });
  });

  // 当操作了数据重新fetch但还未响应时，翻页到了fetch的页，此时也需要更新界面
  test('should update data when insert and fetch current page', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        insert,
        onFetchSuccess
      } = usePagination(getter, {
        data: res => res.list,
        initialPage: 2, // 默认从第2页开始
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="batchInsert1"
            onClick={() => {
              insert(1000, 1);
              insert(1001, 2);
            }}>
            btn3
          </button>
        </div>
      );
    }
    render((<Page />) as ReactElement<any, any>);
    let page = 2,
      pageSize = 4,
      total = 300;

    // 通过检查缓存数据表示预加载数据成功
    await waitFor(() => {
      let cache = queryCache(getter(page - 1, pageSize));
      expect(cache?.list).toStrictEqual(generateContinuousNumbers(3));
      cache = queryCache(getter(page + 1, pageSize));
      expect(cache?.list).toEqual(generateContinuousNumbers(11, 8));
      expect(fetchMockFn).toBeCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('batchInsert1'));
    total += 2;
    // 模拟数据中同步删除，这样fetch的数据校验才正常
    setMockListData(data => {
      data.splice(5, 0, 1000, 1001);
      return data;
    });

    // 正在重新fetch下一页数据，但还没响应，此时翻页到下一页
    await untilCbCalled(setTimeout, 20);
    fireEvent.click(screen.getByRole('addPage'));
    // 等待fetch
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(9, 6))); // 有两项被挤到后面一页了
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
      // 5次来源分别是：初始化时2次、插入数据时1次（fetch下一页）、翻页时2次
      expect(fetchMockFn).toBeCalledTimes(5);
    });

    // 再次返回前一页，移除的数据不应该存在
    fireEvent.click(screen.getByRole('subtractPage'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 1000, 1001, 5]));
    });
  });

  test('paginated data replace item', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        replace
      } = usePagination(getter, {
        data: res => res.list
      });
      const [error, setError] = useState(undefined as Error | undefined);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <span role="error">{error?.message || ''}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="replaceError1"
            onClick={() => {
              try {
                replace(100, undefined as any);
              } catch (err: any) {
                setError(err);
              }
            }}>
            btn3
          </button>
          <button
            role="replaceError2"
            onClick={() => {
              try {
                replace(100, 1000);
              } catch (err: any) {
                err.message += '___2';
                setError(err);
              }
            }}>
            btn3
          </button>
          <button
            role="replace1"
            onClick={() => {
              replace(300, 0);
            }}>
            btn3
          </button>
          <button
            role="replace2"
            onClick={() => {
              // 正向顺序替换
              replace(400, 8);
            }}>
            btn3
          </button>
          <button
            role="replace3"
            onClick={() => {
              // 逆向顺序替换
              replace(500, -4);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    await screen.findByText(/loaded/);

    fireEvent.click(screen.getByRole('replaceError1'));
    await waitFor(() => {
      expect(screen.getByRole('error')).toHaveTextContent(
        '[alova/usePagination]index must be a number that less than list length'
      );
    });
    fireEvent.click(screen.getByRole('replaceError2'));
    await waitFor(() => {
      expect(screen.getByRole('error')).toHaveTextContent(
        '[alova/usePagination]index must be a number that less than list length___2'
      );
    });

    fireEvent.click(screen.getByRole('replace1'));
    await waitFor(() => {
      // 第一项被替换了
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(generateContinuousNumbers(9, 0, { 0: 300 }))
      );

      // 检查当前页缓存
      expect(queryCache(getter(1, 10))?.list).toEqual(generateContinuousNumbers(9, 0, { 0: 300 }));
    });

    // 正向顺序替换
    fireEvent.click(screen.getByRole('replace2'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(generateContinuousNumbers(9, 0, { 0: 300, 8: 400 }))
      );

      // 检查当前页缓存
      expect(queryCache(getter(1, 10))?.list).toEqual(generateContinuousNumbers(9, 0, { 0: 300, 8: 400 }));
    });

    // 逆向顺序替换
    fireEvent.click(screen.getByRole('replace3'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(generateContinuousNumbers(9, 0, { 0: 300, 8: 400, 6: 500 }))
      );

      // 检查当前页缓存
      expect(queryCache(getter(1, 10))?.list).toEqual(generateContinuousNumbers(9, 0, { 0: 300, 8: 400, 6: 500 }));
    });
  });

  test('paginated data insert item without preload', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        insert,
        onFetchSuccess,
        onSuccess
      } = usePagination(getter, {
        data: res => res.list,
        preloadNextPage: false,
        preloadPreviousPage: false,
        initialPage: 2 // 默认从第2页开始
      });
      const [loaded, setLoaded] = useState(false);
      onSuccess(() => setLoaded(true));
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loaded ? 'loaded' : ''}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="insert1"
            onClick={() => {
              insert(300);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 2,
      pageSize = 10;
    await screen.findByText(/loaded/);

    // 检查预加载缓存
    let cache = queryCache(getter(page + 1, pageSize));
    expect(cache).toBeUndefined();
    cache = queryCache(getter(page - 1, pageSize));
    expect(cache).toBeUndefined();

    fireEvent.click(screen.getByRole('insert1'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(generateContinuousNumbers(18, 9, { 9: 300 }))
      );
    });

    // 预加载设置为false了，因此不会fetch前后一页的数据
    await untilCbCalled(setTimeout, 100);
    cache = queryCache(getter(page + 1, pageSize));
    expect(cache).toBeUndefined();
    cache = queryCache(getter(page - 1, pageSize));
    expect(cache).toBeUndefined();
  });

  test('paginated data remove item in preload mode', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    const successMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        remove,
        onFetchSuccess,
        onSuccess
      } = usePagination(getter, {
        data: res => res.list,
        initialPage: 2, // 默认从第2页开始
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);
      onSuccess(successMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="batchRemove1"
            onClick={() => {
              // 删除第二项，将会用下一页的数据补位，并重新拉取上下一页的数据
              remove(1);
              remove(1);
            }}>
            btn3
          </button>
          <button
            role="remove2"
            onClick={() => {
              remove(2);
            }}>
            btn3
          </button>
          <button
            role="batchRemove2"
            onClick={() => {
              // 同步操作的项数超过pageSize时，移除的数据将被恢复，并重新请求当前页数据
              remove(0);
              remove(0);
              remove(0);
              remove(0);
              remove(0);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 2,
      pageSize = 4,
      total = 300;
    await waitFor(() => {
      // 检查预加载缓存
      let cache = queryCache(getter(page + 1, pageSize));
      expect(!!cache).toBeTruthy();
      cache = queryCache(getter(page - 1, pageSize));
      expect(!!cache).toBeTruthy();
    });
    expect(fetchMockFn).toBeCalledTimes(2); // 初始化时2次

    // 删除第二项，将会用下一页的数据补位，并重新拉取上下一页的数据
    fireEvent.click(screen.getByRole('batchRemove1'));
    setMockListData(data => {
      // 模拟数据中同步删除，这样fetch的数据校验才正常
      data.splice(5, 2);
      return data;
    });
    total -= 2;
    // 下一页缓存已经被使用了2项
    expect(queryCache(getter(page + 1, pageSize))?.list).toStrictEqual([10, 11]);
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 7, 8, 9]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());

      // 当前页缓存要保持一致
      expect(queryCache(getter(page, pageSize))?.list).toStrictEqual([4, 7, 8, 9]);
    });

    // 等待删除后重新fetch下一页完成再继续
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(3);
    });

    // 请求发送了，但还没响应（响应有50ms延迟），此时再一次删除，期望还可以使用原缓存且中断请求
    fireEvent.click(screen.getByRole('remove2'));
    setMockListData(data => {
      data.splice(6, 1);
      return data;
    });
    total--;
    // 下一页缓存又被使用了1项
    expect(queryCache(getter(page + 1, pageSize))?.list).toStrictEqual([11, 12, 13]);
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 7, 9, 10]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
      expect(fetchMockFn).toBeCalledTimes(3);
    });

    // 检查是否重新fetch了前后一页的数据
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(4);
      let cache = queryCache(getter(page - 1, pageSize));
      expect(cache?.list).toStrictEqual([0, 1, 2, 3]);
      cache = queryCache(getter(page + 1, pageSize));
      expect(cache?.list).toStrictEqual([11, 12, 13, 14]);
    });

    // 同步操作的项数超过pageSize时，移除的数据将被恢复，并重新请求当前页数据
    fireEvent.click(screen.getByRole('batchRemove2'));
    setMockListData(data => {
      // 模拟数据中同步删除
      data.splice(4, 5);
      return data;
    });
    total -= 5;
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 7, 9, 10])); // 数据被恢复
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
      // 只在初始化成功一次，还未触发refresh
      expect(successMockFn).toBeCalledTimes(1);
    });

    await waitFor(() => {
      // 当同步删除多于1页的数据时会refrefh当前页，也会重新fetch下一页
      expect(fetchMockFn).toBeCalledTimes(5);
      expect(successMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([12, 13, 14, 15]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());

      let cache = queryCache(getter(page - 1, pageSize));
      expect(cache?.list).toStrictEqual([0, 1, 2, 3]);
      cache = queryCache(getter(page + 1, pageSize));
      expect(cache?.list).toStrictEqual([16, 17, 18, 19]);
    });
  });

  // 当操作了数据重新fetch但还未响应时，翻页到了正在fetch的页，此时也需要更新界面
  test('should update data when fetch current page', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        remove,
        onFetchSuccess
      } = usePagination(getter, {
        data: res => res.list,
        initialPage: 2, // 默认从第2页开始
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="batchRemove1"
            onClick={() => {
              // 删除第二项，将会用下一页的数据补位，并重新拉取上下一页的数据
              remove(1);
              remove(1);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 2,
      pageSize = 4,
      total = 300;
    await waitFor(() => {
      // 检查预加载缓存
      let cache = queryCache(getter(page + 1, pageSize));
      expect(!!cache).toBeTruthy();
      cache = queryCache(getter(page - 1, pageSize));
      expect(!!cache).toBeTruthy();
      expect(fetchMockFn).toBeCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('batchRemove1'));
    total -= 2;
    setMockListData(data => {
      // 模拟数据中同步删除，这样fetch的数据校验才正常
      return data.filter((i: number) => ![5, 6].includes(i));
    });

    // 正在重新fetch下一页数据，但还没响应（响应有50ms延迟），此时翻页到下一页
    await untilCbCalled(setTimeout, 10);
    fireEvent.click(screen.getByRole('addPage'));
    await waitFor(() => {
      // 有两项用于填补前一页数据了
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([10, 11]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });

    // fetch响应后
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(5); // 初始化2次 + 删除fetch1次 + 翻页后fetch2次
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([10, 11, 12, 13]));
    });

    // 再次返回前一页，移除的数据不应该存在
    fireEvent.click(screen.getByRole('subtractPage'));
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(7); // 翻页再fetch2次
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 7, 8, 9]));
    });
  });

  test('should use new total data when remove items and go to adjacent page', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number, min: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize,
          min
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const [min, setMin] = useState(0);
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        remove,
        onFetchSuccess
      } = usePagination((p, ps) => getter(p, ps, min), {
        data: res => res.list,
        watchingStates: [min],
        initialPage: 2, // 默认从第2页开始
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="addPage2"
            onClick={() => setPage(v => v + 2)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="batchRemove1"
            onClick={() => {
              // 删除第二项，将会用下一页的数据补位，并重新拉取上下一页的数据
              remove(1);
              remove(1);
            }}>
            btn3
          </button>
          <button
            role="remove2"
            onClick={() => {
              remove(1);
            }}>
            btn3
          </button>
          <button
            role="changeMin1"
            onClick={() => {
              setMin(100);
            }}>
            btn3
          </button>
          <button
            role="resetMin"
            onClick={() => {
              setMin(0);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 2,
      pageSize = 4,
      total = 300,
      min = 0;
    // 等待预加载数据完成
    await waitFor(() => {
      let cache = queryCache(getter(page + 1, pageSize, min));
      expect(!!cache).toBeTruthy();
      cache = queryCache(getter(page - 1, pageSize, min));
      expect(!!cache).toBeTruthy();
      expect(fetchMockFn).toBeCalledTimes(2);
    });

    // 删除两项，前后页的total也会同步更新
    fireEvent.click(screen.getByRole('batchRemove1'));
    total -= 2;
    setMockListData(data => {
      // 模拟数据中同步删除，这样fetch的数据校验才正常
      return data.filter((i: number) => ![5, 6].includes(i));
    });
    await waitFor(() => {
      // 有两项用于填补前一页数据了
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 7, 8, 9]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
      expect(fetchMockFn).toBeCalledTimes(2); // 还未触发预加载下一页
    });

    await untilCbCalled(setTimeout, 10); // 发起了预加载后再继续
    fireEvent.click(screen.getByRole('subtractPage'));
    // 等待fetch完成后检查total是否正确
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(4); // 初始化2次、删除后1次、翻到第1页1次（第1页不触发上一页预加载）
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([0, 1, 2, 3]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });

    fireEvent.click(screen.getByRole('addPage2'));
    // 等待fetch完成后检查total是否正确
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(6); // 再次翻页+2次
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([10, 11, 12, 13]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });

    // 改变筛选条件将使用最新的total
    // 注意：改变监听条件后会自动重置为page=1
    fireEvent.click(screen.getByRole('changeMin1'));
    let totalBackup = total;
    total = 200;
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(7); // 改变筛选条件（自动重置第一页）+1次
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 101, 102, 103]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });

    // 删除一条
    fireEvent.click(screen.getByRole('remove2'));
    total--;
    totalBackup--;
    setMockListData(data => {
      // 模拟数据中同步删除，这样fetch的数据校验才正常
      return data.filter((i: number) => ![101].includes(i));
    });
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(8); // 预加载下一页+1
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 102, 103, 104]));
      // 再次看total是否正确
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });

    // 条件改回去，需要延迟一会儿再继续操作
    await untilCbCalled(setTimeout, 10);
    fireEvent.click(screen.getByRole('resetMin'));
    total = totalBackup;
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(9); // 条件改变（当前第一页）+1
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([0, 1, 2, 3]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });
  });

  test('paginated data remove short list item without preload', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list-short', {
        params: {
          page,
          pageSize
        }
      });

    const successMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        remove,
        onSuccess
      } = usePagination(getter, {
        data: res => res.list,
        total: res => res.total,
        initialPage: 3, // 默认从第3页开始
        initialPageSize: 4,
        preloadNextPage: false,
        preloadPreviousPage: false
      });
      onSuccess(successMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="addPage2"
            onClick={() => setPage(v => v + 2)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="remove1"
            onClick={() => {
              remove(1);
            }}>
            btn3
          </button>
          <button
            role="remove2"
            onClick={() => {
              remove(0);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 3,
      pageSize = 4,
      total = 10;

    // 等待请求成功
    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('remove1'));
    total -= 1;
    setMockShortListData(data => {
      // 模拟数据中同步删除，这样fetch的数据校验才正常
      return data.filter((i: number) => ![9].includes(i));
    });

    await waitFor(() => {
      // 有两项用于填补前一页数据了
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([8]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());

      // 当前页缓存要保持一致
      const cache = queryCache(getter(page, pageSize));
      expect(cache?.list).toStrictEqual([8]);
    });

    fireEvent.click(screen.getByRole('remove2'));
    total--;
    setMockShortListData(data => {
      return data.filter((i: number) => ![8].includes(i));
    });

    // 当最后一页没数据后，会自动切换到上一页
    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('page')).toHaveTextContent('2');
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 5, 6, 7]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });
  });

  test('should refresh current page and will not prefetch when close cache', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list-short', {
        localCache: 0,
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    const successMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        remove,
        insert,
        replace,
        onSuccess,
        onFetchSuccess
      } = usePagination(getter, {
        data: res => res.list,
        total: res => res.total,
        initialPage: 2,
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);
      onSuccess(successMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="addPage2"
            onClick={() => setPage(v => v + 2)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="remove1"
            onClick={() => {
              remove(1);
            }}>
            btn3
          </button>
          <button
            role="insert1"
            onClick={() => {
              // 插入数据，插入时不会刷新数据
              insert(100, 0);
            }}>
            btn3
          </button>
          <button
            role="replace1"
            onClick={() => {
              replace(200, 1);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 2,
      pageSize = 4,
      total = 10;

    // 等待请求成功
    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(1);
    });

    // 删除数据
    fireEvent.click(screen.getByRole('remove1'));
    total -= 1;
    setMockShortListData(data => {
      // 模拟数据中同步删除，这样fetch的数据校验才正常
      return data.filter((i: number) => ![5].includes(i));
    });

    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 6, 7, 8]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
      // 当前缓存已关闭
      expect(queryCache(getter(page, pageSize))).toBeUndefined();
    });

    // 插入数据，插入时不会刷新数据
    fireEvent.click(screen.getByRole('insert1'));
    total++;
    setMockShortListData(data => {
      data.splice(4, 0, 100);
      return data;
    });

    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 4, 6, 7]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });

    // 替换数据
    fireEvent.click(screen.getByRole('replace1'));
    setMockShortListData(data => {
      data.splice(5, 1, 200);
      return data;
    });
    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 200, 6, 7]));
      expect(screen.getByRole('total')).toHaveTextContent(total.toString());
    });
    // method没有设置缓存时，不会触发数据拉取
    expect(fetchMockFn).not.toBeCalled();
  });

  // // 下拉加载更多相关
  test('load more mode paginated data. and change page/pageSize', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const successMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        onSuccess
      } = usePagination(getter, {
        total: () => undefined,
        data: res => res.list,
        append: true,
        preloadNextPage: false,
        preloadPreviousPage: false
      });
      onSuccess(successMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="addPage2"
            onClick={() => setPage(v => v + 2)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="toNoDataPage"
            onClick={() => {
              setPage(31);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    let page = 1,
      pageSize = 10;

    // 等待请求成功
    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(1);
      expect(screen.getByRole('page')).toHaveTextContent(page.toString());
      expect(screen.getByRole('pageSize')).toHaveTextContent(pageSize.toString());
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(9)));
      expect(screen.getByRole('total')).toHaveTextContent('');
      expect(screen.getByRole('pageCount')).toHaveTextContent('');
      expect(screen.getByRole('isLastPage')).toHaveTextContent('false');
    });

    // 检查预加载缓存
    await untilCbCalled(setTimeout, 100);
    expect(queryCache(getter(page + 1, pageSize))?.list).toBeUndefined();

    fireEvent.click(screen.getByRole('addPage'));
    page++;
    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('page')).toHaveTextContent(page.toString());
      expect(screen.getByRole('pageSize')).toHaveTextContent(pageSize.toString());
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(19))); // 翻页数据追加到尾部
      expect(screen.getByRole('total')).toHaveTextContent('');
      expect(screen.getByRole('pageCount')).toHaveTextContent('');
      expect(screen.getByRole('isLastPage')).toHaveTextContent('false');
    });

    await untilCbCalled(setTimeout, 100);
    expect(queryCache(getter(page + 1, pageSize))?.list).toBeUndefined();

    // 翻页到没有数据的一页，没有提供total时，数据少于pageSize条时将会把isLastPage判断为true
    fireEvent.click(screen.getByRole('toNoDataPage'));
    page = 31;
    await waitFor(() => {
      expect(successMockFn).toBeCalledTimes(3);
      expect(screen.getByRole('page')).toHaveTextContent(page.toString());
      expect(screen.getByRole('isLastPage')).toHaveTextContent('true');
    });
  });

  test('load more paginated data with conditions search', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number, keyword: string) =>
      alovaInst.Get<SearchListResponse>('/list-with-search', {
        params: {
          page,
          pageSize,
          keyword
        }
      });

    function Page() {
      const [keyword, setKeyword] = useState('');
      const {
        loading,
        pageSize: [pageSize, setPageSize],
        pageCount,
        isLastPage,
        page: [page, setPage],
        data,
        total
      } = usePagination((p, ps) => getter(p, ps, keyword), {
        watchingStates: [keyword],
        total: () => undefined,
        data: res => res.list,
        append: true
      });
      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="setPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="setPageSize"
            onClick={() => setPageSize(20)}>
            btn2
          </button>
          <button
            role="setKeyword"
            onClick={() => setKeyword('bbb')}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(
          generateContinuousNumbers(9, 0, i => {
            let n = i % 3;
            return {
              id: i,
              word: ['aaa', 'bbb', 'ccc'][n]
            };
          })
        )
      );
      expect(screen.getByRole('total')).toHaveTextContent('');
    });

    fireEvent.click(screen.getByRole('setPage'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(
          generateContinuousNumbers(19, 0, i => {
            let n = i % 3;
            return {
              id: i,
              word: ['aaa', 'bbb', 'ccc'][n]
            };
          })
        )
      );
      expect(screen.getByRole('total')).toHaveTextContent('');
    });

    fireEvent.click(screen.getByRole('setKeyword'));
    await waitFor(() => {
      JSON.parse(screen.getByRole('response').textContent || '[]').forEach(({ word }: any) => expect(word).toBe('bbb'));
      expect(screen.getByRole('total')).toHaveTextContent('');
    });
  });

  test('load more mode paginated data refersh page', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    function Page() {
      const [error, setError] = useState(undefined as Error | undefined);
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        refresh
      } = usePagination(getter, {
        total: () => undefined,
        data: res => res.list,
        append: true,
        preloadNextPage: false,
        preloadPreviousPage: false
      });

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="error">{error?.message || ''}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="refreshError"
            onClick={() => {
              try {
                refresh(100);
              } catch (error: any) {
                setError(error);
              }
            }}>
            btn3
          </button>
          <button
            role="refresh1"
            onClick={() => {
              refresh(1);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(9)));
    });

    fireEvent.click(screen.getByRole('addPage'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(19)));
    });

    fireEvent.click(screen.getByRole('refreshError'));
    await waitFor(() => {
      expect(screen.getByRole('error')).toHaveTextContent("[alova/usePagination]refresh page can't greater than page");
    });

    // 手动改变一下接口数据，让刷新后能看出效果
    setMockListData(data => {
      data.splice(0, 1, 100);
      return data;
    });

    fireEvent.click(screen.getByRole('refresh1'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(
        JSON.stringify(generateContinuousNumbers(19, 0, { 0: 100 }))
      );
    });
  });

  test('load more mode paginated data operate items with remove/insert/replace(open preload)', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        remove,
        insert,
        replace,
        onFetchSuccess
      } = usePagination(getter, {
        total: () => undefined,
        data: res => res.list,
        initialPage: 2, // 默认从第2页开始
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="addPage2"
            onClick={() => setPage(v => v + 2)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="mixedOperate"
            onClick={() => {
              remove(1);
              remove(1);
              insert(100, 0);
              replace(200, 2);
            }}>
            btn3
          </button>
          <button
            role="remove2"
            onClick={() => {
              remove(1);
            }}>
            btn3
          </button>
        </div>
      );
    }
    render((<Page />) as ReactElement<any, any>);

    // 等待fetch完成
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('total')).toHaveTextContent('');
      expect(screen.getByRole('pageCount')).toHaveTextContent('');
    });

    // 混合同步操作
    fireEvent.click(screen.getByRole('mixedOperate'));
    setMockListData(data => {
      // 模拟数据中同步删除，这样fetch的数据校验才正常
      data.splice(5, 2);
      data.splice(4, 0, 100);
      data.splice(6, 1, 200);
      return data;
    });
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 4, 200, 8]));
      expect(screen.getByRole('total')).toHaveTextContent('');
      expect(screen.getByRole('pageCount')).toHaveTextContent('');
      expect(fetchMockFn).toBeCalledTimes(3); // 多次同步操作只会触发一次预加载
    });

    fireEvent.click(screen.getByRole('addPage'));
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([9, 10, 11, 12]));
      expect(screen.getByRole('total')).toHaveTextContent('');
      expect(screen.getByRole('pageCount')).toHaveTextContent('');
      expect(fetchMockFn).toBeCalledTimes(5);
    });
  });

  test('load more mode paginated data remove item without preload', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const successMockFn = jest.fn();
    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        remove,
        onFetchSuccess,
        onSuccess
      } = usePagination(getter, {
        total: () => undefined,
        data: res => res.list,
        append: true,
        preloadNextPage: false,
        preloadPreviousPage: false,
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);
      onSuccess(successMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="batchRemove1"
            onClick={() => {
              // 下一页没有缓存的情况下，将会重新请求刷新列表
              remove(0);
              remove(0);
            }}>
            btn3
          </button>
        </div>
      );
    }

    render((<Page />) as ReactElement<any, any>);
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([0, 1, 2, 3]));
      expect(successMockFn).toBeCalledTimes(1);
    });

    // 下一页没有缓存的情况下，将会重新请求刷新列表
    fireEvent.click(screen.getByRole('batchRemove1'));
    setMockListData(data => {
      // 模拟数据中同步删除
      data.splice(0, 2);
      return data;
    });
    await waitFor(() => {
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([2, 3, 4, 5]));
      expect(successMockFn).toBeCalledTimes(2);
      expect(fetchMockFn).not.toBeCalled();
    });

    await untilCbCalled(setTimeout, 100);
    expect(fetchMockFn).not.toBeCalled();
  });

  test('load more mode reload paginated data', async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        reload,
        onFetchSuccess
      } = usePagination(getter, {
        total: () => undefined,
        data: res => res.list,
        append: true,
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="reload1"
            onClick={() => {
              reload();
            }}>
            btn1
          </button>
        </div>
      );
    }
    render((<Page />) as ReactElement<any, any>);

    // 等待fetch完成
    await waitFor(() => {
      // 第一页时只有下一页会被预加载
      expect(fetchMockFn).toBeCalledTimes(1);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([0, 1, 2, 3]));
      expect(screen.getByRole('pageCount')).toHaveTextContent('');
    });

    // 手动改变一下接口数据，让刷新后能看出效果
    setMockListData(data => {
      data.splice(0, 1, 100);
      return data;
    });

    fireEvent.click(screen.getByRole('reload1'));
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 1, 2, 3]));
    });

    fireEvent.click(screen.getByRole('addPage'));
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(4);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 1, 2, 3, 4, 5, 6, 7]));
    });

    fireEvent.click(screen.getByRole('reload1'));
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(5);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([100, 1, 2, 3]));
    });
  });

  test("load more mode paginated data don't need to preload when go to last page", async () => {
    const alovaInst = createMockAlova();
    const getter = (page: number, pageSize: number) =>
      alovaInst.Get<ListResponse>('/list-short', {
        params: {
          page,
          pageSize
        }
      });

    const fetchMockFn = jest.fn();
    function Page() {
      const {
        data,
        loading,
        pageCount,
        total,
        page: [page, setPage],
        pageSize: [pageSize],
        isLastPage,
        onFetchSuccess
      } = usePagination(getter, {
        total: () => undefined,
        data: res => res.list,
        append: true,
        initialPage: 2,
        initialPageSize: 4
      });
      onFetchSuccess(fetchMockFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <span role="page">{page}</span>
          <span role="pageSize">{pageSize}</span>
          <span role="pageCount">{pageCount}</span>
          <span role="total">{total}</span>
          <span role="isLastPage">{JSON.stringify(isLastPage)}</span>
          <span role="response">{JSON.stringify(data)}</span>
          <button
            role="addPage"
            onClick={() => setPage(v => v + 1)}>
            btn1
          </button>
          <button
            role="subtractPage"
            onClick={() => setPage(v => v - 1)}>
            btn2
          </button>
          <button
            role="toLastPage"
            onClick={() => setPage(v => v + 2)}>
            btn1
          </button>
        </div>
      );
    }
    render((<Page />) as ReactElement<any, any>);
    let page = 2,
      pageSize = 4;
    // 等待fetch完成
    await waitFor(() => {
      expect(fetchMockFn).toBeCalledTimes(2);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify([4, 5, 6, 7]));
    });

    fireEvent.click(screen.getByRole('addPage'));
    page++;
    await waitFor(() => {
      // 已经到最后一页了，不需要再预加载下一页数据了
      expect(fetchMockFn).toBeCalledTimes(3);
      expect(screen.getByRole('response')).toHaveTextContent(JSON.stringify(generateContinuousNumbers(9, 4)));
      expect(queryCache(getter(page + 1, pageSize))).toBeUndefined();
    });
  });
});
