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
              <div class="file-name">{{ file.name }}</div>
              <div class="file-details">
                <el-button
                  v-if="
                    currentTransfersInner[file.name]?.status === 'completed'
                  "
                  type="primary"
                  @click="handlePreview(file.name)"
                  >预览</el-button
                >
                <div class="size">
                  <span>{{ (file.size / 1024).toFixed(2) }} KB</span>
                </div>
                <el-progress
                  :percentage="currentTransfersInner[file.name]?.progress"
                  class="progress"
                />
                <div class="delete_btn" @click="handleDeleteFile(index)">
                  <el-tooltip content="sure delete???" placement="top"
                    ><close-one class="close" theme="outline" size="16"
                  /></el-tooltip>
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
                <a :href="URL.createObjectURL(file)" :download="file.name">{{
                  file.name
                }}</a>
              </div>
              <div class="file-details">
                <div class="size">{{ (file.size / 1024).toFixed(2) }} KB</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 拖放区域 -->
      <div class="drop-area" @click="selectFile">
        <div class="drop-content">
          <p>点击添加文件或将文件（夹）拖放到这里（单次可发10个文件）</p>
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
        <div class="connected">
          <Dot
            theme="outline"
            size="16"
            fill="#08b18f"
            :strokeWidth="3"
            class="dot"
          /><span>connected</span>
        </div>
      </div>
      <div class=".stats-box" ref="statsbox"></div>
    </div>
  </div>
</template>

<script setup>
import { CloseOne, Dot } from '@icon-park/vue-next';
import { ref, onMounted } from 'vue';
import { encryptData, decryptData } from '@/utils/crypto';
import { encode } from 'js-base64';

// 获取URL对象，用于创建文件下载链接
const URL = window.URL || window.webkitURL;
const ALIST_DONMAIN = 'http://192.168.206.72:5244';
const MINIO_DONMAIN = 'http://192.168.206.72:9000';

const transferQueue = ref([]);
const fileReaders = ref({});
const localFilesList = ref([]);
const maxParallelTransfers = 3; // 最大并行传输数量
const currentTransfersInner = ref({});
const alistToken = ref('');
const statsbox = ref();

const props = defineProps({
  receivedFileList: Array,
  sendChannel: Object,
  receiveChannel: Object,
  currentTransfers: Object,
  receivedFileChunks: Object,
  receivedFileSizes: Object,
});

const getAlistToken = async () => {
  var myHeaders = new Headers();
  myHeaders.append('Content-Type', 'application/json');

  var raw = JSON.stringify({
    username: 'admin',
    password: 'admin',
  });

  var requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow',
  };

  fetch(`${ALIST_DONMAIN}/api/auth/login`, requestOptions)
    .then((response) => response.text())
    .then((result) => {
      result = JSON.parse(result);
      console.log(result);
      alistToken.value = result;
    })
    .catch((error) => console.log('error', error));
};

const handleUpload2Alist = (fileInfo, data) => {
  var myHeaders = new Headers();
  myHeaders.append('Authorization', alistToken.value);
  myHeaders.append('File-Path', `/root${encodeURIComponent(fileInfo.name)}`);
  myHeaders.append('As-Task', 'true');
  myHeaders.append('Content-Length', '');
  myHeaders.append('Content-Type', 'application/octet-stream');

  var requestOptions = {
    method: 'PUT',
    headers: myHeaders,
    body: data,
    redirect: 'follow',
  };

  fetch(`${ALIST_DONMAIN}/api/fs/put`, requestOptions)
    .then((response) => response.text())
    .then((result) => console.log(result))
    .catch((error) => console.log('error', error));
};

const handlePreview = (fileName) => {
  var url = `${MINIO_DONMAIN}/miniodemo/root/${fileName}`; //要预览文件的访问地址
  window.open(
    'http://127.0.0.1:8012/onlinePreview?url=' + encodeURIComponent(encode(url))
  );
};

