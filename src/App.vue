<template>
  <div class="container">
    <!--    <Header />-->
    <div class="header">
      <div class="content">
        <div class="img">
          <img src="@/assets/easyboat_48_48.png" alt="logo" />
        </div>
        <div class="title">
          <h1>轻量传</h1>
          <h3>手机、电脑、平板... 轻松互传</h3>
        </div>
      </div>
    </div>
    <!--    <Content />-->
    <div class="content">
      <!-- 顶部导航区 -->
      <div class="top-nav">
        <div class="left-nav">
          <div
            class="nav-item"
            :class="{ active: activeTab === 'file' }"
            @click="switchFunction('file')"
          >
            <i class="icon">📄</i> 传文件
          </div>
          <div
            class="nav-item"
            :class="{ active: activeTab === 'text' }"
            @click="switchFunction('text')"
          >
            <i class="icon">📝</i> 传文本
          </div>
          <div
            class="nav-item"
            :class="{ active: activeTab === 'screen' }"
            @click="switchFunction('screen')"
          >
            <i class="icon">🖥️</i> 传屏幕
          </div>
          <div
            class="nav-item"
            :class="{ active: activeTab === 'video' }"
            @click="switchFunction('video')"
          >
            <i class="icon">📹</i> 传视频
          </div>
        </div>
        <div class="right-nav">
          <el-button type="primary" class="nav-button">下载所有</el-button>
          <el-button type="success" class="nav-button" @click="selectFile"
            >添加文件</el-button
          >
          <el-button
            type="danger"
            class="nav-button nav-button-clear"
            @click="clearFiles"
            >清空</el-button
          >
        </div>
      </div>
      <div
        class="transfer-file"
        @drop.prevent="handleDrop"
        @dragenter.prevent
        @dragover.prevent
      >
        <!-- 拖放区域 -->
        <div class="drop-area" @click="selectFile">
          <div class="drop-content">
            <p>点击添加文件或将文件（夹）拖放到这里（单次可发10个文件）</p>
          </div>
        </div>
        <div class="file-container">
          <div class="file-list" v-if="localFilesList.length">
            <div class="has-send">已发送文件</div>
            <div
              v-for="(file, index) in localFilesList"
              :key="index"
              class="file-item"
            >
              <div class="file-name">{{ file.name }}</div>
              <div class="file-details">
                <div class="size">{{ (file.size / 1024).toFixed(2) }} KB</div>
                <div class="delete_btn" @click="handleDeleteFile(index)">
                  <el-tooltip content="sure delete???" placement="top"
                    ><close-one class="close" theme="outline" size="16"
                  /></el-tooltip>
                </div>
              </div>
            </div>
          </div>
          <div class="file-list" v-if="receivedFileList.length">
            <div class="has-receive">已收到文件</div>
            <div
              v-for="(file, index) in receivedFileList"
              :key="index"
              class="file-item"
            >
              <div class="file-name">
                <a href="{{URL.createObjectURL(file)}}" :download="file.name">{{
                  file.name
                }}</a>
              </div>
              <div class="file-details">
                <div class="size">{{ (file.size / 1024).toFixed(2) }} KB</div>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { CloseOne } from '@icon-park/vue-next';

const localFilesList = ref([]);
const receivedFileList = ref([]);
const receivedFileChunks = ref([]);
const receivedFileSize = ref(0);
const activeTab = ref('file');
const pc = ref();
const signaling = ref();
const sendChannel = ref();
const receiveChannel = ref();
const fileReader = ref();
const fileInfo = ref();

// 配置STUN服务器，帮助NAT穿透
const configuration = ref({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
});

const switchFunction = (tab) => {
  activeTab.value = tab;
};

const clearFiles = () => {
  localFilesList.value = [];
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

      // 添加到本地文件列表
      localFilesList.value.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file, // 保存文件对象本身，以便后续发送
        date: new Date().toLocaleString(),
      });
    }
  };

  fileInput.click();
};

async function createPeerConnection() {
  console.log('createPeerConnection-----');
  pc.value = new RTCPeerConnection(configuration.value);
  pc.value.onicecandidate = (e) => {
    const message = {
      type: 'candidate',
      candidate: null,
    };
    if (e.candidate) {
      message.candidate = e.candidate.candidate;
      message.sdpMid = e.candidate.sdpMid;
      message.sdpMLineIndex = e.candidate.sdpMLineIndex;
    }
    console.log('message', message);
    signaling.value.postMessage(message);
  };
}

