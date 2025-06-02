import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import Transfile from '../components/transfile.vue';

// Mock WebRTC APIs and other dependencies
const mockRTCPeerConnection = vi.fn(
  (): Partial<RTCPeerConnection> => ({
    createOffer: vi.fn(() => Promise.resolve({ sdp: 'mockOfferSdp' })),
    setLocalDescription: vi.fn(() => Promise.resolve()),
    setRemoteDescription: vi.fn(() => Promise.resolve()),
    addIceCandidate: vi.fn(() => Promise.resolve()),
    createDataChannel: vi.fn(() => ({
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn(),
      readyState: 'open',
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
    })),
    getStats: vi.fn(() =>
      Promise.resolve({
        forEach: vi.fn((callback) => {
          callback({
            type: 'candidate-pair',
            state: 'succeeded',
            bytesSent: 1000,
            bytesReceived: 2000,
          });
        }),
      })
    ),
    onicecandidate: null,
    ondatachannel: null,
    oniceconnectionstatechange: null,
    onsignalingstatechange: null,
    close: vi.fn(),
  })
);

const mockFileReader = vi.fn(
  (): Partial<FileReader> => ({
    addEventListener: vi.fn(
      (
        event: string,
        callback: (event: { target: { result: ArrayBuffer } }) => void
      ) => {
        if (event === 'load') {
          // Simulate loading a small chunk
          setTimeout(
            () => callback({ target: { result: new ArrayBuffer(100) } }),
            10
          );
        }
      }
    ),
    readAsArrayBuffer: vi.fn(),
    result: new ArrayBuffer(100),
  })
);

global.RTCPeerConnection = mockRTCPeerConnection;
global.FileReader = mockFileReader;
global.File = class MockFile {
  chunks: ArrayBuffer[];
  name: string;
  size: number;
  type: string;
  constructor(chunks: ArrayBuffer[], name: string, options?: { type: string }) {
    this.chunks = chunks;
    this.name = name;
    this.size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    this.type = options?.type || '';
  }
};
global.URL = {
  createObjectURL: vi.fn(() => 'mock-object-url'),
  revokeObjectURL: vi.fn(),
};

// Mock element-plus ElMessage
const mockElMessage: { error: any } = {
  error: vi.fn(),
};

vi.mock('element-plus', () => ({
  ElMessage: mockElMessage,
}));

// Mock icon-park/vue-next components
vi.mock('@icon-park/vue-next', (): any => ({
  // eslint-disable-line @typescript-eslint/no-explicit-any
  CloseOne: vi.fn(),
  Dot: vi.fn(),
  Download: vi.fn(),
}));

// Mock js-base64 encode
vi.mock('js-base64', (): any => ({
  // eslint-disable-line @typescript-eslint/no-explicit-any
  encode: vi.fn((str: string) => `encoded_${str}`),
}));

