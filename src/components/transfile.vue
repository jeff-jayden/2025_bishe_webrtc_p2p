<template>
  <div
    class="transfer-file"
    @drop.prevent="handleDrop"
    @dragenter.prevent
    @dragover.prevent
  >
    <div class="file-area">
      <div class="file-container">
        <div class="has-container">
          <div class="has-send">已发送文件</div>
          <div class="file-list">
            <div
              v-for="(file, index) in localFilesList"
              :key="index"
              class="file-item"
            >
              <div class="file-name">{{ getFileName(file.name) }}</div>
              <div class="file-details">
                <el-button
                  class="btn"
                  v-if="haveTransedFile[file.name]?.status === 'completed'"
                  type="primary"
                  @click="handlePreview(file.name)"
                  >预览</el-button
                >
                <div class="size">
                  <span>{{ (file.size / 1000 / 1000).toFixed(2) }} MB</span>
                </div>
                <el-progress
                  :percentage="haveTransedFile[file.name]?.progress"
                  class="progress"
                />
                <div
                  v-if="
                    haveTransedFile[file.name]?.status !== 'completed' &&
                    haveTransedFile[file.name]?.status !== 'transferring'
                  "
                  class="delete_btn"
                  @click="handleDeleteFile(index)"
                >
                  <el-tooltip content="删除" placement="top"
                    ><close-one class="close" theme="outline" size="16"
                  /></el-tooltip>
                </div>
                <div
                  v-if="haveTransedFile[file.name]?.status === 'completed'"
                  class="has_completed"
                >
                  <span class="txt">已发送</span>
                </div>
                <div
                  v-if="haveTransedFile[file.name]?.status === 'transferring'"
                  class="cancel_btn"
                  @click="handleCancelTransfer(file.name)"
                >
                  <el-button type="danger" size="small">取消</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="receive-container">
          <div class="has-receive">已收到文件</div>
          <div class="file-list">
            <div
              v-for="(file, index) in receivedFileList"
              :key="index"
              class="file-item"
            >
              <div class="file-name">
                {{ getFileName(file.name) }}
              </div>
              <div class="file-details">
                <el-button
                  class="btn"
                  v-if="haveRecievedFile[file.name]?.status === 'completed'"
                  type="primary"
                  @click="handlePreview(file.name)"
                  >预览</el-button
                >
                <el-progress
                  :percentage="haveRecievedFile[file.name]?.progress"
                  class="progress"
                />
                <div class="size">
                  {{ (file.fileInfo.size / 1000 / 1000).toFixed(2) }} KB
                </div>
                <div class="link_area" v-if="file.receivedFile">
                  <a
                    :href="URL.createObjectURL(file.receivedFile)"
                    :download="file.name"
                  >
                    <download
                      theme="outline"
                      size="16"
                      :strokeWidth="3"
                      class="link"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="bottom">
        <el-button
          type="primary"
          class="btn"
          @click="sendData"
          :disabled="localFilesList.length === 0"
        >
          发送
        </el-button>
        <div class="con-status">
          <div class="connected" v-if="con_status">
            <dot
              theme="outline"
              size="16"
              fill="#08b18f"
              :strokeWidth="3"
              class="dot"
            /><span>connected</span>
          </div>
          <div class="disconnected" v-else>
            <dot
              theme="outline"
              size="16"
              fill="#f00b25"
              :strokeWidth="3"
              class="dot"
            /><span>disconnected</span>
          </div>
        </div>
        <div class="stats-box" ref="statsbox"></div>
      </div>
    </div>

    <!-- 右边区域 -->
    <div class="right_area">
      <!-- 拖放区域 -->
      <div class="drop-area" @click="selectFile">
        <div class="drop-content">
          <p>点击添加文件或将文件（夹）拖放到这里（单次可发8个文件）</p>
        </div>
      </div>
      <div class="bottom-area">
        <div class="box">
          <canvas
            class="bitrateCanvas"
            id="bitrateCanvas"
            ref="bitrateCanvas"
          ></canvas>
          <div v-if="con_status">
            maxSpeed: {{ (maxTransferData / 1000 / 1000).toFixed(2) }} MB/s
            realTimeRate: {{ (realTimeRate / 1000 / 1000).toFixed(2) }} MB/s
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CloseOne, Dot, Download } from '@icon-park/vue-next';
import { ref, onMounted, type Ref, onUnmounted } from 'vue';

