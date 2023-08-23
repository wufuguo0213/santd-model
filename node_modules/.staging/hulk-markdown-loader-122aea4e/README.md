# hulk-markdown-loader

专门给 Component 命令使用的 markdown loader，会将 markdown 文档中的 demo 部分代码解析出来，生成可展现的 [San](https://baidu.github.io/san/) 组件。

## Usage

```js
{
    test: /\.md$/,
    use: [{loader: 'hulk-markdown-loader': options: {template: 'path.template'}}]
}
```

## template 说明

支持自定义 template，默认 template 为：

```html
<template>
    <section class="code-box {{isExpand?'expand':''}}" id="${id}">
        <section class="code-box-demo"><code-preview /></section>
        <section class="code-box-meta markdown">
            <text-container-placeholder />
            <span class="code-expand-icon" on-click="toggleExpand">
                <img
                    alt="expand code"
                    src="https://gw.alipayobjects.com/zos/rmsportal/wSAkBuJFbdxsosKKpqyq.svg"
                    class="{{isExpand?'code-expand-icon-hide':'code-expand-icon-show'}}"
                />
                <img
                    alt="expand code"
                    src="https://gw.alipayobjects.com/zos/rmsportal/OpROPHYqWmrMDBFMZtKF.svg"
                    class="{{isExpand?'code-expand-icon-show':'code-expand-icon-hide'}}"
                />
            </span>
        </section>
        <section class="highlight-wrapper {{isExpand?'highlight-wrapper-expand':''}}">
            <code-container-placeholder />
        </section>
    </section>
</template>
<script>
    export default {
        initData() {
            return {
                isExpand: false
            };
        },
        toggleExpand() {
            this.data.set('isExpand', !this.data.get('isExpand'));
        }
    };
</script>
```

特殊标签说明：

-   `<code-preview/>`： markdown 中的 `fence`部分 san 代码会被渲染出来的效果
-   `<text-container-placeholder/>`： markdown 中`text`标签内部的文案转 html
-   `<code-container-placeholder/>`：markdown 中的 `fence`部分 san 代码，被 prismjs 语法高亮

## 参数

-   ignore：正则忽略
-   template：模板路径
-   context：目录上下文
-   textTag = 'text'：匹配 text 的 tag，支持 i18n 写法：`<text lang='cn'>`
-   i18n = 'cn'：默认解析的文档语言
-   exportType： 支持三种，默认是 app，即
    -   app：默认，即通常的用法，会返回`template`转成的 doc+预览的效果，可以修改 template 模板的方式来修改样式
    -   object：返回的是包含 text、sanComponent 和 code 的对象，在`index.js`中可以自由使用灵活度较高；
    -   component：仅仅返回 markdown 文档中的代码部分 san 组件，用于只显示预览效果。

## 只展现`html`中的代码，不显示页面文档内容

新建`preview.js`，内容如下：

```js
// html:
import {Component} from 'san';
import Basic from './basic.md?exportType=component';

export default class Index extends Component {
    static template = `
        <div>
            <basic/>
        </div>
    `;
    static components = {
        basic: Basic
    };
}
```

在这里`import Basic from './basic.md?exportType=component'`得到的是不再是一个完整的文档+预览内容，而是得到预览部分代码的的 San 组件，通过这种方式可以直接预览 Markdown 文档中的代码部分效果。**可以用于移动页面嵌入 iframe 预览效果**

## 如果组件使用了 ts 语法，需要完善相应 loader 配置

假设有个`ts-comp.san`文件，script内容如下：

```html
<script lang="ts">
import {Component} from 'san';

const text: string = 'Hello TS!';

export default class TsComp extends Component {
    static template = `
        <div>{{ text }}</div>
    `;

    initData() {
        return {
            text
        };
    }
}
</script>
```

那么 webpack 配置文件中需要包括：

```js
{
    module: {
        rules: [
            {
                test: /\.md/,
                use: 'hulk-markdown-loader'
            },
            {
                test: /\.san$/,
                use: 'san-loader'
            },
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ...babelConfig.presets,
                            ['@babel/preset-typescript', {
                                allExtensions: true
                            }]
                        ],
                        plugins: babelConfig.plugins
                    }
                }
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: babelConfig
                }
            },
            {
                test: /\.(css|less)$/,
                oneOf: [
                    // 这里匹配 `<style lang="less" module>`
                    {
                        resourceQuery: /module/,
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    modules: {
                                        localIdentName: '[local]_[hash:base64:5]'
                                    },
                                    localsConvention: 'camelCase'
                                }
                            },
                            'less-loader'
                        ]
                    },
                    // 这里匹配 `<style lang="less">`
                    {
                        use: [
                            'style-loader',
                            'css-loader',
                            'less-loader'
                        ]
                    }
                ]
            }
            {
                test: /\.html$/,
                use: [
                    {
                        loader: 'html-loader',
                        options: {
                            esModule: false
                        }
                    }
                ]
            }
        ]
    }
}
```