// 接收文件处理函数
async function onReceiveChannelMessageCallback(event) {
  console.log('Received Message');

  const data = event.data;

  if (typeof data === 'string') {
    try {
      const message = JSON.parse(data);
      console.log('message', message);

      if (message.type === 'file-info') {
        // 新文件传输开始，初始化接收状态
        const transferId = message.transferId;
        props.receivedFileChunks[transferId] = [];
        // 从文件信息中获取已上传大小作为接收的起始大小
        props.receivedFileSizes[transferId] = message.uploadedSize || 0;

        // 保存文件信息
        props.currentTransfers[transferId] = {
          id: transferId,
          fileInfo: message.data,
          progress: Math.floor(
            (props.receivedFileSizes[transferId] / message.data.size) * 100
          ),
          status: 'receiving',
          uploadedSize: message.uploadedSize || 0, // 保存已上传大小
        };
      } else if (message.type === 'chunk-info') {
        // 这是一个数据块的元信息，下一个消息将是实际数据
        // 我们可以在这里准备接收数据块
        const transferId = message.transferId;
        props.currentTransfers[transferId].currentChunkOffset = message.offset;
        props.currentTransfers[transferId].currentChunkSize = message.size;
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  } else {
    // 二进制数据块
    // 查找当前正在接收的传输
    const activeTransferId = Object.keys(props.currentTransfers).find(
      (id) =>
        props.currentTransfers[id].status === 'receiving' &&
        props.currentTransfers[id].currentChunkOffset !== undefined
    );

    if (activeTransferId) {
      const transfer = props.currentTransfers[activeTransferId];

      // 添加数据块到对应的文件
      if (!props.receivedFileChunks[activeTransferId]) {
        props.receivedFileChunks[activeTransferId] = [];
      }

      // 解密数据块
      // const decryptedData = await decryptData(data);
      props.receivedFileChunks[activeTransferId].push(data);

      // 更新已接收大小
      if (!props.receivedFileSizes[activeTransferId]) {
        props.receivedFileSizes[activeTransferId] = 0;
      }
      props.receivedFileSizes[activeTransferId] += data.byteLength;

      // 更新进度
      transfer.progress = Math.floor(
        (props.receivedFileSizes[activeTransferId] / transfer.fileInfo.size) *
          100
      );

      // 检查文件是否接收完成
      if (
        props.receivedFileSizes[activeTransferId] === transfer.fileInfo.size
      ) {
        // 创建完整文件
        const receivedFile = new File(
          props.receivedFileChunks[activeTransferId],
          transfer.fileInfo.name,
          { type: transfer.fileInfo.type }
        );

        console.log('received file:', receivedFile);
        props.receivedFileList.push(receivedFile);

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

      // 清除当前块信息，准备接收下一个块
      delete transfer.currentChunkOffset;
      delete transfer.currentChunkSize;
    }
  }
}

// 发送通道消息处理函数
function onSendChannelMessageCallback(event) {
  // 使用相同的处理逻辑处理发送通道上的消息
  onReceiveChannelMessageCallback(event);
}

// 发送通道状态变化处理函数
function onSendChannelStateChange() {
  if (!props.sendChannel) return;

  const readyState = props.sendChannel.readyState;
  console.log(`Send channel state is: ${readyState}`);

  // 当通道打开时，设置缓冲区阈值和事件处理
  if (readyState === 'open') {
    props.sendChannel.bufferedAmountLowThreshold = 65536; // 64KB

    // 监控缓冲区状态
    const monitorBufferedAmount = () => {
      if (props.sendChannel && props.sendChannel.readyState === 'open') {
        const bufferedAmount = props.sendChannel.bufferedAmount;
        if (bufferedAmount > 1048576) {
          // 1MB
          console.log(
            `发送通道缓冲区较大: ${(bufferedAmount / 1048576).toFixed(2)}MB`
          );
        }
        setTimeout(monitorBufferedAmount, 2000);
      }
    };

    monitorBufferedAmount();
  }
}

// 接收通道状态变化处理函数
function onReceiveChannelStateChange() {
  if (!props.receiveChannel) return;

  const readyState = props.receiveChannel.readyState;
  console.log(`Receive channel state is: ${readyState}`);

  // 当通道打开时，设置缓冲区阈值和事件处理
  if (readyState === 'open') {
    props.receiveChannel.bufferedAmountLowThreshold = 65536; // 64KB

    // 监控缓冲区状态
    const monitorBufferedAmount = () => {
      if (props.receiveChannel && props.receiveChannel.readyState === 'open') {
        const bufferedAmount = props.receiveChannel.bufferedAmount;
        if (bufferedAmount > 1048576) {
          // 1MB
          console.log(
            `接收通道缓冲区较大: ${(bufferedAmount / 1048576).toFixed(2)}MB`
          );
        }
        setTimeout(monitorBufferedAmount, 2000);
      }
    };

    monitorBufferedAmount();
  }
}

const handleSendFn = async (channel, fileInfo, data, uploadedSize = 0) => {
  // 生成唯一的传输ID
  const transferId = `${fileInfo.name}`;

  // 发送文件信息，包含传输ID和加密标志
  console.log('channel', channel);

  channel.send(
    JSON.stringify({
      type: 'file-info',
      transferId: transferId,
      data: fileInfo,
      encrypted: true,
      uploadedSize: uploadedSize, // 发送已上传大小
    })
  );

  // 记录当前传输
  const info = {
    id: transferId,
    file: data,
    progress: 0,
    status: 'transferring',
    uploadedSize: uploadedSize,
  };

  currentTransfersInner.value[transferId] = info;
  props.currentTransfers[transferId] = info;

  const chunkSize = 16384;
  fileReaders.value[transferId] = new FileReader();
  let offset = 0;

  fileReaders.value[transferId].addEventListener('error', (error) =>
    console.error(`Error reading file ${transferId}:`, error)
  );

  fileReaders.value[transferId].addEventListener('abort', (event) =>
    console.log(`File reading aborted ${transferId}:`, event)
  );

  // 添加缓冲区控制标志
  let sendingInProgress = false;

  // 创建发送队列
  const sendQueue = [];

  // 处理发送队列的函数
  const processSendQueue = () => {
    if (sendingInProgress || sendQueue.length === 0) {
      return;
    }

    // 检查通道缓冲区状态
    if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
      // 如果缓冲区较满，等待一段时间后再尝试
      setTimeout(processSendQueue, 100);
      return;
    }

    sendingInProgress = true;
    const item = sendQueue.shift();

    try {
      channel.send(item);
      // 发送完成后处理下一个
      sendingInProgress = false;
      processSendQueue();
    } catch (error) {
      console.error('发送数据出错:', error);
      // 出错时重新加入队列前端
      sendQueue.unshift(item);
      sendingInProgress = false;
      // 稍后重试
      setTimeout(processSendQueue, 200);
    }
  };

  // 添加数据到发送队列
  const queueDataForSend = (data) => {
    sendQueue.push(data);
    processSendQueue();
  };

  // 设置缓冲区阈值
  channel.bufferedAmountLowThreshold = 65536; // 64KB

  // 当缓冲区低于阈值时继续发送
  channel.onbufferedamountlow = processSendQueue;

  fileReaders.value[transferId].addEventListener('load', async (e) => {
    // 准备元数据
    const chunkInfo = JSON.stringify({
      type: 'chunk-info',
      transferId: transferId,
      offset: offset,
      size: e.target.result.byteLength,
    });

    // 加密数据块
    // const encryptedChunk = await encryptData(e.target.result);

    // 将元数据和实际数据添加到发送队列
    queueDataForSend(chunkInfo);
    queueDataForSend(e.target.result);

    offset += e.target.result.byteLength;

    // 更新进度
    if (currentTransfersInner.value[transferId]) {
      currentTransfersInner.value[transferId].progress = Math.floor(
        (offset / data.size) * 100
      );
      currentTransfersInner.value[transferId].uploadedSize = offset;
    }

    if (offset < data.size) {
      // 控制读取速度，避免一次性读取过多数据
      if (sendQueue.length < 10) {
        readSlice(offset);
      } else {
        // 如果队列中已有较多数据，等待队列减少后再读取
        setTimeout(() => {
          if (sendQueue.length < 5) {
            readSlice(offset);
          }
        }, 200);
      }
    } else {
      // 传输完成
      console.log('传输完成');

      // 传输完成，上传至alist
      handleUpload2Alist(fileInfo, data);
      currentTransfersInner.value[transferId].status = 'completed';

      setTimeout(() => {
        delete fileReaders.value[transferId];
        delete props.currentTransfers[transferId];

        // 检查队列中是否有等待的文件
        processNextInQueue();
      }, 100);
    }
  });

  const readSlice = (o) => {
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
function sendData() {
  // 清空传输队列
  transferQueue.value = [];

  // 获取要发送的文件列表
  const filesToSend = [...localFilesList.value];

  // 检查通道状态
  const channel = props.sendChannel ? props.sendChannel : props.receiveChannel;
  if (!channel || channel.readyState !== 'open') {
    console.error('数据通道未打开，无法发送文件');
    return;
  }

  // 限制初始批次大小，避免一次性加载过多文件
  const initialBatchSize = Math.min(maxParallelTransfers, filesToSend.length);

  // 先发送初始批次
  for (let i = 0; i < initialBatchSize; i++) {
    const item = filesToSend[i];
    const data = item.file;
    const uploadedSize = item.uploadedSize || 0; // 获取已上传大小

    console.log(
      `开始发送文件: ${[
        data.name,
        data.size,
        data.type,
        data.lastModified,
      ].join(' ')}, 已上传: ${uploadedSize} 字节`
    );

    const fileInfo = {
      name: data.name,
      size: data.size,
      type: data.type,
    };

    // 开始传输
    handleSendFn(channel, fileInfo, data, uploadedSize);
  }

  // 将剩余文件添加到队列
  for (let i = initialBatchSize; i < filesToSend.length; i++) {
    const item = filesToSend[i];
    transferQueue.value.push({
      channel,
      fileInfo: {
        name: item.file.name,
        size: item.file.size,
        type: item.file.type,
      },
      data: item.file,
      uploadedSize: item.uploadedSize || 0, // 保存已上传大小到队列
    });
  }

  // 显示队列状态
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
    const nextTransfer = transferQueue.value.shift();

    if (nextTransfer) {
      const { channel, fileInfo, data, uploadedSize } = nextTransfer;
      handleSendFn(channel, fileInfo, data, uploadedSize);
    }
  }
};

const handleDrop = (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 添加到本地文件列表
      localFilesList.value.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file, // 保存文件对象本身，以便后续发送
        date: new Date().toLocaleString(),
        progress: 0, // 初始化进度为0
        uploadedSize: 0, // 初始化已上传大小
      });
    }
  }
};