// Define interfaces for props and refs
interface FileTransferStatus {
  status:
    | 'pending'
    | 'transferring'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | string; // Added string for flexibility if other statuses exist
  progress: number;
}

interface ReceivedFileListItem {
  name: string;
  fileInfo: { size: number; type: string };
  receivedFile?: File | Blob; // Can be File or Blob
  // Add other properties if they exist in receivedFileList items
}

interface FileReaderItem extends FileReader {}

import { encode } from 'js-base64';
import { ElMessage } from 'element-plus';
import { encryptData, decryptData } from '@/utils/crypto';

// 获取URL对象，用于创建文件下载链接
const URL = window.URL || window.webkitURL;
const ALIST_DONMAIN = 'http://192.168.31.201:5244';
const MINIO_DONMAIN = 'http://192.168.31.201:9000';

const con_status: Ref<boolean> = ref(false);
// 存放的是单独的要发送的完整文件
const transferQueue: Ref<File[]> = ref([]);
// 用于存放当前分块的信息
const message: Ref<any> = ref(); // To be refined later if possible
const fileReaders: Ref<Record<string, FileReaderItem>> = ref({});
const localFilesList: Ref<File[]> = ref([]);
const maxParallelTransfers = 8; // 最大并行传输数量
const haveTransedFile: Ref<Record<string, FileTransferStatus>> = ref({});
const haveRecievedFile: Ref<Record<string, FileTransferStatus>> = ref({});
const alistToken: Ref<string> = ref('');
const statsbox: Ref<HTMLElement | null> = ref(null);
const bitrateCanvas: Ref<HTMLCanvasElement | null> = ref(null);

const props = defineProps<{
  receivedFileList: ReceivedFileListItem[];
  sendChannel: RTCDataChannel | null;
  receiveChannel: RTCDataChannel | null;
  currentTransfers: Record<string, any>; // To be refined if structure is known
  receivedFileChunks: Record<string, ArrayBuffer[]>;
  receivedFileSizes: Record<string, number>;
  maxTransferData: number;
  realTimeRate: number;
}>();

const emit = defineEmits(['closeChannel']);

const getFileList = (): void => {
  var myHeaders = new Headers();
  myHeaders.append('Authorization', alistToken.value);
  myHeaders.append('Content-Type', 'application/json');

  var raw = JSON.stringify({
    path: '/root',
    password: '',
    page: 1,
    per_page: 0,
    refresh: false,
  });

  var requestOptions: RequestInit = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow',
  };

  fetch(`${ALIST_DONMAIN}/api/fs/list`, requestOptions)
    .then((response: Response) => response.text())
    .then((result: string) => console.log(result))
    .catch((error: any) => console.log('error', error));
};

const getMyInfo = (): void => {
  var myHeaders = new Headers();
  myHeaders.append('Authorization', alistToken.value);
  fetch(`${ALIST_DONMAIN}/api/me`, { headers: myHeaders })
    .then((response: Response) => response.text())
    .then((result: string) => console.log(result))
    .catch((error: any) => console.log('error', error));
};

// 获取 AList 的认证 token
const getAlistToken = async (): Promise<void> => {
  // 创建一个新的 Headers 对象，用于设置请求头
  var myHeaders = new Headers();
  // 设置 Content-Type 请求头为 application/json，表示请求体是 JSON 格式
  myHeaders.append('Content-Type', 'application/json');

  // 构建请求体，包含用户名和密码
  var raw = JSON.stringify({
    username: 'admin',
    password: 'admin',
  });

  // 构建请求选项对象
  var requestOptions: RequestInit = {
    method: 'POST', // 请求方法为 POST
    headers: myHeaders, // 设置请求头
    body: raw, // 设置请求体
    redirect: 'follow', // 设置重定向模式为 follow
  };

  // 发起 fetch 请求到 AList 的登录 API
  fetch(`${ALIST_DONMAIN}/api/auth/login`, requestOptions)
    // 处理响应，将其转换为文本
    .then((response: Response) => response.text())
    // 处理文本结果，解析 JSON 并提取 token
    .then((resultString: string) => {
      let result = JSON.parse(resultString);
      result = JSON.parse(result);
      console.log('getAlistToken', result);
      // 将获取到的 token 赋值给 alistToken 的 ref
      alistToken.value = result.data.token;
    })
    // 捕获并处理请求过程中发生的错误
    .catch((error: any) => console.log('error', error));
};

