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

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{ signaling: any }>();
const emit = defineEmits(['closeChannel']);

// 视频元素引用
const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const stream = ref<MediaStream | null>();
// 状态变量
const localStream = ref<MediaStream | null>(null);
const isCallActive = ref<boolean>(false);

/**
 * 就是一开始是连接好的，现在获取本地媒体流，然后在重新连接一次
 */

// 获取本地媒体流
const getLocalStream = async (): Promise<MediaStream | undefined> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.value = stream;
    if (localVideo.value) {
      localVideo.value.srcObject = stream;
    }
    return stream;
  } catch (error) {
    console.error('获取本地媒体流失败:', error);
    ElMessage.error('无法访问摄像头或麦克风');
    throw error;
  }
};

// 开始视频通话
const startVideoCall = async (): Promise<void> => {
  // 获取本地媒体流
  stream.value = await getLocalStream();
  props.signaling.postMessage({ type: 'ready' });
  isCallActive.value = true;
};

// 结束视频通话
const endVideoCall = (): void => {
  if (isCallActive.value) {
    // 让signaling发送消息把远端停止
    props.signaling.postMessage({ type: 'endCall' });
    // 停止本地流
    stopLocalStream();

    // 清除远程视频
    if (remoteVideo.value && remoteVideo.value.srcObject) {
      (remoteVideo.value.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
      remoteVideo.value.srcObject = null;
    }

    isCallActive.value = false;
    ElMessage.success('视频通话已结束');
  }
};

// 停止本地媒体流
const stopLocalStream = (): void => {
  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop());
    localStream.value = null;
    if (localVideo.value) {
      localVideo.value.srcObject = null;
    }
  }
};

onUnmounted(() => {
  // 关闭通道
  emit('closeChannel');
});

// 暴露方法给父组件
defineExpose({
  remoteVideo,
  stream,
  endVideoCall,
});
</script>

<style scoped lang="less">
.transvideo {
  display: flex;
  flex-direction: column;

  .video-container {
    display: flex;
    justify-content: space-between;
    height: calc(100% - 60px);

    .video_left,
    .video_right {
      width: 600px;
      height: 400px;
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
        width: 600px;
        height: 400px;
        object-fit: cover;
        background-color: #f5f7fa;
      }
    }

    .video_left {
      margin: 50px 0 0 50px;
    }

    .video_right {
      margin: 50px 50px 0 0;
    }
  }

  .controls {
    display: flex;
    justify-content: flex-start;
    margin: 20px 0 0 50px;
    gap: 20px;
  }
}
</style>
