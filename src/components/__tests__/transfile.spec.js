import { describe, beforeEach, it, vi, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TransFile from '../transfile.vue';

describe('transfile.vue', () => {
    let wrapper;

    beforeEach(() => {
        wrapper = mount(TransFile, {
            props: {
                receivedFileList: [],
                sendChannel: { readyState: 'open' },
                receiveChannel: { readyState: 'open' },
                currentTransfers: {},
                receivedFileChunks: {},
                receivedFileSizes: {}
            }
        });
    });

    it('should add files to localFilesList when selectFile is called', async () => {
        const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });

        // Mock file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        fileInput.files = [mockFile];
        document.body.appendChild(fileInput);

        await wrapper.vm.selectFile();

        expect(wrapper.vm.localFilesList).toHaveLength(1);
        expect(wrapper.vm.localFilesList[0].name).toBe('test.txt');
    });

    it('should handle file drop event correctly', async () => {
        const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
        const event = {
            dataTransfer: {
                files: [mockFile]
            },
            preventDefault: vi.fn()
        };

        await wrapper.vm.handleDrop(event);

        expect(wrapper.vm.localFilesList).toHaveLength(1);
        expect(wrapper.vm.localFilesList[0].name).toBe('test.txt');
    });

    it('should update progress when sending file', async () => {
        const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
        wrapper.vm.localFilesList = [{ name: 'test.txt', size: 100 }];

        // Mock sendChannel
        const mockSendChannel = {
            readyState: 'open',
            send: vi.fn()
        };

        await wrapper.setProps({ sendChannel: mockSendChannel });
        await wrapper.vm.sendData();

        expect(mockSendChannel.send).toHaveBeenCalled();
        expect(wrapper.vm.currentTransfersInner['test.txt'].progress).toBeGreaterThan(0);
    });

    it('should handle received file chunks correctly', async () => {
        const mockFileInfo = {
            type: 'file-info',
            transferId: 'test-file',
            data: { name: 'test.txt', size: 100, type: 'text/plain' },
            uploadedSize: 0
        };

        const mockChunkInfo = {
            type: 'chunk-info',
            transferId: 'test-file',
            offset: 0,
            size: 50
        };

        const mockChunkData = new ArrayBuffer(50);

        // Handle file info
        await wrapper.vm.onReceiveChannelMessageCallback({ data: JSON.stringify(mockFileInfo) });

        // Handle chunk info
        await wrapper.vm.onReceiveChannelMessageCallback({ data: JSON.stringify(mockChunkInfo) });

        // Handle chunk data
        await wrapper.vm.onReceiveChannelMessageCallback({ data: mockChunkData });

        expect(wrapper.vm.currentTransfersInner['test.txt'].progress).toBe(50);
    });
});