// 定义处理上传文件到 AList 的函数，接收文件信息和文件数据
const handleUpload2Alist = (
  fileInfo: { name: string; type: string },
  data: ArrayBuffer
): void => {
  // 创建一个新的 Headers 对象，用于设置请求头
  var myHeaders = new Headers();
  // 添加 Authorization 请求头，使用 alistToken 进行认证
  myHeaders.append('Authorization', alistToken.value);
  // 添加 File-Path 请求头，指定文件在 AList 中的存放路径，对文件名进行编码
  myHeaders.append('File-Path', `/root/${encodeURIComponent(fileInfo.name)}`);
  // 添加 As-Task 请求头，指示 AList 将上传作为任务处理
  myHeaders.append('As-Task', 'true');
  // 添加 Content-Length 请求头，这里留空，fetch 会自动设置
  myHeaders.append('Content-Length', '');
  // 添加 Content-Type 请求头，指定文件类型为二进制流
  myHeaders.append('Content-Type', 'application/octet-stream');

  // 使用接收到的数据创建一个新的 File 对象
  const file = new File([data], fileInfo.name, { type: fileInfo.type });

  // 构建请求选项对象
  var requestOptions: RequestInit = {
    method: 'PUT', // 请求方法为 PUT，用于上传文件
    headers: myHeaders, // 设置请求头
    body: file, // 设置请求体为文件数据
    redirect: 'follow', // 设置重定向模式为 follow
  };

  // 打印 token 值（用于调试）
  console.log('token', alistToken.value);

  // 发起 fetch 请求到 AList 的文件上传 API
  fetch(`${ALIST_DONMAIN}/api/fs/put`, requestOptions)
    // 处理响应，将其转换为文本
    .then((response: Response) => response.text())
    // 处理文本结果，打印上传结果（用于调试）
    .then((result) => console.log('fsresult', result))
    // 捕获并处理请求过程中发生的错误
    .catch((error: any) => console.log('error', error));
};

const handlePreview = (fileName: string): void => {
  // 构建要预览文件的完整访问 URL，这里使用了 MINIO_DONMAIN 和文件路径
  var url = `${MINIO_DONMAIN}/miniodemo/root/${fileName}`; //要预览文件的访问地址
  // 打开一个新的浏览器窗口或标签页来在线预览文件
  // 使用 encodeURIComponent 和 encode 对 URL 进行编码，以确保特殊字符正确处理
  window.open(
    'http://127.0.0.1:8012/onlinePreview?url=' + encodeURIComponent(encode(url))
  );
};

