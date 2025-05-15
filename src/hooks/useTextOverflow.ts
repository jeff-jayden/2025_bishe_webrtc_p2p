import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';

export default function useTextOverflow(options: {
  textRef: Ref<HTMLElement>;
  text: Ref<string | number>;
  rows: Ref<string | number>;
  watchResize: boolean;
}) {
  const { textRef, text, rows } = options;

  const shouldListen = ref(true);
  const isTextOverflow = ref(false);

  /**
   * Element.scrollWidth/Element.offsetWidth 都为四舍五入的整数值，存在边缘case导致文本溢出但这两个宽度相等导致disable掉了popover展示全部的功能
   * 这里针对单行文本做个优化，精确获取文本的可视宽度与实际宽度并进行对比
   */
  function _compareSingleWidth() {
    const txt = `${text.value}`;
    let refFontSize = 'medium';
    if (window.getComputedStyle && textRef.value) {
      refFontSize = window.getComputedStyle(textRef.value).fontSize;
    }

    const dom = document.createElement('span');
    dom.style.display = 'inline-block';
    dom.style.fontSize = refFontSize;
    // 避免被父容器的样式影响导致计算宽度异常
    dom.style.width = 'fit-content';
    dom.textContent = txt;
    document.body.appendChild(dom);
    const realScrollWidth = dom.getBoundingClientRect().width;
    document.body.removeChild(dom);

    const realOffsetWidth = textRef.value.getBoundingClientRect().width;
    // 返回真实的文本宽度与元素的宽度的比较值
    return realScrollWidth <= realOffsetWidth;
  }

  const update = () => {
    if (shouldListen.value) {
      const { scrollHeight, offsetHeight } = textRef.value;
      isTextOverflow.value =
        textRef.value &&
        (+rows.value === 1
          ? !_compareSingleWidth() /** single-row */
          : scrollHeight > offsetHeight) /** multi-rows */;
    } else {
      shouldListen.value = true;
    }
  };

  watch(text, update);

  onMounted(() => {
    if (options.watchResize) {
      const observer = new ResizeObserver(update);
      observer.observe(textRef.value);
      onUnmounted(() => observer.disconnect());
    } else {
      update();
    }
  });

  return { isTextOverflow, shouldListen, update };
}
