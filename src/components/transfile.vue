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
                  v-if="haveTransedFile[file.name]?.status !== 'completed'"
                  class="delete_btn"
                  @click="handleDeleteFile(index)"
                >
                  <el-tooltip content="sure delete???" placement="top"
                    ><close-one class="close" theme="outline" size="16"
                  /></el-tooltip>
                </div>
                <div v-else class="has_completed">
                  <span class="txt">已发送</span>
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
                {{ file.name }}
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
            <Dot
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
          <p>点击添加文件或将文件（夹）拖放到这里（单次可发10个文件）</p>
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CloseOne, Dot, Download } from '@icon-park/vue-next';
import { ref, onMounted } from 'vue';
import { encode } from 'js-base64';
import { ElMessage } from 'element-plus';

// 获取URL对象，用于创建文件下载链接
const URL = window.URL || window.webkitURL;
const ALIST_DONMAIN = 'http://192.168.1.10:5244';
const MINIO_DONMAIN = 'http://192.168.1.10:9000';

const con_status = ref(false);
// 存放的是单独的要发送的完整文件
const transferQueue = ref([]);
const fileReaders = ref({});
const localFilesList = ref([]);
const maxParallelTransfers = 3; // 最大并行传输数量
const haveTransedFile = ref({});
const haveRecievedFile = ref({});
const alistToken = ref('');
const statsbox = ref();
const bitrateCanvas = ref();