// 接收文件处理函数
async function onReceiveChannelMessageCallback(
  event: MessageEvent
): Promise<void> {
  console.log('Received Message');

  let data: any = event.data; // Consider more specific type if possible

  if (typeof data === 'string' && data.startsWith('{')) {
    try {
      message.value = JSON.parse(data);

      // 这是一个数据块的元信息，下一个消息将是实际数据
      const {
        transferId,
        offset,
        size,
        fileInfo,
      }: {
        transferId: string;
        offset: number;
        size: number;
        fileInfo: { name: string; type: string; size: number };
      } = message.value;
      const { name }: { name: string } = fileInfo;
      if (!haveRecievedFile.value[transferId]) {
        // 保存已收到文件信息
        const receiveFileInfo: FileTransferStatus = {
          currentChunkOffset: offset || 0,
          currentChunkSize: size,
          status: 'receiving',
          fileInfo,
          name,
          progress: 0,
        };
        haveRecievedFile.value[transferId] = receiveFileInfo;
        props.receivedFileList.push(receiveFileInfo);
      }
      haveRecievedFile.value[transferId].currentChunkOffset = offset;
      haveRecievedFile.value[transferId].currentChunkSize = size;
    } catch (e) {
      console.error('Error parsing message:', e);
    }
    return;
  }

  // 二进制数据块
  // 查找当前正在接收的传输文件名
  const activeTransferId: string | undefined = Object.keys(
    haveRecievedFile.value
  ).find(
    (id) =>
      haveRecievedFile.value[id].status === 'receiving' &&
      id === message.value.transferId
  );

  if (activeTransferId) {
    const transfer = haveRecievedFile.value[activeTransferId];

    // 添加数据块到对应的文件
    if (!props.receivedFileChunks[activeTransferId]) {
      props.receivedFileChunks[activeTransferId] = [];
    }
    // 解密数据块
    data = await decryptData(data);
    props.receivedFileChunks[activeTransferId].push(data);

    // 更新已接收大小
    if (!props.receivedFileSizes[activeTransferId]) {
      props.receivedFileSizes[activeTransferId] = 0;
    }
    props.receivedFileSizes[activeTransferId] += data.byteLength;

    // 更新进度
    transfer.progress = Math.ceil(
      (transfer.currentChunkOffset / transfer.fileInfo.size) * 100
    );

    // 检查文件是否接收完成
    if (transfer.currentChunkOffset === transfer.fileInfo.size) {
      // 创建完整文件
      const receivedFile = new File(
        props.receivedFileChunks[activeTransferId],
        transfer.fileInfo.name,
        { type: transfer.fileInfo.type }
      );

      props.receivedFileList.find(
        (file) => file.name === activeTransferId
      ).receivedFile = receivedFile;

      // 清理资源
      transfer.status = 'completed';
      delete transfer.currentChunkOffset;
      delete transfer.currentChunkSize;

      setTimeout(() => {
        delete props.receivedFileChunks[activeTransferId];
        delete props.receivedFileSizes[activeTransferId];
        delete props.currentTransfers[activeTransferId];
      }, 100);
    }
  }
}

// 发送通道消息处理函数
function onSendChannelMessageCallback(event: MessageEvent): void {
  // 使用相同的处理逻辑处理发送通道上的消息
  onReceiveChannelMessageCallback(event);
}

// 用于表示连接断开是不是自己触发的
const isSelf = ref(false);

// 发送通道状态变化处理函数
function onSendChannelStateChange(): void {
  if (!props.sendChannel) return;

  const readyState = props.sendChannel.readyState;
  console.log(`Send channel state is: ${readyState}`);

  // 当通道打开时，设置缓冲区阈值和事件处理
  if (readyState === 'open') {
    props.sendChannel.bufferedAmountLowThreshold = 16777216; // 16MB 104857600
    // 监控缓冲区状态
    const monitorBufferedAmount = () => {
      if (props.sendChannel && props.sendChannel.readyState === 'open') {
        const bufferedAmount = props.sendChannel.bufferedAmount;
        if (bufferedAmount > 16777216) {
          // 16MB
          console.log(
            `发送通道缓冲区较大: ${(bufferedAmount / 16777216).toFixed(2)}MB`
          );
          setTimeout(monitorBufferedAmount, 2000);
        }
      }
    };
    monitorBufferedAmount();
    return;
  }

  con_status.value = false;

  if (!con_status.value && !isSelf.value) {
    console.log('sendChannel');

    ElMessage.error('对方连接断开，请重试！');
    stopSendData();
  }
}