async function handleOffer(offer) {
  console.log('handleOffer------');
  if (pc.value) {
    console.error('existing peerconnection');
    return;
  }
  await createPeerConnection();
  pc.value.ondatachannel = receiveChannelCallback;
  await pc.value.setRemoteDescription(offer);

  const answer = await pc.value.createAnswer();
  signaling.value.postMessage({ type: 'answer', sdp: answer.sdp });
  await pc.value.setLocalDescription(answer);
}

async function handleAnswer(answer) {
  console.log('handleAnswer------');
  if (!pc.value) {
    console.error('no peerconnection');
    return;
  }
  await pc.value.setRemoteDescription(answer);
}

async function handleCandidate(candidate) {
  console.log('handleCandidate------');
  console.log('candidate', candidate);
  if (!pc.value) {
    console.error('no peerconnection');
    return;
  }
  if (!candidate.candidate) {
    await pc.value.addIceCandidate(null);
  } else {
    await pc.value.addIceCandidate(candidate);
  }
}

function sendData() {
  for (const item of localFilesList.value) {
    const data = item.file;
    console.log(
      `File is ${[data.name, data.size, data.type, data.lastModified].join(' ')}`
    );

    const fileInfo = {
      name: data.name,
      size: data.size,
      type: data.type,
    };
    if (sendChannel.value) {
      sendChannel.value.send(
        JSON.stringify({
          type: 'file-info',
          data: fileInfo,
        })
      );

      const chunkSize = 16384;
      fileReader.value = new FileReader();
      let offset = 0;
      fileReader.value.addEventListener('error', (error) =>
        console.error('Error reading file:', error)
      );
      fileReader.value.addEventListener('abort', (event) =>
        console.log('File reading aborted:', event)
      );
      fileReader.value.addEventListener('load', (e) => {
        console.log('FileRead.onload ', e);
        sendChannel.value.send(e.target.result);
        offset += e.target.result.byteLength;
        if (offset < data.size) {
          readSlice(offset);
        }
      });
      const readSlice = (o) => {
        console.log('readSlice ', o);
        const slice = data.slice(offset, o + chunkSize);
        fileReader.value.readAsArrayBuffer(slice);
      };
      readSlice(0);
    } else {
      receiveChannel.value.send(
        JSON.stringify({
          type: 'file-info',
          data: fileInfo,
        })
      );

      const chunkSize = 16384;
      fileReader.value = new FileReader();
      let offset = 0;
      fileReader.value.addEventListener('error', (error) =>
        console.error('Error reading file:', error)
      );
      fileReader.value.addEventListener('abort', (event) =>
        console.log('File reading aborted:', event)
      );
      fileReader.value.addEventListener('load', (e) => {
        console.log('FileRead.onload ', e);
        receiveChannel.value.send(e.target.result);
        offset += e.target.result.byteLength;
        if (offset < data.size) {
          readSlice(offset);
        }
      });
      const readSlice = (o) => {
        console.log('readSlice ', o);
        const slice = data.slice(offset, o + chunkSize);
        fileReader.value.readAsArrayBuffer(slice);
      };
      readSlice(0);
    }
    console.log('Sent Data: ', data);
  }
}

function receiveChannelCallback(event) {
  console.log('Receive Channel Callback');
  receiveChannel.value = event.channel;
  receiveChannel.value.onmessage = onReceiveChannelMessageCallback;
  receiveChannel.value.onopen = onReceiveChannelStateChange;
  receiveChannel.value.onclose = onReceiveChannelStateChange;
}

function onReceiveChannelMessageCallback(event) {
  console.log('Received Message');
  console.log(event);

  const data = event.data;

  if (typeof data === 'string') {
    const message = JSON.parse(data);
    console.log('message', message);
    if (message.type === 'file-info') {
      fileInfo.value = message.data;
    }
  } else {
    //如果不是字符串，那就是文件内容，二进制
    receivedFileChunks.value.push(data);
    receivedFileSize.value += data.byteLength;

    if (fileInfo.value) {
      if (receivedFileSize.value === fileInfo.value.size) {
        const receivedFile = new File(
          receivedFileChunks.value,
          fileInfo.value.name,
          { type: fileInfo.value.type }
        );
        // const a = document.createElement('a');
        // a.href = URL.createObjectURL(receivedFile);
        // a.download = receivedFile.name;
        console.log('received file:', receivedFile);
        receivedFileList.value = [...receivedFileList.value, receivedFile];
      }
    }
  }
}