const props = defineProps({
  receivedFileList: Array,
  sendChannel: Object,
  receiveChannel: Object,
  currentTransfers: Object,
  receivedFileChunks: Object,
  receivedFileSizes: Object,
  maxTransferData: Number,
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
  myHeaders.append('File-Path', `/root/${encodeURIComponent(fileInfo.name)}`);
  myHeaders.append('As-Task', 'true');
  myHeaders.append('Content-Length', '');
  myHeaders.append('Content-Type', 'application/octet-stream');

  const file = new File([data], fileInfo.name, { type: fileInfo.type });

  var requestOptions = {
    method: 'PUT',
    headers: myHeaders,
    body: file,
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

// 用于存放当前分块的信息
const message = ref();

// 接收文件处理函数
async function onReceiveChannelMessageCallback(event) {
  console.log('Received Message');

  const data = event.data;

  if (typeof data === 'string') {
    try {
      message.value = JSON.parse(data);

      // 这是一个数据块的元信息，下一个消息将是实际数据
      const { transferId, offset, size, fileInfo } = message.value;
      const { name } = fileInfo;
      if (!haveRecievedFile.value[transferId]) {
        // 保存已收到文件信息
        const receiveFileInfo = {
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

  console.log('data', data);

  // 二进制数据块
  // 查找当前正在接收的传输文件名
  const activeTransferId = Object.keys(haveRecievedFile.value).find(
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
    // const decryptedData = await decryptData(data);
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

      console.log('received file:', receivedFile);
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
    props.sendChannel.bufferedAmountLowThreshold = 113246208; // 16MB
    // 监控缓冲区状态
    const monitorBufferedAmount = () => {
      if (props.sendChannel && props.sendChannel.readyState === 'open') {
        const bufferedAmount = props.sendChannel.bufferedAmount;
        if (bufferedAmount > 113246208) {
          // 16MB
          console.log(
            `发送通道缓冲区较大: ${(bufferedAmount / 113246208).toFixed(2)}MB`
          );
        }
        setTimeout(monitorBufferedAmount, 2000);
      }
    };
    monitorBufferedAmount();
    return;
  }

  con_status.value = false;

  if (!con_status.value) {
    ElMessage.error('对方连接断开，请重试！');
    stopSendData();
  }
}

// 接收通道状态变化处理函数
function onReceiveChannelStateChange() {
  if (!props.receiveChannel) return;

  const readyState = props.receiveChannel.readyState;
  console.log(`Receive channel state is: ${readyState}`);

  // 当通道打开时，设置缓冲区阈值和事件处理
  if (readyState === 'open') {
    props.receiveChannel.bufferedAmountLowThreshold = 113246208; // 16MB
    // 监控缓冲区状态
    const monitorBufferedAmount = () => {
      if (props.receiveChannel && props.receiveChannel.readyState === 'open') {
        const bufferedAmount = props.receiveChannel.bufferedAmount;
        if (bufferedAmount > 113246208) {
          // 16MB
          console.log(
            `接收通道缓冲区较大: ${(bufferedAmount / 113246208).toFixed(2)}MB`
          );
        }
        setTimeout(monitorBufferedAmount, 2000);
      }
    };
    monitorBufferedAmount();
    return;
  }

  con_status.value = false;

  if (!con_status.value) {
    ElMessage.error('对方连接断开，请重试！');
    stopSendData();
  }
}

const stopSendData = () => {
  sendQueue = [];
  transferQueue.value = [];
};

const handleSendFn = async (channel, fileInfo, data, uploadedSize = 0) => {
  // 生成唯一的传输ID
  const transferId = `${fileInfo.name}`;

  // 发送文件信息，包含传输ID和加密标志
  console.log('channel', channel);

  // 记录当前传输
  const info = {
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

  const chunkSize = 102400; // 256KB
  // 每次发送一个完整都会重置
  fileReaders.value[transferId] = new FileReader();
  let offset = 0;

  // 添加缓冲区控制标志
  let sendingInProgress = false;

  // 创建文件碎片发送队列
  let sendQueue = [];

  // 设置缓冲区阈值
  channel.bufferedAmountLowThreshold = 113246208; // 12MB

  // 处理发送队列的函数
  const processSendQueue = () => {
    // 如果正在发送或者发送完结 结束发送逻辑
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
      // 发送文件
      channel.send(item);
      // 发送完成后处理下一个
      sendingInProgress = false;
      processSendQueue();
    } catch (error) {
      console.error('发送数据出错:', error);
      // 如果已经断开连接，直接返回
      if (!con_status.value) return;

      // 出错时重新加入队列稍后重试
      sendQueue.unshift(item);
      sendingInProgress = false;
      setTimeout(processSendQueue, 200);
    }
  };

  // 当缓冲区低于阈值时继续发送
  channel.onbufferedamountlow = processSendQueue;

  // 添加数据到发送队列
  const queueDataForSend = (data) => {
    sendQueue.push(data);
    processSendQueue();
  };

  fileReaders.value[transferId].addEventListener('error', (error) =>
    console.error(`Error reading file ${transferId}:`, error)
  );

  fileReaders.value[transferId].addEventListener('abort', (event) =>
    console.log(`File reading aborted ${transferId}:`, event)
  );

  fileReaders.value[transferId].addEventListener('load', async (e) => {
    // 应该在发送前将offset设置
    offset += e.target.result.byteLength;

    // 准备元数据
    const chunkInfo = JSON.stringify({
      type: 'chunk-info',
      transferId: transferId,
      offset: offset,
      size: e.target.result.byteLength,
      fileInfo,
    });

    // 加密数据块 webrtc自带文件加密 使用 DTLS握手阶段的加密算法 SRTP数据传输阶段的加密算法
    // const encryptedChunk = await encryptData(e.target.result);

    // 将元数据和实际数据添加到发送队列
    queueDataForSend(chunkInfo);
    queueDataForSend(e.target.result);
    // 更新进度
    haveTransedFile.value[transferId].progress = Math.floor(
      (offset / data.size) * 100
    );
    haveTransedFile.value[transferId].uploadedSize = offset;

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
  // 传输前检查通道状态
  const channel = props.sendChannel ? props.sendChannel : props.receiveChannel;
  if (!channel || channel.readyState !== 'open') {
    console.error('数据通道未打开，无法发送文件');
    return;
  }

  // 清空传输队列
  transferQueue.value = [];

  // 获取要发送的文件列表 已经发送过的就不用发了
  const filesToSend = [...localFilesList.value];

  // 限制初始批次大小，避免一次性发送过多文件
  const initialBatchSize = Math.min(maxParallelTransfers, filesToSend.length);

  // 先发送初始批次
  for (let i = 0; i < initialBatchSize; i++) {
    const item = filesToSend[i];
    const data = item.file;
    const uploadedSize = item.uploadedSize || 0; // 获取已上传大小
    const fileInfo = {
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
    const item = filesToSend[i];
    transferQueue.value.push({
      channel,
      fileInfo: {
        name: item.name,
        size: item.size,
        type: item.type,
        data: item.file,
      },
      data: item.file,
      uploadedSize: item.uploadedSize || 0, // 保存已上传大小到队列
    });
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
    const nextTransfer = transferQueue.value.shift();

    if (nextTransfer) {
      const { channel, fileInfo, data, uploadedSize } = nextTransfer;
      handleSendFn(channel, fileInfo, data, uploadedSize);
    }
  }
};

// 处理文件上传逻辑
const handleListFile = (e) => {
  const files = Array.from(e.dataTransfer.files);
  if (!files || files.length === 0) return;

  files.forEach((file) => {
    const idx = localFilesList.value.findIndex(
      (item) => item.name === file.name
    );
    // 如果还没上传过
    if (idx === -1) {
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
  });
};

// 拖动文件
const handleDrop = (e) => {
  handleListFile(e);
};

// 选择文件
const selectFile = () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;

  fileInput.onchange = (e) => {
    handleListFile(e);
  };

  fileInput.click();
};

// 删除文件
const handleDeleteFile = (index) => {
  localFilesList.value.splice(index, 1);
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
  con_status,
  bitrateCanvas,
});

// 监听通道状态变化
onMounted(() => {
  getAlistToken();
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