// 接收通道状态变化处理函数
function onReceiveChannelStateChange(): void {
  if (!props.receiveChannel) return;

  const readyState = props.receiveChannel.readyState;
  console.log(`Receive channel state is: ${readyState}`);

  // 当通道打开时，设置缓冲区阈值和事件处理
  if (readyState === 'open') {
    props.receiveChannel.bufferedAmountLowThreshold = 16777216; // 16MB
    // 监控缓冲区状态
    const monitorBufferedAmount = () => {
      if (props.receiveChannel && props.receiveChannel.readyState === 'open') {
        const bufferedAmount = props.receiveChannel.bufferedAmount;
        if (bufferedAmount > 16777216) {
          // 16MB
          console.log(
            `接收通道缓冲区较大: ${(bufferedAmount / 16777216).toFixed(2)}MB`
          );
        }
        setTimeout(monitorBufferedAmount, 2000);
      }
    };
    monitorBufferedAmount();
    return;
  }

  con_status.value = false;
  if (!con_status.value && !isSelf.value) {
    console.log('receiveChannel');
    ElMessage.error('对方连接断开，请重试！');
    stopSendData();
  }
}

const stopSendData = (): void => {
  if (sendData.length) sendQueue = [];
  transferQueue.value = [];
};

// 处理取消传输的函数
const handleCancelTransfer = (fileName: string): void => {
  console.log(`Cancelling transfer for file: ${fileName}`);
  // 查找对应的 FileReader
  const fileReader = fileReaders.value[fileName];
  if (fileReader) {
    // 中断文件读取
    fileReader.abort();
    console.log(`File reading aborted for ${fileName}`);
  }

  // 更新文件状态为 cancelled
  if (haveTransedFile.value[fileName]) {
    haveTransedFile.value[fileName].status = 'cancelled';
    // haveTransedFile.value[fileName].progress = 0; // Reset progress
    console.log(`Transfer status updated to cancelled for ${fileName}`);
  }

  // 从传输队列和当前传输列表中移除文件
  transferQueue.value = transferQueue.value.filter(
    (file) => file.name !== fileName
  );
  if (props.currentTransfers[fileName]) {
    delete props.currentTransfers[fileName];
    console.log(`Removed ${fileName} from currentTransfers`);
  }

  // TODO: Optionally send a cancellation message to the peer
};

