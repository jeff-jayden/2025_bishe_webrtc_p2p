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
            <upload-one theme="outline" size="16" class="icon" /> 传文件
          </div>
          <div
            class="nav-item"
            :class="{ active: activeTab === 'text' }"
            @click="switchFunction('text')"
          >
            <file-text
              theme="outline"
              size="16"
              :strokeWidth="3"
              class="icon"
            />
            传文本
          </div>
          <div
            class="nav-item"
            :class="{ active: activeTab === 'screen' }"
            @click="switchFunction('screen')"
          >
            <cast-screen
              class="icon"
              theme="outline"
              size="16"
              :strokeWidth="3"
            />
            传屏幕
          </div>
          <div
            class="nav-item"
            :class="{ active: activeTab === 'video' }"
            @click="switchFunction('video')"
          >
            <phone-video-call
              class="icon"
              theme="outline"
              size="16"
              :strokeWidth="3"
            />
            传视频
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
      <Transfile
        v-if="activeTab === 'file'"
        :receivedFileList="receivedFileList"
        :sendChannel="sendChannel"
        :receiveChannel="receiveChannel"
        :currentTransfers="currentTransfers"
        :receivedFileChunks="receivedFileChunks"
        :receivedFileSizes="receivedFileSizes"
        ref="transfileRef"
        :maxTransferData="maxTransferData"
      />
      <Transtext
        v-if="activeTab === 'text'"
        :sendChannel="sendChannel"
        :receiveChannel="receiveChannel"
        ref="transtextRef"
      />
      <Transvideo
        v-if="activeTab === 'video'"
        :signaling="signaling"
        ref="transvideoRef"
      />
      <Transscreen
        v-if="activeTab === 'screen'"
        :signaling="signaling"
        :pc="pc"
        ref="transscreenRef"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import {
  UploadOne,
  FileText,
  CastScreen,
  PhoneVideoCall,
} from '@icon-park/vue-next';
import Transfile from '@/components/transfile.vue';
import Transtext from '@/components/transtext.vue';
import Transvideo from '@/components/transvideo.vue';
import Transscreen from '@/components/transscreen.vue';
import { encode } from 'js-base64';
import { ElMessageBox, ElMessage } from 'element-plus';

const MINIO_DONMAIN = 'http://192.168.206.72:9000';
const receivedFileChunks = ref({});
const receivedFileSizes = ref({});
const receivedFileList = ref([]);
const activeTab = ref('file');
const pc = ref();
const signaling = ref();
const sendChannel = ref();
const receiveChannel = ref();
const currentTransfers = ref({});
const lastResult = ref();
const maxTransferData = ref(0);

// 配置STUN服务器，帮助NAT穿透
const configuration = ref({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
});

// 引用组件
const transfileRef = ref(null);
const transtextRef = ref(null);
const transvideoRef = ref(null);
const transscreenRef = ref(null);

//预览文件功能
const handlePreview = () => {
  var url = `${MINIO_DONMAIN}/miniodemo/root/总体架构图.png`; //要预览文件的访问地址
  window.open(
    'http://127.0.0.1:8012/onlinePreview?url=' + encodeURIComponent(encode(url))
  );
};

// 清空文件列表
const clearFiles = () => {
  if (transfileRef.value) {
    transfileRef.value.clearFiles();
  }
};

// 选择文件
const selectFile = () => {
  if (transfileRef.value) {
    transfileRef.value.selectFile();
  }
};

const switchFunction = (tab) => {
  activeTab.value = tab;

  console.log('切换中...');

  nextTick(() => {
    // 切换标签时重新设置数据通道的事件处理程序
    // 接收渠道设置
    signaling.value.postMessage({ type: 'ready' });

    if (receiveChannel.value) {
      console.log('有receiveChannel');
      console.log('tab', tab);
      if (tab === 'file' && transfileRef.value) {
        receiveChannel.value.onmessage =
          transfileRef.value.onReceiveChannelMessageCallback;
        receiveChannel.value.onopen =
          transfileRef.value.onReceiveChannelStateChange;
        receiveChannel.value.onclose =
          transfileRef.value.onReceiveChannelStateChange;
      } else if (tab === 'text' && transtextRef.value) {
        console.log('切换为text');
        receiveChannel.value.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            transtextRef.value.onTextMessageReceived(message);
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        };
      }
    }

    // 发送渠道设置
    if (sendChannel.value) {
      console.log('有sendChannel');
      console.log('tab', tab);

      if (tab === 'file' && transfileRef.value) {
        sendChannel.value.onopen = transfileRef.value.onSendChannelStateChange;
        sendChannel.value.onmessage =
          transfileRef.value.onSendChannelMessageCallback;
        sendChannel.value.onclose = transfileRef.value.onSendChannelStateChange;
      } else if (tab === 'text' && transtextRef.value) {
        console.log('切换为text');

        sendChannel.value.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            transtextRef.value.onTextMessageReceived(message);
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        };
      }
    }
  });
};

