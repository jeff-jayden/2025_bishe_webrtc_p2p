module.exports = {
  // 输入目录，包含Markdown文档
  input: 'docs',
  
  // 输出目录，生成的HTML文件
  output: 'docs-html',
  
  // 文档标题
  title: '项目文档',
  
  // 主题 (light, dark)
  theme: 'light',
  
  // 是否启用图表交互功能
  interactive: true,
  
  // 是否启用保存图片功能
  saveImage: true,
  
  // 文档分类
  categories: [
    { id: 'structure', name: '结构图', path: 'structure' },
    { id: 'er', name: '实体关系图', path: 'er' },
    { id: 'flowcharts', name: '流程图', path: 'flowcharts' },
    { id: 'ui', name: 'UI设计图', path: 'ui' }
  ],
  
  // 自定义模板（可选）
  templates: {
    // 自定义页面模板
    // page: 'path/to/custom-template.html',
    // 自定义样式
    // styles: ['path/to/custom-style.css']
  }
};