const handleSendFn = async (
  channel: RTCDataChannel | null,
  fileInfo: { name: string; type: string; size: number },
  data: File,
  uploadedSize: number = 0
): Promise<void> => {
  // 生成唯一的传输ID
  const transferId = `${fileInfo.name}`;

  // 发送文件信息，包含传输ID和加密标志
  console.log('channel', channel);

  // 记录当前传输
  const info: FileTransferStatus = {
    id: transferId,
    file: data,
    progress: 0,
    status: 'transferring',
    uploadedSize: uploadedSize,
  };

  // 设置已经传送的文件信息
  haveTransedFile.value[transferId] = info;
  // ???
  props.currentTransfers[transferId] = info;

  const chunkSize = 131072; // 187KB
  // 每次发送一个完整都会重置
  fileReaders.value[transferId] = new FileReader();
  let offset = 0;

  // 添加缓冲区控制标志
  let sendingInProgress = false;

  // 创建文件碎片发送队列
  let sendQueue: (string | ArrayBuffer)[] = [];

  // 设置缓冲区阈值
  channel.bufferedAmountLowThreshold = 113246208; // 12MB

  // 处理发送队列的函数
  const processSendQueue = (): void => {
    // 如果正在发送或者发送完结 结束发送逻辑
    if (sendingInProgress || sendQueue.length === 0) {
      return;
    }

    // 检查通道缓冲区状态
    if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
      // 如果缓冲区较满，等待 onbufferedamountlow 事件
      console.log(
        `发送通道缓冲区较大，等待: ${(
          channel.bufferedAmount / 113246208
        ).toFixed(2)}MB`
      );
      return; // Stop processing the queue until bufferedAmountLow fires
    }

    sendingInProgress = true;
    const item: string | ArrayBuffer | undefined = sendQueue.shift();

    try {
      // 发送文件
      channel.send(item);
      // 发送完成后处理下一个
      sendingInProgress = false;
      // Immediately try to process the next item if buffer allows
      processSendQueue();
    } catch (error) {
      console.error('发送数据出错:', error);
      // 如果已经断开连接，直接返回
      if (!con_status.value) return;

      // 出错时重新加入队列稍后重试
      sendQueue.unshift(item);
      sendingInProgress = false;
      setTimeout(processSendQueue, 200); // Retry after a short delay
    }
  };

  // 当缓冲区低于阈值时继续发送
  channel.onbufferedamountlow = processSendQueue;

  // 添加数据到发送队列
  const queueDataForSend = (data: string | ArrayBuffer): void => {
    sendQueue.push(data);
    // Start processing the queue if not already in progress
    if (!sendingInProgress) {
      processSendQueue();
    }
  };

  fileReaders.value[transferId].addEventListener('error', (error: Event) =>
    console.error(`Error reading file ${transferId}:`, error)
  );

  fileReaders.value[transferId].addEventListener('abort', (event: Event) =>
    console.log(`File reading aborted ${transferId}:`, event)
  );

  fileReaders.value[transferId].addEventListener(
    'load',
    async (e: ProgressEvent<FileReader>) => {
      if (!con_status.value) return;

      // 应该在发送前将offset设置
      offset += (e.target?.result as ArrayBuffer).byteLength;

      // 准备元数据
      const chunkInfo = JSON.stringify({
        type: 'chunk-info',
        transferId: transferId,
        offset: offset,
        size: (e.target?.result as ArrayBuffer).byteLength,
        fileInfo,
      });

      // 加密数据块 webrtc自带文件加密 使用 DTLS握手阶段的加密算法 SRTP数据传输阶段的加密算法
      const encryptedChunk = await encryptData(e.target?.result as ArrayBuffer);

      // 将元数据和实际数据添加到发送队列
      queueDataForSend(chunkInfo);
      queueDataForSend(encryptedChunk);

      // 更新进度
      haveTransedFile.value[transferId].progress = Math.floor(
        (offset / data.size) * 100
      );
      haveTransedFile.value[transferId].uploadedSize = offset;

      if (offset < data.size) {
        // Read the next slice immediately after the current one is loaded
        readSlice(offset);
        return;
      }
      // 如果分片小于设置的分片大小，此时就回直接走这里，都没发送  不对只要加载完成就回放到对列发送

      // 传输完成
      console.log('传输完成');

      // 传输完成，上传至alist
      handleUpload2Alist(fileInfo, data);
      haveTransedFile.value[transferId].status = 'completed';

      setTimeout(() => {
        delete fileReaders.value[transferId];
        delete props.currentTransfers[transferId];

        // 检查队列中是否有等待的文件
        processNextInQueue();
      }, 100);
    }
  );

  const readSlice = (o: number): void => {
    const slice = data.slice(offset, o + chunkSize);
    fileReaders.value[transferId].readAsArrayBuffer(slice);
  };

  readSlice(uploadedSize);
};

/**
 * 并发发送文件，还是需要通过创建多个 fileReader 来实现并发发送,光靠一个来不及，不过也可以通过
 * 并发限制传输任务，在传输单个任务的时候切片，确保完成再启动一下个，然后中间可能会出现发送太快的
 * 情况，可以也搞一个缓存队列，搞个缓存区去判断执行是不是要发送碎片
 */
// 处理发送文件功能
function sendData(): void {
  // 传输前检查通道状态
  const channel = props.sendChannel ? props.sendChannel : props.receiveChannel;
  if (!channel || channel.readyState !== 'open') {
    console.error('数据通道未打开，无法发送文件');
    return;
  }

  // 清空传输队列
  transferQueue.value = [];

  // 获取要发送的文件列表 已经发送过的就不用发了
  const filesToSend: File[] = [...localFilesList.value].filter((file: File) => {
    if (haveTransedFile.value[file.name]?.status !== 'completed') {
      return file;
    }
  });
  // 限制初始批次大小，避免一次性发送过多文件
  const initialBatchSize = Math.min(maxParallelTransfers, filesToSend.length);

  // 先发送初始批次
  for (let i = 0; i < initialBatchSize; i++) {
    const item: any = filesToSend[i]; // Consider a more specific type if possible
    const data: File = item.file;
    const uploadedSize = item.uploadedSize || 0; // 获取已上传大小
    const fileInfo: { name: string; size: number; type: string; data: File } = {
      name: item.name,
      size: item.size,
      type: item.type,
      data: item.file,
    };

    // 开始传输
    handleSendFn(channel, fileInfo, data, uploadedSize);
  }

  // 将剩余文件添加到队列
  for (let i = initialBatchSize; i < filesToSend.length; i++) {
    const item: any = filesToSend[i]; // Consider a more specific type if possible
    transferQueue.value.push({
      channel,
      fileInfo: {
        name: item.name,
        size: item.size,
        type: item.type,
        data: item.file as File, // Type assertion
      },
      data: item.file as File, // Type assertion
      uploadedSize: item.uploadedSize || 0,
    } as any); // Consider defining a specific type for queue items
  }

  // 显示队列状态 提示下
  if (transferQueue.value.length > 0) {
    console.log(
      `已将 ${transferQueue.value.length} 个文件加入发送队列，将在当前传输完成后依次发送`
    );
  }
}