const handleDeleteFile = (index) => {
  localFilesList.value.splice(index, 1);
};

// 选择并发送文件
const selectFile = () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;

  fileInput.onchange = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 如果已经上传，提示已上传
      if (localFilesList.value.find((item) => {}))
        // 添加到本地文件列表
        localFilesList.value.push({
          name: file.name,
          size: file.size,
          type: file.type,
          file: file, // 保存文件对象本身，以便后续发送
          date: new Date().toLocaleString(),
          progress: 0, // 初始化进度为0
          uploadedSize: 0, // 初始化已上传大小为0
        });
    }
  };

  fileInput.click();
};

// 清空文件列表
const clearFiles = () => {
  localFilesList.value = [];
};

const connectAlist = async () => {
  await getAlistToken();
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
});

// 监听通道状态变化
onMounted(() => {
  // 如果通道已经存在，设置事件处理函数
  if (props.sendChannel) {
    props.sendChannel.onmessage = onSendChannelMessageCallback;
    props.sendChannel.onopen = onSendChannelStateChange;
    props.sendChannel.onclose = onSendChannelStateChange;
  }

  if (props.receiveChannel) {
    props.receiveChannel.onmessage = onReceiveChannelMessageCallback;
    props.receiveChannel.onopen = onReceiveChannelStateChange;
    props.receiveChannel.onclose = onReceiveChannelStateChange;
  }
});
</script>

