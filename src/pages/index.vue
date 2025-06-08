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
        <div v-if="activeTab === 'file'" class="right-nav">
          <el-button type="primary" class="nav-button" @click="downloadAllFiles"
            >下载所有</el-button
          >
          <el-button
            type="danger"
            class="nav-button nav-button-clear"
            @click="clearFiles"
            >清空已上传</el-button
          >
          <!-- 添加断开连接按钮 -->
          <el-button
            v-if="transfileRef?.con_status"
            type="danger"
            class="disconnect-btn"
            @click="handleDisconnect"
          >
            断开连接
          </el-button>
        </div>
      </div>
      <Transfile
        v-if="activeTab === 'file'"
        ref="transfileRef"
        :receivedFileList="receivedFileList"
        :sendChannel="sendChannel"
        :receiveChannel="receiveChannel"
        :currentTransfers="currentTransfers"
        :receivedFileChunks="receivedFileChunks"
        :receivedFileSizes="receivedFileSizes"
        :maxTransferData="maxTransferData"
        :realTimeRate="realTimeRate"
        @closeChannel="handleDisconnect"
      />
      <Transtext
        v-if="activeTab === 'text'"
        :sendChannel="sendChannel"
        :receiveChannel="receiveChannel"
        ref="transtextRef"
        @closeChannel="handleDisconnect"
      />
      <Transvideo
        v-if="activeTab === 'video'"
        :signaling="signaling"
        ref="transvideoRef"
      />
      <Transscreen
        v-if="activeTab === 'screen'"
        :pc="pc"
        ref="transscreenRef"
        @endCall="handleEndCall"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
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
const activeTab = ref('text');
const pc = ref();
const signaling = ref();
const sendChannel = ref();
const receiveChannel = ref();
const currentTransfers = ref({});
const lastResult = ref();
const maxTransferData = ref(0);
const realTimeRate = ref();

const activityTimer = ref(null);
const ACTIVITY_TIMEOUT = 2 * 60 * 1000; // 10 seconds

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

// 下载所有接收到的文件
const downloadAllFiles = () => {
  if (transfileRef.value && receivedFileList.value.length > 0) {
    receivedFileList.value.forEach((file) => {
      if (file.receivedFile && file.status === 'completed') {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file.receivedFile);
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href); // 释放URL对象
      }
    });
    ElMessage.success('已开始下载所有已接收的文件！');
  } else {
    ElMessage.error('没有已接收或已完成的文件可供下载。');
  }
};

//预览文件功能
const handlePreview = () => {
  var url = `${MINIO_DONMAIN}/miniodemo/root/总体架构图.png`; //要预览文件的访问地址
  window.open(
    'http://127.0.0.1:8012/onlinePreview?url=' + encodeURIComponent(encode(url))
  );
};