// 处理传输队列
const processNextInQueue = () => {
  // 计算当前活跃传输数量
  const activeTransfers = Object.keys(props.currentTransfers).length;

  // 如果有等待的传输且未达到最大并行数
  while (
    transferQueue.value.length > 0 &&
    activeTransfers < maxParallelTransfers
  ) {
    const nextTransfer: any = transferQueue.value.shift();

    if (nextTransfer) {
      const { channel, fileInfo, data, uploadedSize } = nextTransfer;
      handleSendFn(channel, fileInfo, data, uploadedSize);
    }
  }
};

// 处理文件上传逻辑
// 处理文件上传逻辑
const getFileName = (filePath: string): string => {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
};

const handleListFile = async (
  items: any[],
  isDrag: boolean = false
): Promise<void> => {
  // Consider a more specific type for items
  if (!items || items.length === 0) return;

  // items are already FileSystemEntry objects extracted in handleDrop
  const entriesToProcess = items;

  const processEntry = async (entry: any, path: string = ''): Promise<void> => {
    // Consider a more specific type for entry
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          const relativePath = path ? `${path}/${file.name}` : file.name;
          const idx = localFilesList.value.findIndex(
            (item) => item.name === relativePath
          );
          // 如果还没上传过
          if (idx === -1) {
            // 添加到本地文件列表
            localFilesList.value.push({
              name: relativePath,
              size: file.size,
              type: file.type,
              file: file, // 保存文件对象本身，以便后续发送
              fileName: file.name,
              date: new Date().toLocaleString(),
              progress: 0, // 初始化进度为0
              uploadedSize: 0, // 初始化已上传大小为0
            } as any); // Consider defining a specific type for localFilesList items
          }
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const directoryReader = entry.createReader();
      return new Promise((resolve) => {
        directoryReader.readEntries(async (entries: any[]) => {
          // Consider a more specific type for entries
          for (const subEntry of entries) {
            await processEntry(
              subEntry,
              path ? `${path}/${entry.name}` : entry.name
            );
          }
          resolve();
        });
      });
    }
  };

  // 拖拽上传的情况
  if (isDrag) {
    for (const entry of entriesToProcess) {
      await processEntry(entry);
    }
    return;
  }

  // 选择文件的情况
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) {
      await processEntry(entry);
    }
  }
};

// 拖动文件
const handleDrop = async (e: DragEvent): Promise<void> => {
  e.preventDefault();
  // 检查是否有文件被拖放
  if (e.dataTransfer && e.dataTransfer.items) {
    const items: DataTransferItemList = e.dataTransfer.items;
    const entriesToProcess: any[] = []; // Consider a more specific type for entries

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        entriesToProcess.push(entry);
      }
    }

    await handleListFile(entriesToProcess, true);
  }
};

// 选择文件
const selectFile = (): void => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;

  fileInput.onchange = (e: Event) => {
    // 对于文件选择器，直接获取文件列表
    handleListFile(
      Array.from((e.target as HTMLInputElement).files!).map((file: File) => ({
        // Added non-null assertion for files
        webkitGetAsEntry: () => ({
          isFile: true,
          name: file.name,
          file: (callback: any) => callback(file),
        }),
      }))
    );
  };

  fileInput.click();
};