describe('Transfile', () => {
  // Test Case 1: Component mounts correctly
  it('should mount correctly', (): void => {
    const wrapper = shallowMount(Transfile, {
      props: {
        receivedFileList: [],
        sendChannel: null,
        receiveChannel: null,
        currentTransfers: {},
        receivedFileChunks: {},
        receivedFileSizes: {},
        maxTransferData: 0,
      },
    });
    expect(wrapper.exists()).toBe(true);
  });

  // Test Case 2: handleDrop adds files to localFilesList
  it('should add files to localFilesList on drop', async (): Promise<void> => {
    const wrapper = shallowMount(Transfile, {
      props: {
        receivedFileList: [],
        sendChannel: null,
        receiveChannel: null,
        currentTransfers: {},
        receivedFileChunks: {},
        receivedFileSizes: {},
        maxTransferData: 0,
      },
    });
    const mockFile = new File(
      [new TextEncoder().encode('test content').buffer],
      'test.txt',
      { type: 'text/plain' }
    );
    const mockEvent = {
      dataTransfer: { files: [mockFile as any] },
    } as DragEvent; // eslint-disable-line @typescript-eslint/no-explicit-any
    await wrapper.vm.handleDrop(mockEvent);
    expect(wrapper.vm.localFilesList.length).toBe(1);
    expect(wrapper.vm.localFilesList[0].name).toBe('test.txt');
  });

  // Test Case 3: sendData initiates file transfer when channel is open
  it('should initiate file transfer when sendData is called and channel is open', async (): Promise<void> => {
    const mockSendChannel: Partial<RTCDataChannel> = {
      readyState: 'open',
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 113246208,
      send: vi.fn(),
      onbufferedamountlow: null,
    };
    const wrapper = shallowMount(Transfile, {
      props: {
        receivedFileList: [],
        sendChannel: mockSendChannel,
        receiveChannel: null,
        currentTransfers: {},
        receivedFileChunks: {},
        receivedFileSizes: {},
        maxTransferData: 0,
      },
    });
    const mockFile = new File([new ArrayBuffer(500)], 'test.bin', {
      type: 'application/octet-stream',
    }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    wrapper.vm.localFilesList.push(mockFile);

    // Mock the FileReader load event to trigger the send logic
    mockFileReader.mockImplementationOnce(() => ({
      addEventListener: vi.fn(
        (
          event: string,
          callback: (event: { target: { result: ArrayBuffer } }) => void
        ) => {
          if (event === 'load') {
            // Simulate loading a chunk
            setTimeout(
              () => callback({ target: { result: new ArrayBuffer(100) } }),
              10
            );
          }
        }
      ),
      readAsArrayBuffer: vi.fn(),
      result: new ArrayBuffer(100),
    }));

    await wrapper.vm.sendData();

    // Expect sendChannel.send to be called at least once (for the chunk info and the chunk)
    // The exact number of calls depends on chunking logic, but at least one chunk should be processed.
    // We can check if the fileReader was used to read the file.
    expect(mockFileReader).toHaveBeenCalled();
    expect(mockSendChannel.send).toHaveBeenCalled();
  });

  // Test Case 4: onReceiveChannelMessageCallback handles chunk info and data
  it('should handle received chunk info and data', async (): Promise<void> => {
    const wrapper = shallowMount(Transfile, {
      props: {
        receivedFileList: [],
        sendChannel: null,
        receiveChannel: null,
        currentTransfers: {},
        receivedFileChunks: {},
        receivedFileSizes: {},
        maxTransferData: 0,
      },
    });

    const fileInfo: { name: string; size: number; type: string } = {
      name: 'received.bin',
      size: 200,
      type: 'application/octet-stream',
    };
    const transferId = fileInfo.name;

    // Simulate receiving chunk info
    const chunkInfo = JSON.stringify({
      type: 'chunk-info',
      transferId: transferId,
      offset: 100,
      size: 100,
      fileInfo,
    });
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: chunkInfo,
    } as MessageEvent);

    // Check if received file info is stored
    expect(wrapper.vm.haveRecievedFile[transferId]).toBeDefined();
    expect(wrapper.vm.haveRecievedFile[transferId].status).toBe('receiving');
    expect(wrapper.vm.receivedFileList.length).toBe(1);

    // Simulate receiving data chunk
    const dataChunk = new ArrayBuffer(100);
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: dataChunk,
    } as MessageEvent);

    // Check if data chunk is stored and size/progress updated
    expect(wrapper.vm.receivedFileChunks[transferId].length).toBe(1);
    expect(wrapper.vm.receivedFileSizes[transferId]).toBe(100);
    // Simulate receiving first chunk info
    const firstChunkInfo = JSON.stringify({
      type: 'chunk-info',
      transferId: transferId,
      offset: 0,
      size: 100,
      fileInfo,
    });
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: firstChunkInfo,
    } as MessageEvent);

    // Simulate receiving first data chunk
    const firstDataChunk = new ArrayBuffer(100);
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: firstDataChunk,
    } as MessageEvent);

    // Check if data chunk is stored and size/progress updated
    expect(wrapper.vm.receivedFileChunks[transferId].length).toBe(1);
    expect(wrapper.vm.receivedFileSizes[transferId]).toBe(100);
    // Progress should be updated after receiving the data chunk
    expect(wrapper.vm.haveRecievedFile[transferId].progress).toBe(50); // (100 / 200) * 100

    // Simulate receiving second chunk info
    const secondChunkInfo = JSON.stringify({
      type: 'chunk-info',
      transferId: transferId,
      offset: 100,
      size: 100,
      fileInfo,
    });
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: secondChunkInfo,
    } as MessageEvent);

    // Simulate receiving second data chunk
    const secondDataChunk = new ArrayBuffer(100);
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: secondDataChunk,
    } as MessageEvent);

    // Check if data chunk is stored and size/progress updated
    expect(wrapper.vm.receivedFileChunks[transferId].length).toBe(2);
    expect(wrapper.vm.receivedFileSizes[transferId]).toBe(200);
    // Progress should be updated after receiving the data chunk
    expect(wrapper.vm.haveRecievedFile[transferId].progress).toBe(100); // (200 / 200) * 100

    // Check if file is marked as completed and receivedFile is created
    expect(wrapper.vm.haveRecievedFile[transferId].status).toBe('completed');
    expect(
      wrapper.vm.receivedFileList.find((file) => file.name === transferId)
        .receivedFile
    ).toBeInstanceOf(File);
  });

  // Test Case 5: handleDeleteFile removes file from localFilesList
  it('should remove file from localFilesList on handleDeleteFile', (): void => {
    const wrapper = shallowMount(Transfile, {
      props: {
        receivedFileList: [],
        sendChannel: null,
        receiveChannel: null,
        currentTransfers: {},
        receivedFileChunks: {},
        receivedFileSizes: {},
        maxTransferData: 0,
      },
    });
    const mockFile1 = new File(
      [new TextEncoder().encode('content1').buffer],
      'file1.txt',
      { type: 'text/plain' }
    );
    const mockFile2 = new File(
      [new TextEncoder().encode('content2').buffer],
      'file2.txt',
      { type: 'text/plain' }
    );
    wrapper.vm.localFilesList.push(mockFile1, mockFile2);

    wrapper.vm.handleDeleteFile(0);

    expect(wrapper.vm.localFilesList.length).toBe(1);
    expect(wrapper.vm.localFilesList[0].name).toBe('file2.txt');
  });
});