// 清空文件列表
const clearFiles = () => {
  if (!transfileRef?.value.localFilesList.length) {
    ElMessage.error('请先上传文件 亲～');
    return;
  }

  if (transfileRef.value) {
    ElMessageBox.confirm('确认清空已上传的文件吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
      .then(() => {
        transfileRef.value.clearFiles();
        ElMessage({
          type: 'success',
          message: '清空成功',
        });
      })
      .catch(() => {
        ElMessage({
          type: 'warning',
          message: '取消清空',
        });
      });
  }
};

// 选择文件
const selectFile = () => {
  if (transfileRef.value) {
    transfileRef.value.selectFile();
  }
};

const handleEndCall = () => {
  signaling.value.postMessage({ type: 'endCall' });
};

function resetActivityTimer() {
  clearTimeout(activityTimer.value);
  const isPeerConnected = pc.value && pc.value.connectionState === 'connected';
  const isSendChannelEffectivelyOpen =
    sendChannel.value && sendChannel.value.readyState === 'open';
  const isReceiveChannelEffectivelyOpen =
    receiveChannel.value && receiveChannel.value.readyState === 'open';

  if (
    isPeerConnected &&
    (isSendChannelEffectivelyOpen || isReceiveChannelEffectivelyOpen)
  ) {
    console.log('Activity timer reset (5mins)');
    activityTimer.value = setTimeout(() => {
      const stillPeerConnected =
        pc.value && pc.value.connectionState === 'connected';
      const stillSendOpen =
        sendChannel.value && sendChannel.value.readyState === 'open';
      const stillReceiveOpen =
        receiveChannel.value && receiveChannel.value.readyState === 'open';

      if (stillPeerConnected && (stillSendOpen || stillReceiveOpen)) {
        ElMessage.warning('5分钟内无数据传输活动，已自动断开连接。');
        handleDisconnect();
      } else {
        console.log(
          'Activity timer expired, but connection/channels no longer active.'
        );
      }
    }, ACTIVITY_TIMEOUT);
  } else {
    // console.log('Activity timer not set: PC not connected or no channels open.');
  }
}

const switchFunction = (tab) => {
  activeTab.value = tab;
  console.log('切换中...');
  nextTick(() => {
    signaling.value.postMessage({ type: 'ready' });

    if (receiveChannel.value) {
      console.log('有receiveChannel');
      console.log('tab', tab);
      if (tab === 'file' && transfileRef.value) {
        receiveChannel.value.onopen = (event) => {
          resetActivityTimer();
          if (transfileRef.value) {
            transfileRef.value.onReceiveChannelStateChange(event);
          }
        };
        receiveChannel.value.onmessage = (event) => {
          resetActivityTimer();
          if (transfileRef.value) {
            transfileRef.value.onReceiveChannelMessageCallback(event);
          }
        };
        receiveChannel.value.onclose =
          transfileRef.value.onReceiveChannelStateChange;
      } else if (tab === 'text' && transtextRef.value) {
        console.log('切换为text');
        receiveChannel.value.onmessage = (event) => {
          resetActivityTimer();
          try {
            const message = JSON.parse(event.data);
            if (transtextRef.value) {
              transtextRef.value.onTextMessageReceived(message);
            }
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        };
      }
    }

    if (sendChannel.value) {
      console.log('有sendChannel');
      console.log('tab', tab);
      if (tab === 'file' && transfileRef.value) {
        const originalOnSendOpen = transfileRef.value.onSendChannelStateChange;
        sendChannel.value.onopen = (event) => {
          resetActivityTimer();
          if (originalOnSendOpen)
            originalOnSendOpen.call(transfileRef.value, event);
        };
        const originalOnSendMessage =
          transfileRef.value.onSendChannelMessageCallback;
        sendChannel.value.onmessage = (event) => {
          // For control messages received by sender
          resetActivityTimer();
          if (originalOnSendMessage)
            originalOnSendMessage.call(transfileRef.value, event);
        };
        sendChannel.value.onclose = transfileRef.value.onSendChannelStateChange;
      } else if (tab === 'text' && transtextRef.value) {
        console.log('切换为text');
        sendChannel.value.onmessage = (event) => {
          resetActivityTimer();
          try {
            const message = JSON.parse(event.data);
            if (transtextRef.value) {
              transtextRef.value.onTextMessageReceived(message);
            }
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        };
      }
    }
  });
};

const closeChannel = (channel) => {
  clearTimeout(activityTimer.value); // Clear timer when a channel is manually closed
  channel.close();
  channel = null;
  if (transfileRef.value) {
    transfileRef.value.con_status = false;
    transfileRef.value.isSelf = true;
  }
  pc.value = null;
};

const discInner = (channel, shenfen) => {
  closeChannel(channel);
  signaling.value.postMessage({ type: 'disconncted', shenfen });
};

// 处理主动断开连接的函数
const handleDisconnect = () => {
  clearTimeout(activityTimer.value);
  console.log('Attempting to disconnect...');
  // 当是sendChannel方主动断开连接，先断开自己的，再发个消息给对方，对方也断开
  if (sendChannel.value) {
    discInner(sendChannel.value, 'sendChannel');
  } else if (receiveChannel.value) {
    // 当是receiveChannel方主动断开连接，先断开自己的，再发个消息给对方，对方也断开
    discInner(receiveChannel.value, 'receiveChannel');
  }
};

const singDiscInner = (channel) => {
  channel.close();
  channel = null;
  if (transfileRef.value) {
    transfileRef.value.con_status = false;
    // todo 有歧义，可能得换个变量名
    transfileRef.value.isSelf = true;
    if (transfileRef.value.isSelf) {
      ElMessage.error('对方断开连接...请确认～');
    }
  }
};

const signalingDisconncted = (shenfen) => {
  console.log('signalingDisconncted-----', shenfen);
  if (shenfen === 'sendChannel') {
    singDiscInner(receiveChannel.value);
    return;
  }
  if (shenfen === 'receiveChannel') {
    singDiscInner(sendChannel.value);
    return;
  }
};

async function createPeerConnection() {
  console.log('createPeerConnection-----');
  // 创建 peerconnection
  pc.value = new RTCPeerConnection(configuration.value);

  if (activeTab.value === 'file') {
    // 创建图
    const bitrateSeries = new TimelineDataSeries();
    const bitrateGraph = new TimelineGraphView('bitrateGraph', 'bitrateCanvas');
    bitrateGraph.updateEndDate();

    // 每秒获取一次 WebRTC 统计信息
    setInterval(() => {
      // 获取 RTCPeerConnection 的统计信息
      pc.value.getStats().then((stats) => {
        // 打印统计信息到控制台
        console.log('states', stats);
        let statsOutput = '';

        // 遍历所有统计报告
        stats.forEach((report) => {
          // 查找数据通道或传输相关的报告
          if (report.type === 'data-channel' || report.type === 'transport') {
            // 获取当前时间戳和发送的字节数
            const now = report.timestamp;
            const bytes = report.bytesSent;

            // 如果存在上一次的结果并且包含当前报告的ID
            if (lastResult.value && lastResult.value.has(report.id)) {
              // 计算MB/s ((bytes2 - bytes1) / 1024 / 1024 / (time2 - time1) / 1000)
              const bitrate =
                (bytes - lastResult.value.get(report.id).bytesSent) /
                ((now - lastResult.value.get(report.id).timestamp) / 1000); // 计算时间差（毫秒）
              // 打印计算出的比特率
              console.log('bitrate', bitrate);
              // 更新最大传输速率
              maxTransferData.value = Math.max(
                maxTransferData.value,
                bitrate.toFixed(2)
              );
              realTimeRate.value = bitrate.toFixed(2);
              // 将当前时间戳和比特率添加到时间线数据系列
              bitrateSeries.addPoint(now, bitrate);
              // 更新比特率图表的数据系列
              bitrateGraph.setDataSeries([bitrateSeries]);
              // 更新比特率图表的结束时间
              bitrateGraph.updateEndDate();
            }
            // statsOutput +=
            //   `<h2>Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
            //   `<strong>Timestamp:</strong> ${report.timestamp}<br>\n`;
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

        // 保存当前统计结果供下次计算使用
        lastResult.value = stats;
        // 将统计输出显示在页面上 (如果 statsbox 存在)
        // transfileRef.value?.statsbox.innerHTML = statsOutput;
      });
    }, 1000); // 每1000毫秒（1秒）执行一次
  }

  // 监听 ice 事件
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
    // 发送 ice 信息
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

  // 成功设置对方的连接信息改变连接状态
  if (transfileRef.value) {
    transfileRef.value.con_status = true;
  }
  // 同时发送信号给对方改变状态
  signaling.value.postMessage({ type: 'connction', status: 'connected' });
}

// 处理 ice 信息交换
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
    // 添加 ice 信息
    await pc.value.addIceCandidate(candidate);
  }
}

// 接收方处理发送方 offer
async function handleOffer(offer) {
  console.log('handleOffer------');
  // 创建 p2p 连接对象
  await createPeerConnection();
  // 监听数据通道
  pc.value.ondatachannel = receiveChannelCallback;
  // 接收方设置发送方的连接信息
  await pc.value.setRemoteDescription(offer);
  // 创建接受方的连接信息
  const answer = await pc.value.createAnswer();
  // 发送 answer 信息
  signaling.value.postMessage({ type: 'answer', sdp: answer.sdp });
  // 设置本地连接信息
  await pc.value.setLocalDescription(answer);
}

// 发送数据在里面，要传一个 channel 进去发送，还得传 2 个
// 接收数据在外面，因为创建的连接是在外面
function receiveChannelCallback(event) {
  console.log('Receive Channel Callback');
  receiveChannel.value = event.channel;

  // 通道事件处理将在组件中设置
  if (activeTab.value === 'file' && transfileRef.value) {
    const originalOnReceiveOpen =
      transfileRef.value.onReceiveChannelStateChange;
    receiveChannel.value.onopen = (e) => {
      resetActivityTimer();
      if (originalOnReceiveOpen)
        originalOnReceiveOpen.call(transfileRef.value, e);
    };
    const originalOnReceiveMessage =
      transfileRef.value.onReceiveChannelMessageCallback;
    receiveChannel.value.onmessage = (e) => {
      resetActivityTimer();
      if (originalOnReceiveMessage)
        originalOnReceiveMessage.call(transfileRef.value, e);
    };
    receiveChannel.value.onclose =
      transfileRef.value.onReceiveChannelStateChange;
  } else if (activeTab.value === 'text' && transtextRef.value) {
    const originalTextReceiveOnOpen =
      transtextRef.value.onReceiveChannelStateChange; // Placeholder
    receiveChannel.value.onopen = (e) => {
      resetActivityTimer();
      if (originalTextReceiveOnOpen)
        originalTextReceiveOnOpen.call(transtextRef.value, e);
      else if (transtextRef.value) transtextRef.value.isConnected = true;
    };
    const originalOnTextMsgReceived = transtextRef.value.onTextMessageReceived;
    receiveChannel.value.onmessage = (e) => {
      resetActivityTimer();
      try {
        const message = JSON.parse(e.data);
        if (originalOnTextMsgReceived)
          originalOnTextMsgReceived.call(transtextRef.value, message);
      } catch (error) {
        console.error('解析消息失败:', error);
      }
    };
    const originalTextReceiveOnClose =
      transtextRef.value.onReceiveChannelStateChange; // Placeholder
    receiveChannel.value.onclose = (e) => {
      if (originalTextReceiveOnClose)
        originalTextReceiveOnClose.call(transtextRef.value, e);
      else if (transtextRef.value) transtextRef.value.isConnected = false;
    };
  }
}

const startFn = async () => {
  console.log('startFn-----');
  await createPeerConnection();
  sendChannel.value = pc.value.createDataChannel('sendDataChannel');

  const originalSend = sendChannel.value.send.bind(sendChannel.value);
  sendChannel.value.send = (...args) => {
    if (sendChannel.value && sendChannel.value.readyState === 'open') {
      resetActivityTimer();
    }
    return originalSend(...args);
  };

  if (activeTab.value === 'file' && transfileRef.value) {
    const originalOnSendOpen = transfileRef.value.onSendChannelStateChange;
    sendChannel.value.onopen = (event) => {
      resetActivityTimer();
      if (originalOnSendOpen)
        originalOnSendOpen.call(transfileRef.value, event);
    };
    const originalOnSendMessage =
      transfileRef.value.onSendChannelMessageCallback;
    sendChannel.value.onmessage = (event) => {
      resetActivityTimer();
      if (originalOnSendMessage)
        originalOnSendMessage.call(transfileRef.value, event);
    };
    sendChannel.value.onclose = transfileRef.value.onSendChannelStateChange;
  } else if (activeTab.value === 'text' && transtextRef.value) {
    const originalTextSendOnOpen = transtextRef.value.onSendChannelStateChange; // Placeholder
    sendChannel.value.onopen = (event) => {
      resetActivityTimer();
      if (originalTextSendOnOpen)
        originalTextSendOnOpen.call(transtextRef.value, event);
      else if (transtextRef.value) transtextRef.value.isConnected = true;
    };
    const originalTextSendOnMessage = transtextRef.value.onTextMessageReceived; // Or specific handler
    sendChannel.value.onmessage = (event) => {
      resetActivityTimer();
      try {
        const message = JSON.parse(event.data);
        if (originalTextSendOnMessage)
          originalTextSendOnMessage.call(transtextRef.value, message);
      } catch (error) {
        console.error('解析消息失败:', error);
      }
    };
    const originalTextSendOnClose = transtextRef.value.onSendChannelStateChange; // Placeholder
    sendChannel.value.onclose = (event) => {
      if (originalTextSendOnClose)
        originalTextSendOnClose.call(transtextRef.value, event);
      else if (transtextRef.value) transtextRef.value.isConnected = false;
    };
  }

  // 创建发送方的连接信息
  const offer = await pc.value.createOffer();
  // 发送 offer 信息
  signaling.value.postMessage({ type: 'offer', sdp: offer.sdp });
  // 设置本地连接信息
  await pc.value.setLocalDescription(offer);
};

const sureConnect = (data) => {
  ElMessageBox.confirm(`要接受来自 ${data.name} 的连接邀请吗?`, 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning',
  })
    .then(() => {
      ElMessage({
        type: 'success',
        message: '连接成功',
      });
      startFn();
    })
    .catch(() => {
      ElMessage({
        type: 'error',
        message: '取消连接',
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
        if (transfileRef.value) {
          transfileRef.value.con_status = e.data.status === 'connected';
        }
        break;
      case 'disconncted':
        signalingDisconncted(e.data.shenfen);
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
      case 'endCall':
        if (transvideoRef.value) {
          transvideoRef.value.endVideoCall();
        }
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
