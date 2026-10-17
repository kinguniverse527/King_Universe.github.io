# King_Universe 的 Jekyll 博客

一个适用于 GitHub Pages 的小型博客起点。文章、个人资料、模板和样式分别存放，没有前端打包工具，也不需要文章数据库。

## 文件在哪里

| 内容 | 位置 |
| --- | --- |
| 网站名称、网址、时区 | `_config.yml` |
| 首页简介、寄语、项目列表 | `_data/profile.yml` |
| 每篇文章 | `_posts/` |
| 关于我 | `about.md` |
| 首页文章列表 | `index.html` |
| 页面骨架、文章模板 | `_layouts/` |
| 公共导航与页脚 | `_includes/` |
| 字号、宽度、间距、手机样式 | `assets/css/style.css` |
| 图片 | `assets/images/` |

## 发布到现有 GitHub Pages

1. 备份现有仓库内容。
2. 把这个目录内的文件放到 `kinguniverse527.github.io` 仓库根目录。不要把外层 `jekyll-blog` 文件夹一起上传。
3. 如果仓库根目录已有 `.nojekyll`，移除它；该文件会关闭 Jekyll 处理。
4. 在 Settings → Pages 中选择 Deploy from a branch、`main` 和 `/ (root)`。
5. 提交后等待 Actions 中的 Pages 构建和部署成功。
6. 检查首页、文章页、关于页、手机布局和不存在的网址。

正式地址： https://kinguniverse527.github.io/

这里使用 GitHub Pages 默认 Jekyll 构建，不需要额外创建 Actions 工作流。
如果现有站点使用自定义 Actions，需要确认它执行 Jekyll 构建，而不是直接上传源文件。
如果日后使用项目路径网址，请相应修改 `_config.yml` 的 `url` 与 `baseurl`。

## 新建一篇文章

在 `_posts` 新建 `2026-10-19-my-note.md`，例如：

```markdown
---
title: 今天的记录
date: 2026-10-19 12:00:00 +0800
description: 一句话摘要。
---

这里写正文。

## 一个小标题

这里可以使用 **加粗**、列表、引用和链接。
```

首页自动按日期从新到旧列出文章，不需要手工增加链接。
未来日期的文章会等到相应日期后的下一次构建才显示，不会到时间就自动触发构建。
当前是公开仓库，请勿把私人草稿提交进去；即使页面不展示，源文件也可能被人读取。

图片放入 `assets/images`，文章中引用：

```liquid
![图片说明]({{ '/assets/images/photo.jpg' | relative_url }})
```

## 本地预览（可选）

安装受当前 github-pages 依赖支持的 Ruby 和 Bundler 后，在项目目录运行：

```sh
bundle install
bundle exec jekyll serve
```

打开终端显示的本地网址。不要直接双击这里的 `index.html`：它是模板源文件，需要 Jekyll 生成网页。
修改 `_config.yml` 后需要重新启动预览。
首次安装会生成 `Gemfile.lock`，成功构建后可提交它以记录依赖版本。

## 关于可视化后台

本版先完成 Jekyll 基础结构，尚未接入 Decap CMS，也没有可用的 `/admin/` 后台。
后续接入时再增加 `admin/index.html`、`admin/config.yml` 和登录认证服务。
目前 `_config.yml` 排除了 `admin`；正式接入后台时需要删除该排除项。

## 维护原则

- 每篇文章单独一个文件，布局由模板统一控制。
- 名称、简介和项目列表集中放在资料文件里。
- 公共样式只维护一份，使用正常缩进和分区注释。
- 修改前先预览，部署后再核对公开网址。
- `_site` 是生成结果，不要手动修改，也不要提交。

## 本次验证范围

已检查文件结构、模板引用、文章元数据及资源路径。
制作环境没有 Ruby、Bundler 和 Jekyll，因此未运行实际 Jekyll 构建或浏览器渲染。
首次发布仍需以 GitHub Pages 的构建结果为准。
