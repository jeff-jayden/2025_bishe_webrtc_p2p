<template>
  <div class="transscreen-container">
    <video
      ref="localVideo"
      autoplay
      muted
      playsinline
      class="local-video"
    ></video>
    <video ref="remoteVideo" autoplay playsinline class="remote-video"></video>
  </div>
  <div class="control-buttons">
    <el-button type="primary" @click="startScreenShare">开始共享</el-button>
    <el-button type="danger" @click="stopScreenShare">停止共享</el-button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

/**
 * 流程大致，点击共享屏幕，收集媒体流，发送消息，创建连接，同时设置 video
 * 别急慢慢来，先实现了再说
 */

const props = defineProps({
  signaling: Object,
  pc: Object,
});

const localVideo = ref(null);
const remoteVideo = ref(null);
const stream = ref(null);

const startScreenShare = async () => {
  try {
    stream.value = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    localVideo.value.srcObject = stream.value;
    props.signaling.postMessage({ type: 'ready' });
  } catch (error) {
    console.error('屏幕共享错误:', error);
  }
};

const stopScreenShare = () => {
  props.signaling.postMessage({ type: 'bye' });

  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop());
    stream.value = null;
    localVideo.value.srcObject = null;
  }

  // 清除远程视频
  if (remoteVideo.value && remoteVideo.value.srcObject) {
    remoteVideo.value.srcObject.getTracks().forEach((track) => track.stop());
    remoteVideo.value.srcObject = null;
  }
};

defineExpose({
  stream,
  localVideo,
  remoteVideo,
  stopScreenShare
});

onUnmounted(() => {
  stopScreenShare();
});
</script>

<style scoped>
.transscreen-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 10px;
}

.local-video,
.remote-video {
  width: 600px;
  height: 400px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin-left: 40px;
}
</style>
