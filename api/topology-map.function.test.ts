const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

import topologyMapFunction from './topology-map.function';

describe('topology-map.function', () => {
  it('should return an object with a message property', async () => {
    // An example of how to overwrite the implementation of fetch within a test.
    fetchMock.mockImplementationOnce(() => {
      throw new Error('fetch should not be called in this function');
    });
    const result = await topologyMapFunction();
    expect(result).toEqual('Hello world');
    expect(fetchMock).not.toHaveBeenCalled();
    expect.assertions(2);
  });
});