const hangup = () => {
  if (pc.value) {
    pc.value.close();
    pc.value = null;
  }
  if (activeTab.value === 'video' && transvideoRef.value) {
    transvideoRef.value.endVideoCall();
  }
  if (activeTab.value === 'screen' && transscreenRef.value) {
    transscreenRef.value.stopScreenShare();
  }
};

async function createPeerConnection() {
  console.log('createPeerConnection-----');
  pc.value = new RTCPeerConnection(configuration.value);

  // 创建图
  const bitrateSeries = new TimelineDataSeries();
  const bitrateGraph = new TimelineGraphView('bitrateGraph', 'bitrateCanvas');
  bitrateGraph.updateEndDate();

  // 设置数据分析;
  setInterval(() => {
    pc.value.getStats().then((stats) => {
      console.log('states', stats);
      let statsOutput = '';

      stats.forEach((report) => {
        if (report.type === 'data-channel' || report.type === 'transport') {
          const now = report.timestamp;
          const bytes = report.bytesSent;

          const packets = report.packetsSent;
          if (lastResult.value && lastResult.value.has(report.id)) {
            // calculate bitrate
            const bitrate =
              (8 * (bytes - lastResult.value.get(report.id).bytesSent)) /
              (now - lastResult.value.get(report.id).timestamp);

            console.log('bitrate', bitrate);
            maxTransferData.value = Math.max(maxTransferData.value, bitrate);
            // append to chart
            bitrateSeries.addPoint(now, bitrate);
            bitrateGraph.setDataSeries([bitrateSeries]);
            bitrateGraph.updateEndDate();
          }

          // statsOutput +=
          //   `<h2>Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
          //   `<strong>Timestamp:</strong> ${report.timestamp}<br>\n`;

          // // Now the statistics for this report; we intentionally drop the ones we
          // // sorted to the top above

          // Object.keys(report).forEach((statName) => {
          //   if (
          //     statName !== 'id' &&
          //     statName !== 'timestamp' &&
          //     statName !== 'type'
          //   ) {
          //     statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
          //   }
          // });
        }
      });

      lastResult.value = stats;
      transfileRef.value.statsbox.innerHTML = statsOutput;
    });
  }, 1000);

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
  if (activeTab.value === 'video' && transvideoRef.value) {
    console.log('执行了ontrack事件');

    pc.value.ontrack = (event) => {
      console.log('ontrack事件触发');
      console.log('event', event);

      if (event.streams && event.streams[0]) {
        transvideoRef.value.remoteVideo.srcObject = event.streams[0];
      }
    };
    const stream = transvideoRef.value.stream;
    stream.getTracks().forEach((track) => {
      console.log('track', track);

      pc.value.addTrack(track, stream);
    });

    console.log('pc', pc.value);
  }
  if (activeTab.value === 'screen' && transscreenRef.value) {
    console.log('执行了ontrack事件');

    pc.value.ontrack = (event) => {
      console.log('ontrack事件触发');
      console.log('event', event);

      if (event.streams && event.streams[0]) {
        transscreenRef.value.remoteVideo.srcObject = event.streams[0];
      }
    };
    const stream = transscreenRef.value.stream;
    stream.getTracks().forEach((track) => {
      console.log('track', track);

      pc.value.addTrack(track, stream);
    });

    console.log('pc', pc.value);
  }
}