<style scoped lang="less">
.transfer-file {
  height: 100%;
  width: 100%;
  position: relative;

  .file-area {
    display: flex;
    align-items: center;
    width: 100%;

    /* 拖放区域 */
    .drop-area {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
      width: 50%;
      background-color: #fafafa;
      border: 2px dashed #ddd;
      border-radius: 8px;
      margin: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
    }

    .drop-area:hover,
    .drop-area.drop-hover {
      border-color: #2196f3;
      background-color: rgba(33, 150, 243, 0.05);
    }

    .drop-content {
      color: #b0b0b0;
    }

    .file-container {
      width: 50%;

      .has-receive,
      .has-send {
        display: flex;
        justify-content: center;
      }

      .file-list {
        width: 97%;
        height: 155px;
        overflow: auto;
        margin: 0 20px;

        .file-item {
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: space-between;
          padding: 5px 8px;
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 10px;

          .file-name {
            width: fit-content;
            color: #4a4a4a;
            font-size: 14px;
            padding: 5px 8px;

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
          }
        }
      }
    }
  }

  .bottom {
    height: 70px;
    margin-top: 10px;
    position: absolute;
    bottom: 100px;
    display: flex;

    .btn {
      margin-left: 20px;
    }

    .con-status {
      margin-left: 5px;

      .connected {
        display: flex;

        .dot {
          margin-top: 4px;
        }
      }
    }
  }
}
</style>
