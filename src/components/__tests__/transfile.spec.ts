import { describe, beforeEach, it, vi, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TransFile from '../transfile.vue';

import { VueWrapper } from '@vue/test-utils';

describe('transfile.vue', () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    wrapper = mount(TransFile, {
      props: {
        receivedFileList: [] as any[],
        sendChannel: { readyState: 'open' } as RTCDataChannel | null,
        receiveChannel: { readyState: 'open' } as RTCDataChannel | null,
        currentTransfers: {} as Record<string, any>,
        receivedFileChunks: {} as Record<string, ArrayBuffer[]>,
        receivedFileSizes: {} as Record<string, number>,
      },
    });
  });

  it('should add files to localFilesList when selectFile is called', async (): Promise<void> => {
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });

    // Spy on document.createElement to intercept the file input creation
    const createElementSpy = vi.spyOn(document, 'createElement');
    const mockInput: HTMLInputElement = {
      type: '',
      multiple: false,
      onchange: null,
      click: vi.fn(() => {
        // Simulate the onchange event when click is called
        if (mockInput.onchange) {
          (mockInput.onchange as (event: Event) => void)({
            target: { files: [mockFile] },
          } as unknown as Event);
        }
      }),
      // Add other properties or methods if needed by the component
    } as HTMLInputElement;
    createElementSpy.mockReturnValue(mockInput);

    await wrapper.vm.selectFile();

    expect(createElementSpy).toHaveBeenCalledWith('input');
    expect(mockInput.type).toBe('file');
    expect(mockInput.multiple).toBe(true);
    expect(mockInput.click).toHaveBeenCalled();
    expect(wrapper.vm.localFilesList).toHaveLength(1);
    expect(wrapper.vm.localFilesList[0].name).toBe('test.txt');

    // Restore the original document.createElement
    createElementSpy.mockRestore();
  });

  it('should handle file drop event correctly', async (): Promise<void> => {
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    const event = {
      dataTransfer: {
        files: [mockFile as any],
      },
      preventDefault: vi.fn(),
    } as unknown as DragEvent;

    await wrapper.vm.handleDrop(event);

    expect(wrapper.vm.localFilesList).toHaveLength(1);
    expect(wrapper.vm.localFilesList[0].name).toBe('test.txt');
  });

  it('should update progress when sending file', async (): Promise<void> => {
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    wrapper.vm.localFilesList = [
      { name: 'test.txt', size: 100, file: mockFile as any },
    ];

    // Mock sendChannel
    const mockSendChannel: Partial<RTCDataChannel> = {
      readyState: 'open',
      send: vi.fn(),
    };

    await wrapper.setProps({ sendChannel: mockSendChannel as RTCDataChannel });
    await wrapper.vm.sendData();

    expect(mockSendChannel.send).toHaveBeenCalled();
    expect(
      wrapper.vm.currentTransfersInner['test.txt'].progress
    ).toBeGreaterThan(0);
  });

  it('should handle received file chunks correctly', async (): Promise<void> => {
    const mockFileInfo = {
      type: 'file-info',
      transferId: 'test-file',
      data: { name: 'test.txt', size: 100, type: 'text/plain' },
      uploadedSize: 0,
    };

    const mockChunkInfo = {
      type: 'chunk-info',
      transferId: 'test-file',
      offset: 0,
      size: 50,
    };

    const mockChunkData = new ArrayBuffer(50);

    // Handle file info
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: JSON.stringify(mockFileInfo),
    } as MessageEvent);

    // Handle chunk info
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: JSON.stringify(mockChunkInfo),
    } as MessageEvent);

    // Handle chunk data
    await wrapper.vm.onReceiveChannelMessageCallback({
      data: mockChunkData,
    } as MessageEvent);

    expect(wrapper.vm.currentTransfersInner['test.txt'].progress).toBe(50);
  });
});