// 发送方设置接收方的连接信息
async function handleAnswer(answer) {
  console.log('handleAnswer------');
  if (!pc.value) {
    console.error('no peerconnection');
    return;
  }
  await pc.value.setRemoteDescription(answer);

  // 成功设置对方的连接信息
  // 改变连接状态
  transfileRef.value.con_status = true;
  // 同时发送信号给对方改变状态
  signaling.value.postMessage({ type: 'connction', status: 'connected' });
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

// 接收方
async function handleOffer(offer) {
  console.log('handleOffer------');
  // if (pc.value) {
  //   console.error('existing peerconnection');
  //   return;
  // }
  await createPeerConnection();
  pc.value.ondatachannel = receiveChannelCallback;
  // 接收方设置发送方的连接信息
  await pc.value.setRemoteDescription(offer);

  // 创建接受方的连接信息   这时候应该还是旧的answer
  const answer = await pc.value.createAnswer();
  signaling.value.postMessage({ type: 'answer', sdp: answer.sdp });
  await pc.value.setLocalDescription(answer);
}

// 发送数据在里面，要传一个 channel 进去发送，还得传 2 个
// 接收数据在外面，因为创建的连接是在外面
function receiveChannelCallback(event) {
  console.log('Receive Channel Callback');
  receiveChannel.value = event.channel;

  // 通道事件处理将在组件中设置
  if (activeTab.value === 'file' && transfileRef.value) {
    receiveChannel.value.onmessage =
      transfileRef.value.onReceiveChannelMessageCallback;
    receiveChannel.value.onopen =
      transfileRef.value.onReceiveChannelStateChange;
    receiveChannel.value.onclose =
      transfileRef.value.onReceiveChannelStateChange;
  } else if (activeTab.value === 'text' && transtextRef.value) {
    receiveChannel.value.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('receiveChannel 执行', message);
        transtextRef.value.onTextMessageReceived(message);
      } catch (error) {
        console.error('解析消息失败:', error);
      }
    };
  }
}

// 开始创建连接入口  发送方
const startFn = async () => {
  console.log('startFn-----');
  await createPeerConnection();
  sendChannel.value = pc.value.createDataChannel('sendDataChannel');

  // 通道事件处理将在组件中设置
  if (activeTab.value === 'file' && transfileRef.value) {
    sendChannel.value.onopen = transfileRef.value.onSendChannelStateChange;
    sendChannel.value.onmessage =
      transfileRef.value.onSendChannelMessageCallback;
    sendChannel.value.onclose = transfileRef.value.onSendChannelStateChange;
  } else if (activeTab.value === 'text' && transtextRef.value) {
    sendChannel.value.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        transtextRef.value.onTextMessageReceived(message);
      } catch (error) {
        console.error('解析消息失败:', error);
      }
    };
  }

  // 创建发送方的连接信息
  const offer = await pc.value.createOffer();
  signaling.value.postMessage({ type: 'offer', sdp: offer.sdp });
  await pc.value.setLocalDescription(offer);
};

const sureConnect = (data) => {
  ElMessageBox.confirm(
    `Would you like to accept a connection from ${data.name}?`,
    'Warning',
    {
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  )
    .then(() => {
      ElMessage({
        type: 'success',
        message: 'you agreed to connect',
      });
      startFn();
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: 'connect canceled',
      });
    });
};

onMounted(() => {
  console.log('开始执行');
  signaling.value = new BroadcastChannel('webrtc');
  signaling.value.onmessage = (e) => {
    if (activeTab.value === 'video' && !transvideoRef.value.stream) {
      console.log('not ready yet');
      return;
    }
    if (activeTab.value === 'screen' && !transscreenRef.value.stream) {
      console.log('not ready yet');
      return;
    }
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
      case 'connction':
        transfileRef.value.con_status = e.data.status === 'connected';
        break;
      case 'ready':
        if (pc.value) {
          // 说明己方即将断开，此时发送消息给对面更新状态
          console.log('already in call, ignoring');
          signaling.value.postMessage({
            type: 'connction',
            status: 'disconnected',
          });
          return;
        }
        sureConnect(e.data);
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
  if (activeTab.value !== 'video') {
    const name = Date.now().toString().slice(10);
    signaling.value.postMessage({ type: 'ready', name });
  }
});
</script>

<style scoped lang="less">
.container {
  height: 90vh;

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
    height: 90%;
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
            display: flex;
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
  }
}
</style>
