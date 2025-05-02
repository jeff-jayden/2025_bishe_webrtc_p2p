<template>
  <div class="transvideo">
    <div class="video-container">
      <div class="video_left">
        <div class="video-title">本地视频</div>
        <video ref="localVideo" playsinline autoplay muted></video>
      </div>
      <div class="video_right">
        <div class="video-title">远程视频</div>
        <video ref="remoteVideo" playsinline autoplay></video>
      </div>
    </div>
    <div class="controls">
      <el-button type="primary" @click="startVideoCall" :disabled="isCallActive"
        >开始通话</el-button
      >
      <el-button type="danger" @click="endVideoCall" :disabled="!isCallActive"
        >结束通话</el-button
      >
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  sendChannel: Object,
  receiveChannel: Object,
  pc: Object,
  signaling: Object,
});

// 视频元素引用
const localVideo = ref(null);
const remoteVideo = ref(null);

const stream = ref();

// 状态变量
const isCallActive = ref(false);
const localStream = ref(null);

const emit = defineEmits(['handleChangeSdp']);

/**
 * 就是一开始是连接好的，现在获取本地媒体流，然后在重新连接一次
 */

// 获取本地媒体流
const getLocalStream = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.value = stream;
    localVideo.value.srcObject = stream;
    return stream;
  } catch (error) {
    console.error('获取本地媒体流失败:', error);
    ElMessage.error('无法访问摄像头或麦克风');
    throw error;
  }
};

// 开始视频通话
const startVideoCall = async () => {
  // try {
  // 获取本地媒体流
  stream.value = await getLocalStream();
  // isCallActive.value = true;
  props.signaling.postMessage({type: 'ready'});

  // 将本地流添加到对等连接
  // if (props.pc) {
  //   console.log('执行了props.pc');
    


    // await props.pc.createOffer()
    //   .then((offer) => {
    //     console.log('创建的offer:', offer);
    //     props.pc.setLocalDescription(offer);
    //     console.log('设置本地描述:', props.pc);
    //     emit('handleChangeSdp',offer);
    //   })

    // 添加ontrack事件处理程序，用于接收远程视频流
    // props.pc.ontrack = (event) => {
    //   console.log('收到远程视频流:', event.streams[0]);
    //   if (remoteVideo.value) {
    //     remoteVideo.value.srcObject = event.streams[0];
    //   }
    // };
  // }

  // 如果已经有连接，使用现有连接  这里就不自动执行了
  //   if (props.sendChannel && props.sendChannel.readyState === 'open') {
  //     // 发送视频通话开始的信号
  //     const message = {
  //       type: 'video-call-start',
  //       time: new Date().toLocaleString(),
  //     };
  //     // 发送消息
  //     props.sendChannel.send(JSON.stringify(message));
  //     console.log('已发送消息sendChannel');
  //     // ElMessage.success('已发送消息', message);
  //   } else if (
  //     props.receiveChannel &&
  //     props.receiveChannel.readyState === 'open'
  //   ) {
  //     // 发送视频通话开始的信号
  //     const message = {
  //       type: 'video-call-start',
  //       time: new Date().toLocaleString(),
  //     };
  //     props.receiveChannel.send(JSON.stringify(message));
  //     console.log('已发送消息receiveChannel');
  //     // ElMessage.success('已发送消息', message);
  //   } else {
  //     ElMessage.warning('连接未建立，无法开始视频通话');
  //     isCallActive.value = false;
  //     stopLocalStream();
  //   }

  // } catch (error) {
  //   console.error('开始视频通话失败:', error);
  //   ElMessage.error('开始视频通话失败');
  //   isCallActive.value = false;
  // }
};

// 结束视频通话
const endVideoCall = () => {
  if (isCallActive.value) {
    // 发送视频通话结束的信号
    if (props.sendChannel && props.sendChannel.readyState === 'open') {
      const message = {
        type: 'video-call-end',
        time: new Date().toLocaleString(),
      };
      props.sendChannel.send(JSON.stringify(message));
    } else if (
      props.receiveChannel &&
      props.receiveChannel.readyState === 'open'
    ) {
      const message = {
        type: 'video-call-end',
        time: new Date().toLocaleString(),
      };
      props.receiveChannel.send(JSON.stringify(message));
    }

    // 停止本地流
    stopLocalStream();

    // 清除远程视频
    if (remoteVideo.value && remoteVideo.value.srcObject) {
      remoteVideo.value.srcObject.getTracks().forEach((track) => track.stop());
      remoteVideo.value.srcObject = null;
    }

    isCallActive.value = false;
    ElMessage.info('视频通话已结束');
  }
};

// 停止本地媒体流
const stopLocalStream = () => {
  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop());
    localStream.value = null;
    if (localVideo.value) {
      localVideo.value.srcObject = null;
    }
  }
};

// 处理接收到的消息
// const handleReceivedMessage = (message) => {
//   console.log('视频组件收到消息:', message);
//   // message = JSON.parse(message);
//   if (message.type === 'video-call-start') {
//     // 对方开始视频通话，我们也应该开始
//     if (!isCallActive.value) {
//       startVideoCall();
//     }
//   } else if (message.type === 'video-call-end') {
//     // 对方结束视频通话，我们也应该结束
//     if (isCallActive.value) {
//       endVideoCall();
//     }
//   }
// };

// 暴露方法给父组件
defineExpose({
  // handleReceivedMessage,
  remoteVideo,
  stream,
});
</script>

<style scoped lang="less">
.transvideo {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .video-container {
    display: flex;
    justify-content: space-between;
    height: calc(100% - 60px);

    .video_left,
    .video_right {
      width: 48%;
      height: 100%;
      position: relative;
      border: 1px solid #dcdfe6;
      border-radius: 8px;
      overflow: hidden;

      .video-title {
        position: absolute;
        top: 10px;
        left: 10px;
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        z-index: 1;
      }

      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        background-color: #f5f7fa;
      }
    }
  }

  .controls {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    gap: 20px;
  }
}
</style>
