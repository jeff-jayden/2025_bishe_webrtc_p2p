<template>
  <div class="transfer-text">
    <!-- 左侧：文本输入区域 -->
    <div class="left-panel">
      <div class="panel-title">发送文本</div>
      <div class="text-input-area">
        <el-input
          v-model="textContent"
          type="textarea"
          :rows="6"
          placeholder="请输入要传输的文本内容"
        />
      </div>

      <!-- 发送按钮 -->
      <div class="bottom">
        <el-button
          type="primary"
          class="btn"
          @click="sendText"
          :disabled="!textContent.trim()"
        >
          发送
        </el-button>
        <el-button type="danger" class="btn" @click="clearText">
          清空
        </el-button>
      </div>
    </div>

    <!-- 右侧：接收的文本列表 -->
    <div class="right-panel">
      <div class="panel-title">接收文本</div>
      <div class="received-text-container">
        <div class="received-text-list" v-if="receivedTexts.length > 0">
          <div
            v-for="(text, index) in receivedTexts"
            :key="index"
            class="received-text-item"
            :class="{ 'self-message': text.isSelf }"
          >
            <div class="text-content">
              <p>{{ text.content }}</p>
            </div>
            <div class="text-time">{{ text.time }}</div>
            <div class="text-actions">
              <el-button
                type="primary"
                size="small"
                @click="copyText(text.content)"
                >复制</el-button
              >
            </div>
          </div>
        </div>
        <div class="no-messages" v-else>
          <p>暂无接收到的消息</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  sendChannel: Object,
  receiveChannel: Object,
});

const textContent = ref('');
const receivedTexts = ref([]);

// 发送文本
const sendText = () => {
  if (!textContent.value.trim()) return;

  if (props.sendChannel && props.sendChannel.readyState === 'open') {
    try {
      const textMessage = {
        type: 'text',
        content: textContent.value,
        time: new Date().toLocaleString(),
      };

      props.sendChannel.send(JSON.stringify(textMessage));
      // receivedTexts.value.unshift({
      //   content: textMessage.content,
      //   time: textMessage.time,
      //   isSelf: true,
      // });
      ElMessage.success('文本发送成功');
    } catch (error) {
      console.error('发送文本失败:', error);
      ElMessage.error('发送文本失败');
    }
  } else if (
    props.receiveChannel &&
    props.receiveChannel.readyState === 'open'
  ) {
    try {
      const textMessage = {
        type: 'text',
        content: textContent.value,
        time: new Date().toLocaleString(),
      };

      props.receiveChannel.send(JSON.stringify(textMessage));
      // receivedTexts.value.unshift({
      //   content: textMessage.content,
      //   time: textMessage.time,
      //   isSelf: true,
      // });
      ElMessage.success('文本发送成功');
    } catch (error) {
      console.error('发送文本失败:', error);
      ElMessage.error('发送文本失败');
    }
  } else {
    ElMessage.warning('连接未建立，无法发送文本');
  }
};

// 清空文本
const clearText = () => {
  textContent.value = '';
};

// 复制文本到剪贴板
const copyText = (text) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success('文本已复制到剪贴板');
    })
    .catch((err) => {
      console.error('复制失败:', err);
      ElMessage.error('复制失败');
    });
};

// 接收文本消息的处理函数
const onTextMessageReceived = (message) => {
  if (message.type === 'text') {
    receivedTexts.value.unshift({
      content: message.content,
      time: message.time || new Date().toLocaleString(),
      isSelf: false,
    });
  }
};

// 暴露方法给父组件
defineExpose({
  onTextMessageReceived,
  clearText,
});
</script>

<style scoped lang="less">
.transfer-text {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;

  .left-panel,
  .right-panel {
    width: 50%;
    padding: 20px;
  }

  .left-panel {
    .panel-title {
      margin-bottom: 20px;
    }
    .bottom {
      margin-top: 20px;
    }
  }

  .right-panel {
    height: 100%;
    .panel-title {
      margin-bottom: 20px;
    }

    .received-text-container {
      overflow: scroll;
      height: 50%;
      .received-text-item {
        display: flex;
        border: 1px solid #b0b0b0;
        border-radius: 8px;
        padding: 6px 8px;
        margin-bottom: 5px;
      }
    }
  }
}
</style>