function onSendChannelMessageCallback(event) {
  console.log('Received Message');
  console.log(event);

  const data = event.data;

  if (typeof data === 'string') {
    const message = JSON.parse(data);
    console.log('message', message);
    if (message.type === 'file-info') {
      fileInfo.value = message.data;
    }
  } else {
    //如果不是字符串，那就是文件内容，二进制
    receivedFileChunks.value.push(data);
    receivedFileSize.value += data.byteLength;

    if (fileInfo.value) {
      if (receivedFileSize.value === fileInfo.value.size) {
        const receivedFile = new File(
          receivedFileChunks.value,
          fileInfo.value.name,
          { type: fileInfo.value.type }
        );
        console.log('received file:', receivedFile);
        receivedFileList.value = [...receivedFileList.value, receivedFile];
      }
    }
  }
}

function onSendChannelStateChange() {
  const readyState = sendChannel.value.readyState;
  console.log(`Send channel state is: ${readyState}`);
}

function onReceiveChannelStateChange() {
  const readyState = receiveChannel.value.readyState;
  console.log(`Receive channel state is: ${readyState}`);
}

// 开始创建连接入口
const startFn = async () => {
  console.log('startFn-----');
  await createPeerConnection();
  sendChannel.value = pc.value.createDataChannel('sendDataChannel');
  sendChannel.value.onopen = onSendChannelStateChange;
  sendChannel.value.onmessage = onSendChannelMessageCallback;
  sendChannel.value.onclose = onSendChannelStateChange;

  const offer = await pc.value.createOffer();
  signaling.value.postMessage({ type: 'offer', sdp: offer.sdp });
  await pc.value.setLocalDescription(offer);
};

onMounted(() => {
  console.log('开始执行');
  signaling.value = new BroadcastChannel('webrtc');
  signaling.value.onmessage = (e) => {
    switch (e.data.type) {
      case 'offer':
        handleOffer(e.data);
        break;
      case 'answer':
        handleAnswer(e.data);
        break;
      case 'candidate':
        handleCandidate(e.data);
        break;
      case 'ready':
        // A second tab joined. This tab will enable the start button unless in a call already.
        if (pc.value) {
          console.log(pc.value);
          console.log('already in call, ignoring');
          return;
        }
        startFn();
        break;
      case 'bye':
        if (pc) {
          hangup();
        }
        break;
      default:
        console.log('unhandled', e);
        break;
    }
  };
  signaling.value.postMessage({ type: 'ready' });
});
</script>

<style scoped>
.container {
  height: 100vh;

  .header {
    height: 70px;
    width: 100%;
    background-color: #1e7ad7;
    box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.6);
    margin-bottom: 2px;

    .content {
      margin: 0 auto;
      width: 80%;
      height: 100%;
      background-color: #1e7ad7;
      color: white;
      display: flex;

      .img {
        display: flex;
        align-items: center;
        margin-right: 5px;
      }
    }
  }

  .content {
    width: 80%;
    height: 80%;
    margin: 0 auto;
    background-color: #fff;

    .top-nav {
      height: 70px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      padding: 20px 20px 0 20px;
      border-bottom: 1px solid #e8e8e8;

      .left-nav {
        display: flex;
        width: 60%;

        .nav-item {
          padding: 5px;
          margin-right: 5px;
          display: flex;
          align-items: center;

          &.active {
            color: #1e7ad7;
            border-bottom: 1px #1e7ad7 solid;
          }

          .icon {
            display: inline-block;
            margin-right: 5px;
          }
        }
      }

      .right-nav {
        flex: 1;
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }
    }

    .transfer-file {
      height: 100%;
      width: 100%;

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
        padding: 60px 20px;
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
        .file-list {
          width: 98%;
          height: 200px;
          overflow: auto;
          margin: 0 20px;

          .has-receive {
            margin-bottom: 10px;
          }

          .has-send {
            margin: 0 0 10px 0;
          }

          .file-item {
            display: flex;
            align-items: center;
            padding: 5px 8px;
            border: 1px solid #eee;
            border-radius: 8px;
            width: fit-content;
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

              .size {
                background-color: #fafafa;
                border: 1px solid #d9d9d9;
                padding: 0 7px;
                line-height: 20px;
                border-radius: 4px;
              }

              .delete_btn {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 5px 8px;
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

      .bottom {
        height: 70px;
        margin-top: 10px;

        .btn {
          margin-left: 20px;
        }
      }
    }
  }
}
</style>