// 删除文件
const handleDeleteFile = (index: number): void => {
  localFilesList.value.splice(index, 1);
};

// 清空文件列表
const clearFiles = (): void => {
  localFilesList.value = [];
  haveTransedFile.value = {};
};

const connectAlist = async (): Promise<void> => {
  await getAlistToken();
  getMyInfo();
  getFileList();
};

// 暴露方法给父组件
defineExpose({
  selectFile,
  clearFiles,
  sendData,
  onReceiveChannelMessageCallback,
  onSendChannelMessageCallback,
  onSendChannelStateChange,
  onReceiveChannelStateChange,
  statsbox,
  con_status,
  bitrateCanvas,
  isSelf,
  localFilesList,
});

// 监听通道状态变化
onMounted(() => {
  connectAlist();
});

onUnmounted(() => {
  // 关闭通道
  emit('closeChannel');
});
</script>

<style scoped lang="less">
.transfer-file {
  height: 100%;
  width: 100%;
  background: #fff;
  position: relative;
  display: flex;
  justify-content: space-between;

  .file-area {
    width: 50%;

    .file-container {
      width: 100%;

      .has-receive,
      .has-send {
        display: flex;
        justify-content: center;
      }

      .receive-container {
        .file-details {
          .link_area {
            margin-left: 5px;
            padding: 5px;
          }
          .link {
            color: #4a4a4a;

            &:hover {
              color: #23cca6;
            }
          }
        }
      }

      .file-list {
        width: 97%;
        height: 300px;
        overflow: auto;
        margin: 0 20px;

        border: 1px #fefe solid;
        padding: 5px;
        background-color: #f5f5f5;

        .file-item {
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: space-between;
          padding: 5px 8px;
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 10px;
          background-color: #fff;

          .btn {
            padding: 5px;
            height: 100%;
          }

          .file-name {
            width: fit-content;
            color: #4a4a4a;
            font-size: 14px;
            padding: 5px 8px;
            width: 295px;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;

            a {
              text-decoration: none;

              &:hover {
                cursor: pointer;
              }
            }
          }

          .file-details {
            color: #888;
            font-size: 12px;
            display: flex;

            .progress {
              width: 150px;
              margin-left: 5px;
            }

            .size {
              background-color: #fafafa;
              border: 1px solid #d9d9d9;
              padding: 0 7px;
              line-height: 20px;
              border-radius: 4px;
              display: flex;
              align-items: center;
              margin-left: 5px;
            }

            .delete_btn {
              display: flex;
              justify-content: center;
              align-items: center;
              .close {
                display: flex;
                justify-content: center;
                align-items: center;
                color: #696969;
                &:hover {
                  color: red;
                  cursor: pointer;
                }
              }
            }

            .has_completed {
              display: flex;
              align-items: center;
            }
          }
        }
      }
    }
  }

  .right_area {
    width: 50%;
    position: relative; // Add position relative for absolute positioning of the button
  }

  .drop-area:hover,
  .drop-area.drop-hover {
    border-color: #2196f3;
    background-color: rgba(33, 150, 243, 0.05);
  }

  .drop-content {
    color: #b0b0b0;
  }

  /* 拖放区域 */
  .drop-area {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px;
    background-color: #fafafa;
    border: 2px dashed #ddd;
    border-radius: 8px;
    margin: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
  }

  .bottom-area {
    height: 50%;
    width: 100%;
    display: flex;
    justify-content: space-between;
    position: relative;

    .box {
      margin: 20px 50px 50px 85px;

      .bitrateCanvas {
        width: 500px;
        height: 300px;
      }
    }
  }

  .bottom {
    height: 70px;
    margin-top: 10px;
    display: flex;
    position: relative;
    bottom: -60px;

    .btn {
      margin-left: 20px;
    }

    .con-status {
      margin-left: 5px;

      .connected,
      .disconnected {
        display: flex;

        .dot {
          margin-top: 4px;
        }
      }
    }
  }
}
</style>
